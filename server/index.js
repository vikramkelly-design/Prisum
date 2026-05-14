const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3002;

// CORS — allow Prism frontend during development (mirrors Atlas CORS pattern)
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5174',
}));

app.use(express.json({ limit: '1mb' }));

// Routes
app.use('/api/analyze', require('./routes/analyze'));
app.use('/api/auth',    require('./routes/auth'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'prism-server', timestamp: new Date().toISOString() });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(`[Error] ${req.method} ${req.path}:`, err.message);
  res.status(500).json({ success: false, error: err.message || 'Internal server error' });
});

const server = app.listen(PORT, () => {
  console.log(`Prism server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use.`);
    console.error(`  Run this to free it:  lsof -ti:${PORT} | xargs kill -9\n`);
    process.exit(1);
  } else {
    throw err;
  }
});
