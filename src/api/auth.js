const express = require('express');
const router = express.Router();
const userStore = require('../services/userStore');
const config = require('../config');

// Lazy require jsonwebtoken
let jwt;
try { jwt = require('jsonwebtoken'); } catch (e) { jwt = null; }

/**
 * POST /api/auth/login
 * Body: { userId, apiKey }
 * Returns: { token }
 */
router.post('/login', async (req, res) => {
  try {
    const { userId, apiKey } = req.body || {};
    if (!userId || !apiKey) return res.status(400).json({ success: false, error: 'userId and apiKey required' });

    const user = await userStore.getUserById(userId);
    if (!user || user.apiKey !== apiKey) return res.status(401).json({ success: false, error: 'Invalid credentials' });

    if (!jwt) return res.status(501).json({ success: false, error: 'JWT support not installed' });

    const token = jwt.sign({ sub: user.id, isPaid: user.is_paid || user.isPaid || false }, config.jwtSecret || 'dev-secret', { expiresIn: '1h' });
    res.json({ success: true, data: { token } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
