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

  it('creates a checkout session when stripe is mocked', async () => {
    jest.resetModules();
    const mockSession = { id: 'sess_123', url: 'https://checkout.stripe.test/sess_123' };
    const stripeMock = () => ({ checkout: { sessions: { create: jest.fn().mockResolvedValue(mockSession) } } });
    jest.doMock('stripe', () => stripeMock);

    // Re-require app so payments module picks up mocked stripe
    const app = require('../src/server');

    const res = await request(app).post('/api/payments/create-checkout-session').send({ userId: 'u1', amount: 4.99 }).set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id', 'sess_123');
    expect(res.body.data).toHaveProperty('url');
  });
});
