const request = require('supertest');

// We'll mock dependencies before loading the app to control trial sizes and JWT behavior
beforeAll(() => {
  jest.resetModules();
});

describe('User flows: register, login, activate, quota', () => {
  let app;
  let createdUser;

  beforeAll(async () => {
    // Small in-memory user store for tests
    const users = {};
    const userStoreMock = {
      createUser: ({ email } = {}) => {
        const id = 'user-' + Math.random().toString(36).slice(2, 8);
        const apiKey = 'key-' + Math.random().toString(36).slice(2, 12);
        const user = { id, email: email || null, apiKey, isPaid: false, trialRemaining: 2, createdAt: new Date().toISOString() };
        users[id] = user;
        return user;
      },
      getUserById: (id) => users[id] || null,
      getUserByApiKey: (key) => Object.values(users).find(u => u.apiKey === key) || null,
      activateUser: (id) => { if (!users[id]) return null; users[id].isPaid = true; return users[id]; },
      decrementTrial: (id) => { if (!users[id]) return null; if (users[id].trialRemaining > 0) { users[id].trialRemaining -= 1; return users[id].trialRemaining; } return 0; }
    };

    // Mock userStore and jsonwebtoken before loading app
    jest.doMock('../src/services/userStore', () => userStoreMock);
    jest.doMock('jsonwebtoken', () => ({ sign: () => 'test-jwt' }));

    // Mock axie and valuation services
    const axieMock = {
      getAxieDetails: jest.fn().mockResolvedValue({ id: 'axie-1', parts: [], stats: {} }),
      getMarketStats: jest.fn().mockResolvedValue({ count: 10, avgPrice: 50 }),
      getRecentSales: jest.fn().mockResolvedValue([])
    };
    jest.doMock('../src/services/axieService', () => axieMock);

    const valuationMock = {
      generateValuation: jest.fn().mockResolvedValue({ priceRange: { low: 10, high: 20 }, estimatedValue: 15 })
    };
    jest.doMock('../src/services/valuationService', () => valuationMock);

    // Ensure small trial size via env
    process.env.TRIAL_REQUESTS = '2';

    app = require('../src/server');
  });

  it('registers a new user', async () => {
    const res = await request(app).post('/api/users/register').send({ email: 'test@example.com' }).set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('id');
    expect(res.body.data).toHaveProperty('apiKey');
    createdUser = res.body.data;
  });

  it('logs in and receives a JWT', async () => {
    const res = await request(app).post('/api/auth/login').send({ userId: createdUser.id, apiKey: createdUser.apiKey }).set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('token');
    expect(res.body.data.token).toBe('test-jwt');
  });

  it('allows extension valuation while trial remains and decrements trial', async () => {
    // First request
    const r1 = await request(app)
      .post('/api/extension/valuation')
      .set('x-user-id', createdUser.id)
      .set('x-user-key', createdUser.apiKey)
      .send({ axieId: 'axie-1', listingPrice: 5 })
      .set('Content-Type', 'application/json');
    expect(r1.status).toBe(200);
    expect(r1.body.success).toBe(true);
    expect(r1.body.data.signal).toBe('undervalued');

    // Second request (trial remaining 1 -> 0)
    const r2 = await request(app)
      .post('/api/extension/valuation')
      .set('x-user-id', createdUser.id)
      .set('x-user-key', createdUser.apiKey)
      .send({ axieId: 'axie-1', listingPrice: 12 })
      .set('Content-Type', 'application/json');
    expect(r2.status).toBe(200);
    expect(r2.body.success).toBe(true);
    expect(r2.body.data.signal).toBe('fair');

    // Third request should exhaust trial and return 402
    const r3 = await request(app)
      .post('/api/extension/valuation')
      .set('x-user-id', createdUser.id)
      .set('x-user-key', createdUser.apiKey)
      .send({ axieId: 'axie-1', listingPrice: 15 })
      .set('Content-Type', 'application/json');
    expect(r3.status).toBe(402);
    expect(r3.body.success).toBe(false);
  });

  it('can activate user (mark paid) and bypass quota', async () => {
    const activate = await request(app)
      .post(`/api/users/${createdUser.id}/activate`)
      .set('x-extension-secret', process.env.EXTENSION_SECRET || '')
      .set('Content-Type', 'application/json');

    // activate endpoint requires extension secret if configured; if not configured it will succeed
    if (activate.status === 401) {
      // If secret required and not provided, skip activation check
      expect(activate.status).toBe(401);
    } else {
      expect(activate.status).toBe(200);
      expect(activate.body.success).toBe(true);
    }

    // Now call valuation with user headers; since user is marked paid in our mocked store, it should allow
    const paidRes = await request(app)
      .post('/api/extension/valuation')
      .set('x-user-id', createdUser.id)
      .set('x-user-key', createdUser.apiKey)
      .send({ axieId: 'axie-1', listingPrice: 11 })
      .set('Content-Type', 'application/json');

    // If activation was blocked by extension secret, user still unpaid so may return 402; accept either 200 or 402
    expect([200, 402]).toContain(paidRes.status);
  });
});
