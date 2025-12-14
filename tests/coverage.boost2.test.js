const request = require('supertest');

describe('Targeted coverage tests', () => {
  test('userStoreDb exports and functions when pg present', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.mock('pg', () => {
        return {
          Pool: class {
            constructor() {}
            async query(sql, params) {
              if (/INSERT INTO users/.test(sql)) return { rows: [] };
              if (/SELECT \* FROM users WHERE id=\$1/.test(sql)) return { rows: [{ id: params[0], email: 'e@test', api_key: 'k', trial_remaining: 3 }] };
              if (/SELECT \* FROM users WHERE api_key=\$1/.test(sql)) return { rows: [{ id: 'uid', email: 'e@test', api_key: params[0], trial_remaining: 3 }] };
              if (/UPDATE users SET is_paid/.test(sql)) return { rows: [] };
              if (/SELECT event_type/.test(sql)) return { rows: [] };
              return { rows: [] };
            }
            async connect() {
              return {
                query: async (sql, params) => {
                  if (/SELECT trial_remaining FROM users/.test(sql)) return { rows: [{ trial_remaining: 2 }] };
                  return { rows: [] };
                },
                release: () => {}
              };
            }
          }
        };
      }, { virtual: true });

      const userStoreDb = require('../src/services/userStoreDb');
      expect(userStoreDb).toBeTruthy();

      const created = await userStoreDb.createUser({ email: 'a@b.com' });
      expect(created).toHaveProperty('id');
      expect(created).toHaveProperty('apiKey');

      const byId = await userStoreDb.getUserById(created.id);
      expect(byId).toHaveProperty('email');

      const byKey = await userStoreDb.getUserByApiKey('k');
      expect(byKey).toHaveProperty('api_key');

      const activated = await userStoreDb.activateUser(created.id);
      expect(activated).not.toBeNull();

      const remaining = await userStoreDb.decrementTrial(created.id);
      expect(typeof remaining).toBe('number');
    });
  });

  test('payments routes handle missing and present stripe', async () => {
    const express = require('express');

    // Missing stripe path
    await jest.isolateModulesAsync(async () => {
      jest.mock('../src/config', () => ({ stripeSecret: null, stripeWebhookSecret: null }));
      const payments = require('../src/api/payments');
      const app = express();
      app.use('/api/payments', payments);

      const res = await request(app).post('/api/payments/create-checkout-session').send({});
      expect(res.status).toBe(501);
    });

    // Stripe present: create session and missing userId
    await jest.isolateModulesAsync(async () => {
      jest.mock('../src/config', () => ({ stripeSecret: 'sk_test', stripeWebhookSecret: null }));
      jest.mock('stripe', () => {
        return function Stripe(secret) {
          return {
            checkout: { sessions: { create: async () => ({ id: 'sess', url: 'https://ok' }) } },
            webhooks: { constructEvent: (body) => JSON.parse(body) }
          };
        };
      }, { virtual: true });

      const payments = require('../src/api/payments');
      const app = express();
      app.use(express.json());
      app.use('/api/payments', payments);

      const r1 = await request(app).post('/api/payments/create-checkout-session').send({});
      expect(r1.status).toBe(400);

      const r2 = await request(app).post('/api/payments/create-checkout-session').send({ userId: 'u1', amount: 1 });
      expect(r2.status).toBe(200);
      expect(r2.body.success).toBe(true);
    });

    // Webhook signature failure
    await jest.isolateModulesAsync(async () => {
      jest.mock('../src/config', () => ({ stripeSecret: 'sk_test', stripeWebhookSecret: 'whsec' }));
      jest.mock('stripe', () => {
        return function Stripe(secret) {
          return {
            checkout: { sessions: { create: async () => ({ id: 'sess', url: 'https://ok' }) } },
            webhooks: { constructEvent: () => { throw new Error('invalid sig'); } }
          };
        };
      }, { virtual: true });

      const payments = require('../src/api/payments');
      const app = express();
      app.use('/api/payments', payments);

      const payload = JSON.stringify({ type: 'payment_intent.succeeded', data: { object: { metadata: { userId: 'u2' } } } });
      const res = await request(app)
        .post('/api/payments/webhook')
        .set('stripe-signature', 'sig')
        .send(payload);

      expect(res.status).toBe(400);
    });
  });
});
