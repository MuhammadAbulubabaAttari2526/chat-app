const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const auth = require('../middleware/auth');
const { serializeMessage } = require('../utils');

const router = express.Router();
router.use(auth);

// GET /api/messages/:userId?before=<ISO date>&limit=30
// Returns oldest -> newest. Use `before` to page back through history.
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.isValidObjectId(userId))
      return res.status(400).json({ message: 'Invalid user id' });

    const me = req.user._id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);

    const query = {
      $or: [
        { sender: me, receiver: userId },
        { sender: userId, receiver: me },
      ],
    };
    if (req.query.before) {
      const before = new Date(req.query.before);
      if (!isNaN(before)) query.createdAt = { $lt: before };
    }

    const docs = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1);

    const hasMore = docs.length > limit;
    const messages = docs.slice(0, limit).reverse().map(serializeMessage);
    res.json({ messages, hasMore });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load messages' });
  }
});

module.exports = router;
