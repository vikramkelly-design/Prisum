const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const db       = require('../db');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'prism-dev-secret-change-in-prod';

function signToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: 'Email and password required.' });
    if (password.length < 8)
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });

    const existing = await db.findUserByEmail(email);
    if (existing)
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });

    const hash = await bcrypt.hash(password, 10);
    const user = await db.createUser(email, hash);
    const token = signToken(user);

    res.json({ success: true, data: { token, email: user.email, subscriptionStatus: user.subscription_status } });
  } catch (err) {
    console.error('[Auth/signup]', err.message);
    res.status(500).json({ success: false, error: 'Signup failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: 'Email and password required.' });

    const user = await db.findUserByEmail(email);
    if (!user)
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const token = signToken(user);
    res.json({ success: true, data: { token, email: user.email, subscriptionStatus: user.subscription_status } });
  } catch (err) {
    console.error('[Auth/login]', err.message);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me — verify token and return current user status
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer '))
      return res.json({ success: true, data: null });

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await db.findUserById(payload.userId);
    if (!user) return res.json({ success: true, data: null });

    res.json({ success: true, data: { email: user.email, subscriptionStatus: user.subscription_status } });
  } catch {
    res.json({ success: true, data: null });
  }
});

module.exports = router;
