import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, API_BASE } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import Sidebar from '../components/Sidebar.jsx';
import ChatWindow from '../components/ChatWindow.jsx';
import { statusRank } from '../utils';

const emptyConvo = { messages: [], hasMore: false, loading: false, loadingOlder: false, loaded: false };

export default function Chat() {
  const { user: me, token, logout } = useAuth();

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activePeer, setActivePeer] = useState(null);
  const [convos, setConvos] = useState({}); // peerId -> conversation state
  const [typing, setTyping] = useState({}); // peerId -> bool
  const [onlineIds, setOnlineIds] = useState(new Set());
  const [connected, setConnected] = useState(false);

  const socketRef = useRef(null);
  const activeRef = useRef(null);
  const usersRef = useRef([]);
  const convosRef = useRef({});
  const searchRef = useRef('');
  const typingTimers = useRef({});

  activeRef.current = activePeer ? activePeer._id : null;
  usersRef.current = users;
  convosRef.current = convos;
  searchRef.current = search;

  // ---------- Users list (+ search, debounced) ----------
  const loadUsers = useCallback(async (q = '') => {
    try {
      const data = await api(`/api/users?search=${encodeURIComponent(q)}`);
      setUsers(data.users);
    } catch (err) {
      if (err.status === 401) logout();
    } finally {
      setUsersLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const t = setTimeout(() => loadUsers(search.trim()), search ? 250 : 0);
    return () => clearTimeout(t);
  }, [search, loadUsers]);

  // ---------- Helpers that update state ----------
  const patchConvo = useCallback((peerId, fn) => {
    setConvos((prev) => {
      const c = prev[peerId];
      if (!c) return prev;
      return { ...prev, [peerId]: fn(c) };
    });
  }, []);

  const bumpUser = useCallback((peerId, last, unreadDelta) => {
    setUsers((prev) => {
      const u = prev.find((x) => x._id === peerId);
      if (!u) return prev;
      const updated = {
        ...u,
        lastMessage: last,
        unreadCount: unreadDelta === 'reset' ? 0 : u.unreadCount + (unreadDelta || 0),
      };
      return [updated, ...prev.filter((x) => x._id !== peerId)];
    });
  }, []);

  // ---------- Socket connection ----------
  useEffect(() => {
    const socket = io(API_BASE || undefined, { auth: { token } });
    socketRef.current = socket;
    const myId = me._id;

    socket.on('connect', () => {
      setConnected(true);
      // Re-sync after a reconnect
      if (activeRef.current) socket.emit('message:read', { from: activeRef.current });
      loadUsers(searchRef.current.trim());
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => {
      if (/token|authentication|user not found/i.test(err.message)) logout();
    });

    socket.on('presence:list', (ids) => setOnlineIds(new Set(ids)));
    socket.on('presence:update', ({ userId, isOnline, lastSeen }) => {
      setOnlineIds((prev) => {
        const next = new Set(prev);
        if (isOnline) next.add(userId);
        else next.delete(userId);
        return next;
      });
      if (lastSeen) {
        setUsers((prev) => prev.map((u) => (u._id === userId ? { ...u, lastSeen } : u)));
        setActivePeer((p) => (p && p._id === userId ? { ...p, lastSeen } : p));
      }
    });

    socket.on('typing', ({ from, isTyping }) => {
      clearTimeout(typingTimers.current[from]);
      setTyping((prev) => ({ ...prev, [from]: isTyping }));
      if (isTyping) {
        // safety net in case the "stop" event is lost
        typingTimers.current[from] = setTimeout(
          () => setTyping((prev) => ({ ...prev, [from]: false })),
          4000
        );
      }
    });

    socket.on('message:new', (msg) => {
      const incoming = msg.sender !== myId;
      const peerId = incoming ? msg.sender : msg.receiver;
      const viewing = incoming && activeRef.current === peerId && document.visibilityState === 'visible';

      if (incoming) setTyping((prev) => ({ ...prev, [peerId]: false }));

      patchConvo(peerId, (c) =>
        c.messages.some((m) => m._id === msg._id) ? c : { ...c, messages: [...c.messages, msg] }
      );

      if (!usersRef.current.some((u) => u._id === peerId)) {
        loadUsers(searchRef.current.trim()); // a brand-new conversation partner
      } else {
        bumpUser(
          peerId,
          { text: msg.text, createdAt: msg.createdAt, fromMe: !incoming },
          incoming && !viewing ? 1 : 0
        );
      }
      if (viewing) socket.emit('message:read', { from: peerId });
    });

    // delivered / read receipts for messages I sent
    socket.on('message:status', ({ ids, status, conversationWith }) => {
      const set = new Set(ids);
      patchConvo(conversationWith, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          set.has(m._id) && statusRank[status] > statusRank[m.status] ? { ...m, status } : m
        ),
      }));
    });

    // I read a conversation in another tab
    socket.on('conversation:read', ({ with: peerId }) => {
      setUsers((prev) => prev.map((u) => (u._id === peerId ? { ...u, unreadCount: 0 } : u)));
    });

    return () => {
      Object.values(typingTimers.current).forEach(clearTimeout);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token, me._id, logout, loadUsers, patchConvo, bumpUser]);

  // Coming back to the tab counts as reading the open conversation
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && activeRef.current) {
        socketRef.current?.emit('message:read', { from: activeRef.current });
        setUsers((prev) =>
          prev.map((u) => (u._id === activeRef.current ? { ...u, unreadCount: 0 } : u))
        );
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // ---------- Actions ----------
  const openConversation = useCallback(async (peer) => {
    setActivePeer(peer);
    setUsers((prev) => prev.map((u) => (u._id === peer._id ? { ...u, unreadCount: 0 } : u)));
    socketRef.current?.emit('message:read', { from: peer._id });

    const existing = convosRef.current[peer._id];
    if (existing && (existing.loaded || existing.loading)) return;

    setConvos((prev) => ({ ...prev, [peer._id]: { ...emptyConvo, loading: true } }));
    try {
      const data = await api(`/api/messages/${peer._id}?limit=30`);
      setConvos((prev) => {
        const cur = prev[peer._id] || emptyConvo;
        const have = new Set(data.messages.map((m) => m._id));
        // keep anything that arrived while the history was loading
        const extra = cur.messages.filter((m) => !have.has(m._id));
        return {
          ...prev,
          [peer._id]: {
            ...cur,
            messages: [...data.messages, ...extra],
            hasMore: data.hasMore,
            loading: false,
            loaded: true,
          },
        };
      });
    } catch {
      patchConvo(peer._id, (c) => ({ ...c, loading: false }));
    }
  }, [patchConvo]);

  const loadOlder = useCallback(async () => {
    const peerId = activeRef.current;
    const c = peerId && convosRef.current[peerId];
    if (!c || c.loadingOlder || !c.hasMore || !c.messages.length) return;
    patchConvo(peerId, (x) => ({ ...x, loadingOlder: true }));
    try {
      const before = c.messages[0].createdAt;
      const data = await api(`/api/messages/${peerId}?limit=30&before=${encodeURIComponent(before)}`);
      patchConvo(peerId, (x) => ({
        ...x,
        messages: [...data.messages, ...x.messages],
        hasMore: data.hasMore,
        loadingOlder: false,
      }));
    } catch {
      patchConvo(peerId, (x) => ({ ...x, loadingOlder: false }));
    }
  }, [patchConvo]);

  const sendMessage = useCallback((to, text) => {
    const socket = socketRef.current;
    if (!socket) return;
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    const optimistic = { _id: tempId, sender: me._id, receiver: to, text, status: 'sending', createdAt: now };

    patchConvo(to, (c) => ({ ...c, messages: [...c.messages, optimistic] }));
    bumpUser(to, { text, createdAt: now, fromMe: true }, 0);

    socket.timeout(8000).emit('message:send', { to, text }, (err, res) => {
      if (err || !res || !res.ok) {
        patchConvo(to, (c) => ({
          ...c,
          messages: c.messages.map((m) => (m._id === tempId ? { ...m, status: 'failed' } : m)),
        }));
        return;
      }
      patchConvo(to, (c) => {
        const real = res.message;
        const seen = new Set();
        const messages = c.messages
          .map((m) => (m._id === tempId ? real : m))
          .filter((m) => (seen.has(m._id) ? false : (seen.add(m._id), true)));
        return { ...c, messages };
      });
    });
  }, [me._id, patchConvo, bumpUser]);

  const retryMessage = useCallback((m) => {
    patchConvo(m.receiver, (c) => ({ ...c, messages: c.messages.filter((x) => x._id !== m._id) }));
    sendMessage(m.receiver, m.text);
  }, [patchConvo, sendMessage]);

  const emitTyping = useCallback((to, isTyping) => {
    socketRef.current?.emit('typing', { to, isTyping });
  }, []);

  // Live presence/lastSeen for the open chat, even if search hides them from the list
  const livePeer = activePeer
    ? usersRef.current.find((u) => u._id === activePeer._id) || activePeer
    : null;

  return (
    <div className={`app ${activePeer ? 'has-active' : ''}`}>
      <Sidebar
        me={me}
        users={users}
        loading={usersLoading}
        search={search}
        onSearch={setSearch}
        activeId={activePeer ? activePeer._id : null}
        onSelect={openConversation}
        onlineIds={onlineIds}
        typing={typing}
        connected={connected}
        onLogout={logout}
      />

      <main className="chat-pane">
        {livePeer ? (
          <ChatWindow
            key={livePeer._id}
            me={me}
            peer={livePeer}
            online={onlineIds.has(livePeer._id)}
            isTyping={!!typing[livePeer._id]}
            convo={convos[livePeer._id] || emptyConvo}
            onSend={(text) => sendMessage(livePeer._id, text)}
            onTyping={(v) => emitTyping(livePeer._id, v)}
            onLoadOlder={loadOlder}
            onRetry={retryMessage}
            onBack={() => setActivePeer(null)}
          />
        ) : (
          <div className="placeholder">
            <h2>Pick someone to talk to</h2>
            <p>Choose a person from the list. Messages arrive instantly, and you will see when they are delivered and read.</p>
          </div>
        )}
      </main>
    </div>
  );
}
