const request = require('supertest');
const app = require('../src/server');

// Mock the axie service
jest.mock('../src/services/axieService', () => ({
  getMarketplaceListings: jest.fn(),
  getRecentSales: jest.fn(),
  getAxieDetails: jest.fn(),
  getMarketStats: jest.fn()
}));

const axieService = require('../src/services/axieService');

describe('API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('GET /api/marketplace', () => {
    it('should return marketplace listings', async () => {
      const mockListings = [
        { id: '123', name: 'Axie 1', class: 'Beast' },
        { id: '456', name: 'Axie 2', class: 'Aquatic' }
      ];
      axieService.getMarketplaceListings.mockResolvedValue(mockListings);

      const response = await request(app).get('/api/marketplace');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockListings);
      expect(response.body.count).toBe(2);
    });

    it('should pass filters to the service', async () => {
      axieService.getMarketplaceListings.mockResolvedValue([]);

      await request(app)
        .get('/api/marketplace')
        .query({ limit: 10, offset: 5, classes: 'Beast,Aquatic', sortBy: 'PriceDesc' });

      expect(axieService.getMarketplaceListings).toHaveBeenCalledWith({
        limit: 10,
        offset: 5,
        classes: ['Beast', 'Aquatic'],
        sortBy: 'PriceDesc'
      });
    });

    it('should handle errors', async () => {
      axieService.getMarketplaceListings.mockRejectedValue(new Error('API Error'));

      const response = await request(app).get('/api/marketplace');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('API Error');
    });
  });

  describe('GET /api/marketplace/recent-sales', () => {
    it('should return recent sales', async () => {
      const mockSales = [
        { id: '111', name: 'Sold Axie 1' },
        { id: '222', name: 'Sold Axie 2' }
      ];
      axieService.getRecentSales.mockResolvedValue(mockSales);

      const response = await request(app).get('/api/marketplace/recent-sales');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSales);
    });

    it('should respect limit parameter', async () => {
      axieService.getRecentSales.mockResolvedValue([]);

      await request(app).get('/api/marketplace/recent-sales').query({ limit: 50 });

      expect(axieService.getRecentSales).toHaveBeenCalledWith(50);
    });
  });

  describe('GET /api/axie/:id', () => {
    it('should return axie details', async () => {
      const mockAxie = {
        id: '12345',
        name: 'Test Axie',
        class: 'Beast',
        stats: { hp: 40, speed: 40, skill: 40, morale: 40 }
      };
      axieService.getAxieDetails.mockResolvedValue(mockAxie);

      const response = await request(app).get('/api/axie/12345');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAxie);
    });

    it('should return 404 for non-existent axie', async () => {
      axieService.getAxieDetails.mockResolvedValue(null);

      const response = await request(app).get('/api/axie/99999999');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Axie not found');
    });
  });

  describe('GET /api/axie/:id/valuation', () => {
    it('should return axie valuation', async () => {
      const mockAxie = {
        id: '12345',
        name: 'Test Axie',
        class: 'Aquatic',
        breedCount: 1,
        parts: [
          { id: '1', name: 'Anemone', class: 'Aquatic', type: 'Eyes' },
          { id: '2', name: 'Nimo', class: 'Aquatic', type: 'Ears' },
          { id: '3', name: 'Koi', class: 'Aquatic', type: 'Back' },
          { id: '4', name: 'Risky Fish', class: 'Aquatic', type: 'Mouth' },
          { id: '5', name: 'Lam', class: 'Aquatic', type: 'Horn' },
          { id: '6', name: 'Goldfish', class: 'Aquatic', type: 'Tail' }
        ],
        stats: { hp: 39, speed: 57, skill: 35, morale: 27 }
      };

      const mockMarketStats = {
        count: 25,
        avgPrice: 80,
        medianPrice: 75
      };

      axieService.getAxieDetails.mockResolvedValue(mockAxie);
      axieService.getMarketStats.mockResolvedValue(mockMarketStats);
      axieService.getRecentSales.mockResolvedValue([]);

      const response = await request(app).get('/api/axie/12345/valuation');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('axie');
      expect(response.body.data).toHaveProperty('valuation');
      expect(response.body.data.valuation).toHaveProperty('estimatedValue');
      expect(response.body.data.valuation).toHaveProperty('confidence');
      expect(response.body.data.valuation).toHaveProperty('analysis');
    });

    it('should return 404 for non-existent axie', async () => {
      axieService.getAxieDetails.mockResolvedValue(null);

      const response = await request(app).get('/api/axie/99999999/valuation');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/valuation/batch', () => {
    it('should return valuations for multiple axies', async () => {
      const mockAxie1 = {
        id: '111',
        class: 'Beast',
        breedCount: 0,
        parts: Array(6).fill({ class: 'Beast', name: 'Test' }),
        stats: { hp: 40, speed: 40, skill: 40, morale: 40 }
      };
      const mockAxie2 = {
        id: '222',
        class: 'Plant',
        breedCount: 1,
        parts: Array(6).fill({ class: 'Plant', name: 'Test' }),
        stats: { hp: 60, speed: 30, skill: 30, morale: 40 }
      };

      axieService.getAxieDetails
        .mockResolvedValueOnce(mockAxie1)
        .mockResolvedValueOnce(mockAxie2);
      axieService.getMarketStats.mockResolvedValue({ count: 20, avgPrice: 50, medianPrice: 50 });

      const response = await request(app)
        .post('/api/valuation/batch')
        .send({ axieIds: ['111', '222'] })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('should validate axieIds is an array', async () => {
      const response = await request(app)
        .post('/api/valuation/batch')
        .send({ axieIds: 'not-an-array' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('axieIds must be an array');
    });

    it('should limit batch size', async () => {
      const response = await request(app)
        .post('/api/valuation/batch')
        .send({ axieIds: Array(11).fill('123') })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toMatch(/Maximum \d+ Axies per batch request/);
    });
  });
});
