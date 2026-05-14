const express = require('express');
const bcrypt  = require('bcryptjs');
const db      = require('../db');

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: 'Email and password required.' });
    if (password.length < 8)
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing)
      return res.status(409).json({ success: false, error: 'An account with this email already exists.' });

    const hash   = await bcrypt.hash(password, 10);
    const result = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email.toLowerCase(), hash);

    res.json({ success: true, data: { userId: result.lastInsertRowid, email: email.toLowerCase() } });
  } catch (err) {
    console.error('[Auth/signup]', err.message);
    res.status(500).json({ success: false, error: 'Signup failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: 'Email and password required.' });

    const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user)
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });

    res.json({ success: true, data: { userId: user.id, email: user.email } });
  } catch (err) {
    console.error('[Auth/login]', err.message);
    res.status(500).json({ success: false, error: 'Login failed. Please try again.' });
  }
});

module.exports = router;
