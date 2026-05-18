const express    = require('express');
const rateLimit  = require('express-rate-limit');
const jwt        = require('jsonwebtoken');
const { analyze } = require('../services/correlationEngine');
const { generateVerdict } = require('../services/verdictGenerator');
const db         = require('../db');

const router     = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'prism-dev-secret-change-in-prod';

const FREE_TICKER_LIMIT = 10;
const PRO_TICKER_LIMIT  = 20;

// 3 analyses per IP per day for free users; pro users get 200
const freeLimiter = rateLimit({
  windowMs:        24 * 60 * 60 * 1000,
  max:             3,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            (req) => req.isPro,   // skip for pro users
  handler: (req, res) => {
    res.status(429).json({
      success:    false,
      error:      'Free accounts are limited to 3 analyses per day. Upgrade to Pro for unlimited analyses.',
      upgradeRequired: true,
    });
  },
});

const generalLimiter = rateLimit({
  windowMs:        10 * 60 * 1000,
  max:             50,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    res.status(429).json({ success: false, error: 'Too many requests. Please wait a moment.' });
  },
});

// Middleware: read JWT if present, attach isPro + userId to req
function resolveUser(req, res, next) {
  req.isPro   = false;
  req.userId  = null;
  try {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const payload = jwt.verify(header.slice(7), JWT_SECRET);
      req.userId = payload.userId;
    }
  } catch { /* invalid token — treat as anonymous */ }
  next();
}

async function attachProStatus(req, res, next) {
  if (req.userId) {
    try {
      const user = await db.findUserById(req.userId);
      req.isPro = user?.subscription_status === 'pro';
    } catch { req.isPro = false; }
  }
  next();
}

// POST /api/analyze
router.post('/', resolveUser, attachProStatus, generalLimiter, freeLimiter, async (req, res) => {
  try {
    const { tickers, shares = {} } = req.body;
    const isPro = req.isPro;

    if (!Array.isArray(tickers) || tickers.length === 0)
      return res.status(400).json({ success: false, error: 'tickers must be a non-empty array' });

    if (tickers.length < 2)
      return res.status(400).json({ success: false, error: 'Portfolio must contain at least 2 tickers' });

    const limit = isPro ? PRO_TICKER_LIMIT : FREE_TICKER_LIMIT;
    if (tickers.length > limit) {
      return res.status(400).json({
        success: false,
        error: isPro
          ? `Maximum ${PRO_TICKER_LIMIT} tickers per analysis`
          : `Free accounts support up to ${FREE_TICKER_LIMIT} tickers. Upgrade to Pro for up to 20.`,
        upgradeRequired: !isPro,
      });
    }

    const engineResult  = await analyze(tickers, shares);
    const { verdict, explanation } = await generateVerdict(engineResult);

    // Strip premium fields for free users
    const data = { ...engineResult, verdict };
    if (isPro) {
      data.explanation = explanation;
    } else {
      delete data.priceSeries; // no deep dive for free
    }

    res.json({ success: true, data: { ...data, isPro } });
  } catch (err) {
    console.error('[/api/analyze]', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
