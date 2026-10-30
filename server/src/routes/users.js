const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const Message = require('../models/Message');
const auth = require('../middleware/auth');
const { escapeRegex } = require('../utils');

const router = express.Router();
router.use(auth);

// GET /api/users?search=ann
// Every other user, with unread count and last message per conversation.
router.get('/', async (req, res) => {
  try {
    const me = new mongoose.Types.ObjectId(req.user.id);
    const search = String(req.query.search || '').trim().slice(0, 50);

    const filter = { _id: { $ne: me } };
    if (search) filter.username = new RegExp(escapeRegex(search), 'i');

    const [users, unread, last] = await Promise.all([
      User.find(filter).sort({ username: 1 }).limit(100),
      Message.aggregate([
        { $match: { receiver: me, status: { $ne: 'read' } } },
        { $group: { _id: '$sender', count: { $sum: 1 } } },
      ]),
      Message.aggregate([
        { $match: { $or: [{ sender: me }, { receiver: me }] } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: { $cond: [{ $eq: ['$sender', me] }, '$receiver', '$sender'] },
            text: { $first: '$text' },
            sender: { $first: '$sender' },
            createdAt: { $first: '$createdAt' },
          },
        },
      ]),
    ]);

    const unreadMap = new Map(unread.map((u) => [String(u._id), u.count]));
    const lastMap = new Map(last.map((l) => [String(l._id), l]));

    const result = users.map((u) => {
      const l = lastMap.get(String(u._id));
      return {
        ...u.toPublic(),
        unreadCount: unreadMap.get(String(u._id)) || 0,
        lastMessage: l
          ? { text: l.text, createdAt: l.createdAt, fromMe: String(l.sender) === String(me) }
          : null,
      };
    });

    // Conversations first (most recent on top), then everyone else A–Z
    result.sort((a, b) => {
      if (a.lastMessage && b.lastMessage)
        return new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt);
      if (a.lastMessage) return -1;
      if (b.lastMessage) return 1;
      return a.username.localeCompare(b.username);
    });

    res.json({ users: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load users' });
  }
});

module.exports = router;
