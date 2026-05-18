const express = require('express');
const jwt     = require('jsonwebtoken');
const Stripe  = require('stripe');
const db      = require('../db');

const router     = express.Router();
const stripe     = Stripe(process.env.STRIPE_SECRET_KEY);
const JWT_SECRET = process.env.JWT_SECRET || 'prism-dev-secret-change-in-prod';
const PRICE_ID   = process.env.STRIPE_PRICE_ID || 'price_1TYFi6IEQjV1WNJI3UiLvoEf';

function getUserFromToken(req) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return jwt.verify(header.slice(7), JWT_SECRET);
  } catch { return null }
}

// POST /api/billing/checkout — create Stripe Checkout session
router.post('/checkout', async (req, res) => {
  try {
    const payload = getUserFromToken(req);
    if (!payload)
      return res.status(401).json({ success: false, error: 'Sign in to subscribe.' });

    const user = await db.findUserById(payload.userId);
    if (!user)
      return res.status(401).json({ success: false, error: 'Account not found.' });

    const origin = req.headers.origin || process.env.APP_URL || 'https://prisum-app-production.up.railway.app';

    const session = await stripe.checkout.sessions.create({
      mode:               'subscription',
      payment_method_types: ['card'],
      line_items:         [{ price: PRICE_ID, quantity: 1 }],
      customer_email:     user.email,
      success_url:        `${origin}/app?upgraded=1`,
      cancel_url:         `${origin}/app`,
      metadata:           { userId: String(user.id) },
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (err) {
    console.error('[Billing/checkout]', err.message);
    res.status(500).json({ success: false, error: 'Could not create checkout session.' });
  }
});

// POST /api/billing/portal — customer portal to manage/cancel subscription
router.post('/portal', async (req, res) => {
  try {
    const payload = getUserFromToken(req);
    if (!payload) return res.status(401).json({ success: false, error: 'Not authenticated.' });

    const user = await db.findUserById(payload.userId);
    if (!user?.stripe_customer_id)
      return res.status(400).json({ success: false, error: 'No active subscription found.' });

    const origin = req.headers.origin || process.env.APP_URL || 'https://prisum-app-production.up.railway.app';

    const session = await stripe.billingPortal.sessions.create({
      customer:   user.stripe_customer_id,
      return_url: `${origin}/app`,
    });

    res.json({ success: true, data: { url: session.url } });
  } catch (err) {
    console.error('[Billing/portal]', err.message);
    res.status(500).json({ success: false, error: 'Could not open billing portal.' });
  }
});

// POST /api/billing/webhook — Stripe sends events here
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = secret
      ? stripe.webhooks.constructEvent(req.body, sig, secret)
      : JSON.parse(req.body);
  } catch (err) {
    console.error('[Webhook] signature error:', err.message);
    return res.status(400).send('Webhook signature error');
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session  = event.data.object;
        const userId   = parseInt(session.metadata?.userId, 10);
        if (!userId) break;
        await db.updateSubscription(userId, {
          stripeCustomerId: session.customer,
          status: 'pro',
        });
        console.log(`[Billing] User ${userId} upgraded to pro`);
        break;
      }

      case 'customer.subscription.deleted':
      case 'customer.subscription.paused': {
        const sub  = event.data.object;
        const user = await db.findUserByStripeCustomer(sub.customer);
        if (user) {
          await db.updateSubscription(user.id, { status: 'free' });
          console.log(`[Billing] User ${user.id} downgraded to free`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub    = event.data.object;
        const user   = await db.findUserByStripeCustomer(sub.customer);
        if (user) {
          const status = sub.status === 'active' ? 'pro' : 'free';
          await db.updateSubscription(user.id, { status });
        }
        break;
      }
    }
  } catch (err) {
    console.error('[Webhook] handler error:', err.message);
  }

  res.json({ received: true });
});

module.exports = router;
