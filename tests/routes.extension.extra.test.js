const request = require('supertest');

describe('Routes extension valuation branches', () => {
  test('returns 401 when extensionSecret configured and header missing', async () => {
    await jest.isolateModulesAsync(async () => {
      // mock config to require extension secret
      jest.doMock('../src/config', () => ({ extensionSecret: 's' }));
      // minimal axieService mock (should not be called)
      jest.doMock('../src/services/axieService', () => ({ getAxieDetails: jest.fn(), getMarketStats: jest.fn(), getRecentSales: jest.fn() }));
      jest.doMock('../src/services/valuationService', () => ({ generateValuation: jest.fn() }));

      const express = require('express');
      const app = express();
      const routes = require('../src/api/routes');
      app.use(express.json());
      app.use('/api', routes);

      const res = await request(app).post('/api/extension/valuation').send({ axieId: '1' });
      expect(res.status).toBe(401);
    });
  });

  test('returns 400 when axieId missing even when secret provided', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.doMock('../src/config', () => ({ extensionSecret: 's' }));
      jest.doMock('../src/services/axieService', () => ({ getAxieDetails: jest.fn(), getMarketStats: jest.fn(), getRecentSales: jest.fn() }));
      jest.doMock('../src/services/valuationService', () => ({ generateValuation: jest.fn() }));

      const express = require('express');
      const app = express();
      app.use(express.json());
      const routes = require('../src/api/routes');
      app.use('/api', routes);

      const res = await request(app).post('/api/extension/valuation').set('x-extension-secret', 's').send({});
      expect(res.status).toBe(400);
    });
  });

  test('cache miss then cache hit returns cached:true on second call and correct signal', async () => {
    await jest.isolateModulesAsync(async () => {
      // config without secret
      jest.doMock('../src/config', () => ({ extensionSecret: null }));

      // prepare service mocks
      const axie = { id: 'ax1' };
      const axieService = {
        getAxieDetails: jest.fn().mockResolvedValue(axie),
        getMarketStats: jest.fn().mockResolvedValue({}),
        getRecentSales: jest.fn().mockResolvedValue([])
      };
      const valuation = { priceRange: { low: 10, high: 20 }, valuation: { estimatedValue: 15 } };
      const valuationService = { generateValuation: jest.fn().mockResolvedValue(valuation) };

      jest.doMock('../src/services/axieService', () => axieService);
      jest.doMock('../src/services/valuationService', () => valuationService);

      const express = require('express');
      const app = express();
      app.use(express.json());
      const routes = require('../src/api/routes');
      app.use('/api', routes);

      // first call: listingPrice below low => undervalued, cached:false
      const res1 = await request(app).post('/api/extension/valuation').send({ axieId: 'ax1', listingPrice: 5 });
      expect(res1.status).toBe(200);
      expect(res1.body.cached).toBeFalsy();
      expect(res1.body.data.signal).toBe('undervalued');

      // second call same key should be cache hit
      const res2 = await request(app).post('/api/extension/valuation').send({ axieId: 'ax1', listingPrice: 5 });
      expect(res2.status).toBe(200);
      expect(res2.body.cached).toBeTruthy();
      expect(res2.body.data.signal).toBe('undervalued');
    });
  });
});
