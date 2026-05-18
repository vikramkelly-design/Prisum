const { getPool, ensureSchema: ensurePriceCache } = require('./utils/db');

async function ensureSchema() {
  const pool = getPool();
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                  SERIAL PRIMARY KEY,
      email               TEXT UNIQUE NOT NULL,
      password_hash       TEXT NOT NULL,
      stripe_customer_id  TEXT,
      subscription_status TEXT NOT NULL DEFAULT 'free',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await ensurePriceCache();
  console.log('[DB] users table ready');
}

async function findUserByEmail(email) {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE email = $1',
    [email.toLowerCase()]
  );
  return rows[0] || null;
}

async function findUserById(id) {
  const pool = getPool();
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createUser(email, passwordHash) {
  const pool = getPool();
  const { rows } = await pool.query(
    'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *',
    [email.toLowerCase(), passwordHash]
  );
  return rows[0];
}

async function updateSubscription(userId, { stripeCustomerId, status }) {
  const pool = getPool();
  await pool.query(
    `UPDATE users SET
       stripe_customer_id  = COALESCE($2, stripe_customer_id),
       subscription_status = $3
     WHERE id = $1`,
    [userId, stripeCustomerId || null, status]
  );
}

async function findUserByStripeCustomer(customerId) {
  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT * FROM users WHERE stripe_customer_id = $1',
    [customerId]
  );
  return rows[0] || null;
}

module.exports = {
  ensureSchema,
  findUserByEmail,
  findUserById,
  createUser,
  updateSubscription,
  findUserByStripeCustomer,
};
