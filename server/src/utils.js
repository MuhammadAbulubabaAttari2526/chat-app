const jwt = require('jsonwebtoken');

exports.signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

exports.verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

exports.escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

exports.serializeMessage = (m) => ({
  _id: String(m._id),
  sender: String(m.sender),
  receiver: String(m.receiver),
  text: m.text,
  status: m.status,
  deliveredAt: m.deliveredAt || null,
  readAt: m.readAt || null,
  createdAt: m.createdAt,
});
