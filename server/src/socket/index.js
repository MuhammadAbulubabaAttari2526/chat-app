const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const { verifyToken, serializeMessage } = require('../utils');

// userId -> Set of socket ids (a user can have several tabs/devices open)
const onlineUsers = new Map();

module.exports = function initSocket(io) {
  // --- Authenticate every connection with the JWT sent in `auth.token`
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication required'));
      const { id } = verifyToken(token);
      const user = await User.findById(id);
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const uid = String(socket.user._id);
    socket.join(`user:${uid}`);

    // ---- Presence: first tab online => broadcast
    const sockets = onlineUsers.get(uid) || new Set();
    sockets.add(socket.id);
    onlineUsers.set(uid, sockets);

    // Runs after every handler below is registered, so a socket that drops
    // mid-setup (e.g. React StrictMode's double mount) still triggers 'disconnect'.
    const setup = async () => {
      try {
      if (sockets.size === 1 && onlineUsers.get(uid)?.has(socket.id)) {
        await User.findByIdAndUpdate(uid, { isOnline: true });
        socket.broadcast.emit('presence:update', { userId: uid, isOnline: true });
      }
      socket.emit('presence:list', [...onlineUsers.keys()]);

      // ---- Anything sent to me while I was offline is now "delivered"
      const pending = await Message.find({ receiver: uid, status: 'sent' }).select('_id sender');
      if (pending.length) {
        const now = new Date();
        await Message.updateMany(
          { _id: { $in: pending.map((m) => m._id) } },
          { status: 'delivered', deliveredAt: now }
        );
        const bySender = new Map();
        pending.forEach((m) => {
          const s = String(m.sender);
          if (!bySender.has(s)) bySender.set(s, []);
          bySender.get(s).push(String(m._id));
        });
        bySender.forEach((ids, senderId) => {
          io.to(`user:${senderId}`).emit('message:status', {
            ids,
            status: 'delivered',
            conversationWith: uid,
          });
        });
      }
      } catch (err) {
        console.error('connection setup error', err);
      }
    };

    // ---- Send a message
    socket.on('message:send', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : () => {};
      try {
        const to = payload && String(payload.to || '');
        const text = payload && typeof payload.text === 'string' ? payload.text.trim() : '';
        if (!mongoose.isValidObjectId(to) || to === uid)
          return reply({ ok: false, error: 'Invalid recipient' });
        if (!text || text.length > 2000)
          return reply({ ok: false, error: 'Message must be 1–2000 characters' });
        if (!(await User.exists({ _id: to })))
          return reply({ ok: false, error: 'Recipient not found' });

        const msg = await Message.create({ sender: uid, receiver: to, text });

        // Recipient has at least one live socket => delivered right away
        if (onlineUsers.has(to)) {
          msg.status = 'delivered';
          msg.deliveredAt = new Date();
          await msg.save();
        }

        const out = serializeMessage(msg);
        io.to(`user:${to}`).emit('message:new', out);
        socket.to(`user:${uid}`).emit('message:new', out); // my other tabs
        reply({ ok: true, message: out });
      } catch (err) {
        console.error('message:send error', err);
        reply({ ok: false, error: 'Could not send message' });
      }
    });

    // ---- I opened/read a conversation: mark their messages as read
    socket.on('message:read', async (payload) => {
      try {
        const from = payload && String(payload.from || '');
        if (!mongoose.isValidObjectId(from)) return;

        const unread = await Message.find({
          sender: from,
          receiver: uid,
          status: { $ne: 'read' },
        }).select('_id');
        if (unread.length) {
          const now = new Date();
          await Message.updateMany(
            { _id: { $in: unread.map((m) => m._id) } },
            { status: 'read', readAt: now }
          );
          io.to(`user:${from}`).emit('message:status', {
            ids: unread.map((m) => String(m._id)),
            status: 'read',
            conversationWith: uid,
          });
        }
        // Keep my other tabs' unread badges in sync
        socket.to(`user:${uid}`).emit('conversation:read', { with: from });
      } catch (err) {
        console.error('message:read error', err);
      }
    });

    // ---- Typing indicator (not persisted)
    socket.on('typing', (payload) => {
      const to = payload && String(payload.to || '');
      if (!mongoose.isValidObjectId(to)) return;
      io.to(`user:${to}`).emit('typing', { from: uid, isTyping: !!payload.isTyping });
    });

    // ---- Disconnect: last tab closed => offline
    socket.on('disconnect', async () => {
      const set = onlineUsers.get(uid);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          onlineUsers.delete(uid);
          const lastSeen = new Date();
          try {
            await User.findByIdAndUpdate(uid, { isOnline: false, lastSeen });
          } catch (err) {
            console.error('disconnect update error', err);
          }
          socket.broadcast.emit('presence:update', { userId: uid, isOnline: false, lastSeen });
          socket.broadcast.emit('typing', { from: uid, isTyping: false });
        }
      }
    });

    setup();
  });
};
