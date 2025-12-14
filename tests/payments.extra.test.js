const request = require('supertest');

describe('Payments extra coverage', () => {
  test('create-checkout-session with priceId and error path', async () => {
    const express = require('express');

    // success path with priceId
    await jest.isolateModulesAsync(async () => {
      jest.mock('../src/config', () => ({ stripeSecret: 'sk', stripeWebhookSecret: null }));
      jest.mock('stripe', () => {
        return function Stripe(secret) {
          return { checkout: { sessions: { create: async (opts) => ({ id: 's1', url: 'u' }) } }, webhooks: { constructEvent: (b) => JSON.parse(b) } };
        };
      }, { virtual: true });

      const payments = require('../src/api/payments');
      const app = express();
      app.use(express.json());
      app.use('/api/payments', payments);

      const res = await request(app).post('/api/payments/create-checkout-session').send({ userId: 'u1', priceId: 'price_1' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    // error path when stripe throws
    await jest.isolateModulesAsync(async () => {
      jest.mock('../src/config', () => ({ stripeSecret: 'sk', stripeWebhookSecret: null }));
      jest.mock('stripe', () => {
        return function Stripe(secret) {
          return { checkout: { sessions: { create: async () => { throw new Error('boom'); } } }, webhooks: { constructEvent: (b) => JSON.parse(b) } };
        };
      }, { virtual: true });

      const payments = require('../src/api/payments');
      const app = express();
      app.use(express.json());
      app.use('/api/payments', payments);

      const res = await request(app).post('/api/payments/create-checkout-session').send({ userId: 'u1', amount: 2 });
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  test('webhook activates user when webhook secret present (constructEvent success)', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.mock('../src/config', () => ({ stripeSecret: 'sk', stripeWebhookSecret: 'whsec' }));
        const mockStore = { activateUser: jest.fn().mockResolvedValue(true) };
        const userStorePath = require.resolve('../src/services/userStore');
        jest.doMock(userStorePath, () => mockStore);

      jest.mock('stripe', () => {
        return function Stripe(secret) {
          return { checkout: { sessions: { create: async () => ({ id: 's' }) } }, webhooks: { constructEvent: (body, sig, secret) => ({ type: 'payment_intent.succeeded', data: { object: { metadata: { userId: 'uid' } } } }) } };
        };
      }, { virtual: true });

      const express = require('express');
      const payments = require('../src/api/payments');
      const app = express();
      app.use('/api/payments', payments);

      const payload = JSON.stringify({});
      const res = await request(app).post('/api/payments/webhook').set('stripe-signature', 'sig').send(payload);
      expect(res.status).toBe(200);
      expect(res.body.received).toBe(true);
      expect(mockStore.activateUser).toHaveBeenCalledWith('uid');
    });
  });

  test('webhook with webhook secret uses constructEvent and handles signature error', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.mock('../src/config', () => ({ stripeSecret: 'sk', stripeWebhookSecret: 'whsec' }));
      jest.mock('stripe', () => {
        return function Stripe(secret) {
          return { checkout: { sessions: { create: async () => ({ id: 's' }) } }, webhooks: { constructEvent: () => { throw new Error('bad sig'); } } };
        };
      }, { virtual: true });

      const express = require('express');
      const payments = require('../src/api/payments');
      const app = express();
      app.use('/api/payments', payments);

      const payload = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { metadata: { userId: 'uid' } } } });
      const res = await request(app).post('/api/payments/webhook').set('stripe-signature', 'sig').send(payload);
      expect(res.status).toBe(400);
    });
  });
});
