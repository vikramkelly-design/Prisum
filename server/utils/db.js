const { Pool } = require('pg');

let pool = null;

function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      console.warn('[DB] DATABASE_URL not set — price caching disabled');
      return null;
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 5,
    });
  }
  return pool;
}

async function ensureSchema() {
  const p = getPool();
  if (!p) return;
  await p.query(`
    CREATE TABLE IF NOT EXISTS price_cache (
      ticker       TEXT PRIMARY KEY,
      returns      JSONB NOT NULL,
      last_close   NUMERIC NOT NULL,
      price_series JSONB NOT NULL,
      fetched_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      data_to      TEXT NOT NULL
    )
  `);
  console.log('[DB] price_cache table ready');
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

async function getCached(ticker) {
  const p = getPool();
  if (!p) return null;
  try {
    const { rows } = await p.query(
      'SELECT * FROM price_cache WHERE ticker = $1',
      [ticker]
    );
    if (!rows.length) return null;
    const row = rows[0];
    const age = Date.now() - new Date(row.fetched_at).getTime();
    if (age > CACHE_TTL_MS) return null; // stale
    return {
      returns:     row.returns,
      lastClose:   parseFloat(row.last_close),
      priceSeries: row.price_series,
    };
  } catch (err) {
    console.error('[DB] getCached error:', err.message);
    return null; // cache miss on error — fall through to live fetch
  }
}

async function setCached(ticker, { returns, lastClose, priceSeries, dataTo }) {
  const p = getPool();
  if (!p) return;
  try {
    await p.query(`
      INSERT INTO price_cache (ticker, returns, last_close, price_series, fetched_at, data_to)
      VALUES ($1, $2, $3, $4, NOW(), $5)
      ON CONFLICT (ticker) DO UPDATE SET
        returns      = EXCLUDED.returns,
        last_close   = EXCLUDED.last_close,
        price_series = EXCLUDED.price_series,
        fetched_at   = NOW(),
        data_to      = EXCLUDED.data_to
    `, [ticker, JSON.stringify(returns), lastClose, JSON.stringify(priceSeries), dataTo]);
  } catch (err) {
    console.error('[DB] setCached error:', err.message);
  }
}

module.exports = { getPool, ensureSchema, getCached, setCached };
