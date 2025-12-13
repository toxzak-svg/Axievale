const request = require('supertest');
const app = require('../src/server');

jest.mock('../src/services/axieService', () => ({
  getAxieDetails: jest.fn(),
  getMarketStats: jest.fn(),
  getRecentSales: jest.fn()
}));

jest.mock('../src/services/valuationService', () => ({
  generateValuation: jest.fn()
}));

const axieService = require('../src/services/axieService');
const valuationService = require('../src/services/valuationService');

describe('POST /api/extension/valuation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 400 when axieId missing', async () => {
    const res = await request(app)
      .post('/api/extension/valuation')
      .send({})
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when axie not found', async () => {
    axieService.getAxieDetails.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/extension/valuation')
      .send({ axieId: 'doesnotexist' })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns undervalued signal when listingPrice < priceRange.low', async () => {
    const mockAxie = { id: '123', class: 'Beast' };
    axieService.getAxieDetails.mockResolvedValue(mockAxie);
    axieService.getMarketStats.mockResolvedValue({ count: 10, avgPrice: 100, medianPrice: 95 });
    axieService.getRecentSales.mockResolvedValue([]);

    valuationService.generateValuation.mockResolvedValue({
      estimatedValue: 100,
      confidence: 80,
      priceRange: { low: 90, high: 110 }
    });

    const res = await request(app)
      .post('/api/extension/valuation')
      .send({ axieId: '123', listingPrice: 50 })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('signal');
    expect(res.body.data.signal).toBe('undervalued');
  });

  it('returns overvalued signal when listingPrice > priceRange.high', async () => {
    const mockAxie = { id: '321', class: 'Plant' };
    axieService.getAxieDetails.mockResolvedValue(mockAxie);
    axieService.getMarketStats.mockResolvedValue({ count: 8, avgPrice: 50, medianPrice: 45 });
    axieService.getRecentSales.mockResolvedValue([]);

    valuationService.generateValuation.mockResolvedValue({
      estimatedValue: 48,
      confidence: 70,
      priceRange: { low: 40, high: 60 }
    });

    const res = await request(app)
      .post('/api/extension/valuation')
      .send({ axieId: '321', listingPrice: 100 })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.signal).toBe('overvalued');
  });

  it('returns fair signal when listingPrice within range', async () => {
    const mockAxie = { id: '555', class: 'Bird' };
    axieService.getAxieDetails.mockResolvedValue(mockAxie);
    axieService.getMarketStats.mockResolvedValue({ count: 5, avgPrice: 20, medianPrice: 20 });
    axieService.getRecentSales.mockResolvedValue([]);

    valuationService.generateValuation.mockResolvedValue({
      estimatedValue: 20,
      confidence: 60,
      priceRange: { low: 16, high: 24 }
    });

    const res = await request(app)
      .post('/api/extension/valuation')
      .send({ axieId: '555', listingPrice: 18 })
      .set('Content-Type', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.signal).toBe('fair');
  });
});
