const express = require('express');
const router = express.Router();
const config = require('../config');

// Lazy load stripe
let stripe = null;
try { stripe = require('stripe')(process.env.STRIPE_SECRET); } catch (e) { stripe = null; }

// userStore (db or json)
let userStore = null;
try { const db = require('../services/userStoreDb'); if (db) userStore = db; } catch (e) {}
if (!userStore) userStore = require('../services/userStore');

/**
 * POST /api/payments/webhook
 * Stripe webhook handler (optional). Ensure STRIPE_WEBHOOK_SECRET is set and the checkout session
 * includes metadata.userId for which account to activate.
 */
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(501).send('Stripe not configured');

  const sig = req.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  let event;

  try {
    if (webhookSecret) event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    else event = req.body;
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed or payment_intent.succeeded
  const type = event.type || (event.data && event.data.type);
  try {
    if (type === 'checkout.session.completed' || type === 'payment_intent.succeeded') {
      const object = event.data.object;
      const metadata = object.metadata || {};
      const userId = metadata.userId || metadata.user_id;
      if (userId) {
        await userStore.activateUser(userId);
        console.log(`[payments] activated user ${userId} via webhook`);
      }
    }
  } catch (err) {
    console.error('Error handling stripe webhook:', err.message);
    // continue to respond 200 to acknowledge webhook to Stripe
  }

  res.json({ received: true });
});

module.exports = router;
