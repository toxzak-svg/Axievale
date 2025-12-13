const config = require('../config');

// Lazy-load pg to avoid failing when not installed in development
let pg;
try { pg = require('pg'); } catch (e) { pg = null; }

if (!pg) {
  module.exports = null; // caller should fallback to file store
} else {
  const { Pool } = pg;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  async function createUser({ email } = {}) {
    const id = require('crypto').randomUUID();
    const apiKey = require('crypto').randomBytes(24).toString('hex');
    const trial = parseInt(config.trialRequests || 100, 10);
    await pool.query(
      'INSERT INTO users (id, email, api_key, is_paid, trial_remaining) VALUES ($1,$2,$3,false,$4)',
      [id, email || null, apiKey, trial]
    );
    return { id, email: email || null, apiKey, trialRemaining: trial };
  }

  async function getUserById(id) {
    const res = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
    return res.rows[0] || null;
  }

  async function getUserByApiKey(key) {
    const res = await pool.query('SELECT * FROM users WHERE api_key=$1', [key]);
    return res.rows[0] || null;
  }

  async function activateUser(id) {
    await pool.query('UPDATE users SET is_paid=true WHERE id=$1', [id]);
    const res = await pool.query('SELECT * FROM users WHERE id=$1', [id]);
    return res.rows[0] || null;
  }

  async function decrementTrial(id) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const r = await client.query('SELECT trial_remaining FROM users WHERE id=$1 FOR UPDATE', [id]);
      if (!r.rows[0]) { await client.query('ROLLBACK'); return null; }
      let remaining = r.rows[0].trial_remaining || 0;
      if (remaining > 0) {
        remaining -= 1;
        await client.query('UPDATE users SET trial_remaining=$1 WHERE id=$2', [remaining, id]);
        await client.query('INSERT INTO usage_events (user_id, event_type, value) VALUES ($1,$2,$3)', [id, 'extension_request', 1]);
        await client.query('COMMIT');
        return remaining;
      }
      await client.query('ROLLBACK');
      return 0;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async function listUsers() {
    const res = await pool.query('SELECT id, email, is_paid, trial_remaining, created_at FROM users ORDER BY created_at DESC LIMIT 1000');
    return res.rows || [];
  }

  async function getUsageTotals(userId) {
    const res = await pool.query('SELECT event_type, SUM(value) as total FROM usage_events WHERE user_id=$1 GROUP BY event_type', [userId]);
    return res.rows || [];
  }

  module.exports = {
    createUser,
    getUserById,
    getUserByApiKey,
    activateUser,
    decrementTrial
  };
}
