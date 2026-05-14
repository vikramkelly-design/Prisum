const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { analyze } = require('../services/correlationEngine');
const { generateVerdict } = require('../services/verdictGenerator');

const router = express.Router();

// 10 analyses per IP per 10 minutes — tight because each call hits Yahoo + Claude
const analyzeLimiter = rateLimit({
  windowMs:         10 * 60 * 1000,
  max:              10,
  standardHeaders:  true,
  legacyHeaders:    false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error:   'Too many analyses. You can run up to 10 per 10 minutes — please wait a moment.',
    });
  },
});

// POST /api/analyze
// Body: { tickers: ["AAPL", "NVDA", ...] }
router.post('/', analyzeLimiter, async (req, res) => {
  try {
    const { tickers, shares = {} } = req.body;

    if (!Array.isArray(tickers) || tickers.length === 0) {
      return res.status(400).json({ success: false, error: 'tickers must be a non-empty array' });
    }

    if (tickers.length < 2) {
      return res.status(400).json({ success: false, error: 'Portfolio must contain at least 2 tickers' });
    }

    if (tickers.length > 20) {
      return res.status(400).json({ success: false, error: 'Maximum 20 tickers per analysis' });
    }

    // Step 1: Run correlation engine
    const engineResult = await analyze(tickers, shares);

    // Step 2: Generate AI verdict (runs in parallel-safe — engine is already complete)
    const { verdict, explanation } = await generateVerdict(engineResult);

    res.json({
      success: true,
      data: {
        ...engineResult,
        verdict,
        explanation,
      },
    });
  } catch (err) {
    console.error('[/api/analyze]', err.message);
    res.status(400).json({ success: false, error: err.message });
  }
});

module.exports = router;
