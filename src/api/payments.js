const express = require('express');
const router = express.Router();
const config = require('../config');

// Lazy load stripe only when configured
let stripe = null;
try {
  if (config.stripeSecret) {
    const Stripe = require('stripe');
    stripe = Stripe(config.stripeSecret);
    console.log('[payments] Stripe initialized');
  }
} catch (e) {
  stripe = null;
  console.warn('[payments] stripe package missing or failed to initialize:', e && e.message ? e.message : e);
}

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
  const webhookSecret = config.stripeWebhookSecret;
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

/**
 * POST /api/payments/create-checkout-session
 * Body: { userId, priceId?, amount?, successUrl?, cancelUrl? }
 * Creates a Stripe Checkout Session with metadata.userId so webhook can activate the user.
 */
router.post('/create-checkout-session', async (req, res) => {
  if (!stripe) return res.status(501).json({ success: false, error: 'Stripe not configured' });

  const { userId, priceId, amount, successUrl, cancelUrl } = req.body || {};
  if (!userId) return res.status(400).json({ success: false, error: 'userId required' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        priceId ? { price: priceId, quantity: 1 } : { price_data: { currency: 'usd', product_data: { name: 'Axievale subscription' }, unit_amount: Math.round((amount || 100) * 100) }, quantity: 1 }
      ],
      metadata: { userId },
      success_url: successUrl || (process.env.SUCCESS_URL || 'https://example.com/success'),
      cancel_url: cancelUrl || (process.env.CANCEL_URL || 'https://example.com/cancel')
    });

    res.json({ success: true, data: { id: session.id, url: session.url } });
  } catch (err) {
    console.error('Error creating stripe session:', err && err.message ? err.message : err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
