import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Avatar from './Avatar';
import Ticks from './Ticks';
import { formatDayLabel, formatLastSeen, formatTime } from '../utils';

export default function ChatWindow({
  me,
  peer,
  online,
  isTyping,
  convo,
  onSend,
  onTyping,
  onLoadOlder,
  onRetry,
  onBack,
}) {
  const [text, setText] = useState('');
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const prev = useRef({ len: 0, last: null, height: 0 });
  const typingRef = useRef(false);
  const stopTimer = useRef(null);

  const messages = convo.messages;

  // Scroll behaviour: stick to bottom for new messages, keep position when older ones load
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const last = messages[messages.length - 1];
    const p = prev.current;
    const prepended = p.len > 0 && last && last._id === p.last && messages.length > p.len;

    if (prepended) {
      el.scrollTop += el.scrollHeight - p.height;
    } else {
      const wasNearBottom = p.height - el.scrollTop - el.clientHeight < 140;
      if (p.len === 0 || wasNearBottom || (last && last.sender === me._id)) {
        el.scrollTop = el.scrollHeight;
      }
    }
    prev.current = { len: messages.length, last: last ? last._id : null, height: el.scrollHeight };
  }, [messages, me._id, isTyping]);

  // Stop "typing…" if this conversation closes
  useEffect(
    () => () => {
      clearTimeout(stopTimer.current);
      if (typingRef.current) onTyping(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e) => {
    setText(e.target.value);
    if (!typingRef.current) {
      typingRef.current = true;
      onTyping(true);
    }
    clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => {
      typingRef.current = false;
      onTyping(false);
    }, 1500);
  };

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setText('');
    clearTimeout(stopTimer.current);
    if (typingRef.current) {
      typingRef.current = false;
      onTyping(false);
    }
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  let lastDay = null;

  return (
    <section className="chat">
      <header className="chat-head">
        <button className="back" onClick={onBack} aria-label="Back to people">‹</button>
        <Avatar name={peer.username} online={online} size={40} />
        <div className="chat-who">
          <strong>{peer.username}</strong>
          <span className={`chat-sub ${isTyping || online ? 'is-live' : ''}`}>
            {isTyping ? 'typing…' : online ? 'Online' : formatLastSeen(peer.lastSeen)}
          </span>
        </div>
      </header>

      <div className="messages" ref={listRef}>
        {convo.hasMore && (
          <button className="load-older" onClick={onLoadOlder} disabled={convo.loadingOlder}>
            {convo.loadingOlder ? 'Loading…' : 'Load earlier messages'}
          </button>
        )}

        {convo.loading && <p className="messages-note">Loading conversation…</p>}
        {!convo.loading && messages.length === 0 && (
          <p className="messages-note">
            No messages yet. Send the first message to {peer.username}.
          </p>
        )}

        {messages.map((m) => {
          const mine = m.sender === me._id;
          const day = new Date(m.createdAt).toDateString();
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m._id} className="msg-wrap">
              {showDay && <div className="day"><span>{formatDayLabel(m.createdAt)}</span></div>}
              <div className={`bubble-row ${mine ? 'mine' : 'theirs'}`}>
                <div className={`bubble ${m.status === 'failed' ? 'is-failed' : ''}`}>
                  <span className="bubble-text">{m.text}</span>
                  <span className="bubble-meta">
                    <time>{formatTime(m.createdAt)}</time>
                    {mine && <Ticks status={m.status} />}
                  </span>
                </div>
                {m.status === 'failed' && (
                  <button className="retry" onClick={() => onRetry(m)}>Not sent. Tap to retry</button>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="bubble-row theirs">
            <div className="bubble typing-bubble" aria-label={`${peer.username} is typing`}>
              <i /><i /><i />
            </div>
          </div>
        )}
      </div>

      <footer className="composer">
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          placeholder={`Message ${peer.username}`}
          maxLength={2000}
          aria-label="Message"
        />
        <button className="send" onClick={submit} disabled={!text.trim()}>Send</button>
      </footer>
    </section>
  );
}
