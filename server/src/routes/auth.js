const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { signToken, escapeRegex } = require('../utils');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many attempts. Try again in a few minutes.' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', limiter, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (username.length < 3 || username.length > 30)
      return res.status(400).json({ message: 'Username must be 3–30 characters' });
    if (!EMAIL_RE.test(email))
      return res.status(400).json({ message: 'Enter a valid email address' });
    if (password.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const exists = await User.findOne({
      $or: [{ email }, { username: new RegExp(`^${escapeRegex(username)}$`, 'i') }],
    });
    if (exists)
      return res.status(409).json({ message: 'Username or email is already taken' });

    const user = await User.create({ username, email, password });
    res.status(201).json({ token: signToken(user._id), user: user.toPublic() });
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: 'Username or email is already taken' });
    console.error(err);
    res.status(500).json({ message: 'Could not create account' });
  }
});

router.post('/login', limiter, async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.matchPassword(password)))
      return res.status(401).json({ message: 'Incorrect email or password' });

    res.json({ token: signToken(user._id), user: user.toPublic() });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not log in' });
  }
});

router.get('/me', auth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

module.exports = router;
