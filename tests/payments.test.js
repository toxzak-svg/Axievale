const request = require('supertest');

beforeAll(() => {
  jest.resetModules();
});

describe('Payments API', () => {
  it('returns 501 for checkout when Stripe not configured', async () => {
    const app = require('../src/server');
    const res = await request(app).post('/api/payments/create-checkout-session').send({ userId: 'u1' }).set('Content-Type', 'application/json');
    expect(res.status).toBe(501);
  });
});
