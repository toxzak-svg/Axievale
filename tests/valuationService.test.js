const valuationService = require('../src/services/valuationService');

describe('ValuationService', () => {
  describe('analyzeAxieTraits', () => {
    it('should calculate purity correctly for pure Axie', () => {
      const pureAxie = {
        id: '123',
        class: 'Aquatic',
        breedCount: 0,
        parts: [
          { id: '1', name: 'Anemone', class: 'Aquatic', type: 'Eyes' },
          { id: '2', name: 'Risky Fish', class: 'Aquatic', type: 'Ears' },
          { id: '3', name: 'Lam', class: 'Aquatic', type: 'Back' },
          { id: '4', name: 'Nimo', class: 'Aquatic', type: 'Mouth' },
          { id: '5', name: 'Koi', class: 'Aquatic', type: 'Horn' },
          { id: '6', name: 'Goldfish', class: 'Aquatic', type: 'Tail' }
        ],
        stats: { hp: 39, speed: 57, skill: 35, morale: 27 }
      };

      const analysis = valuationService.analyzeAxieTraits(pureAxie);

      expect(analysis.purity).toBe(100);
      expect(analysis.isPure).toBe(true);
      expect(analysis.matchingParts).toBe(6);
    });

    it('should calculate purity correctly for mixed Axie', () => {
      const mixedAxie = {
        id: '456',
        class: 'Beast',
        breedCount: 2,
        parts: [
          { id: '1', name: 'Chubby', class: 'Beast', type: 'Eyes' },
          { id: '2', name: 'Puppy', class: 'Beast', type: 'Ears' },
          { id: '3', name: 'Ronin', class: 'Beast', type: 'Back' },
          { id: '4', name: 'Nut Cracker', class: 'Beast', type: 'Mouth' },
          { id: '5', name: 'Tiny Dino', class: 'Reptile', type: 'Horn' },
          { id: '6', name: 'Cotton Tail', class: 'Plant', type: 'Tail' }
        ],
        stats: { hp: 31, speed: 41, skill: 31, morale: 61 }
      };

      const analysis = valuationService.analyzeAxieTraits(mixedAxie);

      expect(analysis.purity).toBeCloseTo(66.67, 1);
      expect(analysis.isPure).toBe(false);
      expect(analysis.matchingParts).toBe(4);
    });

    it('should identify valuable parts', () => {
      const axieWithValuableParts = {
        id: '789',
        class: 'Aquatic',
        breedCount: 1,
        parts: [
          { id: '1', name: 'Anemone', class: 'Aquatic', type: 'Eyes' },
          { id: '2', name: 'Risky Fish', class: 'Aquatic', type: 'Ears' },
          { id: '3', name: 'Nimo', class: 'Aquatic', type: 'Back' },
          { id: '4', name: 'Koi', class: 'Aquatic', type: 'Mouth' },
          { id: '5', name: 'Some Random', class: 'Aquatic', type: 'Horn' },
          { id: '6', name: 'Goldfish', class: 'Aquatic', type: 'Tail' }
        ],
        stats: { hp: 39, speed: 57, skill: 35, morale: 27 }
      };

      const analysis = valuationService.analyzeAxieTraits(axieWithValuableParts);

      expect(analysis.valuableParts.length).toBe(4); // Risky Fish, Nimo, Koi, Goldfish
    });

    it('should calculate breed score correctly', () => {
      const freshAxie = {
        id: '111',
        class: 'Plant',
        breedCount: 0,
        parts: [],
        stats: {}
      };

      const bredAxie = {
        id: '222',
        class: 'Plant',
        breedCount: 5,
        parts: [],
        stats: {}
      };

      const freshAnalysis = valuationService.analyzeAxieTraits(freshAxie);
      const bredAnalysis = valuationService.analyzeAxieTraits(bredAxie);

      expect(freshAnalysis.breedScore).toBe(100);
      expect(bredAnalysis.breedScore).toBe(25); // 100 - (5 * 15)
    });
  });

  describe('calculateOverallScore', () => {
    it('should calculate overall score with correct weights', () => {
      // Test with maximum values
      const score = valuationService.calculateOverallScore(100, 4, 100, 164);

      // 100 * 0.3 + 100 * 0.25 + 100 * 0.25 + 100 * 0.2 = 100
      expect(score).toBe(100);
    });

    it('should cap parts score at 100', () => {
      const score = valuationService.calculateOverallScore(0, 10, 0, 0);

      // Parts score should be capped at 100 (10 * 25 = 250, but capped at 100)
      // 0 * 0.3 + 100 * 0.25 + 0 * 0.25 + 0 * 0.2 = 25
      expect(score).toBe(25);
    });
  });

  describe('calculateBaseValuation', () => {
    it('should return null values when no market stats available', () => {
      const axie = { id: '123', class: 'Beast', parts: [], breedCount: 0, stats: {} };
      const result = valuationService.calculateBaseValuation(axie, null, []);

      expect(result.estimatedValue).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.priceRange).toBeNull();
    });

    it('should calculate estimated value based on market stats', () => {
      const axie = {
        id: '123',
        class: 'Aquatic',
        breedCount: 0,
        parts: [
          { id: '1', name: 'Anemone', class: 'Aquatic', type: 'Eyes' },
          { id: '2', name: 'Normal', class: 'Aquatic', type: 'Ears' },
          { id: '3', name: 'Normal', class: 'Aquatic', type: 'Back' },
          { id: '4', name: 'Normal', class: 'Aquatic', type: 'Mouth' },
          { id: '5', name: 'Normal', class: 'Aquatic', type: 'Horn' },
          { id: '6', name: 'Normal', class: 'Aquatic', type: 'Tail' }
        ],
        stats: { hp: 39, speed: 57, skill: 35, morale: 27 }
      };

      const marketStats = {
        count: 50,
        avgPrice: 100,
        medianPrice: 90,
        minPrice: 50,
        maxPrice: 200
      };

      const result = valuationService.calculateBaseValuation(axie, marketStats, []);

      expect(result.estimatedValue).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(50);
      expect(result.priceRange).toBeDefined();
      expect(result.priceRange.low).toBeLessThan(result.estimatedValue);
      expect(result.priceRange.high).toBeGreaterThan(result.estimatedValue);
    });

    it('should apply purity bonus for pure Axies', () => {
      const pureAxie = {
        id: '123',
        class: 'Beast',
        breedCount: 0,
        parts: Array(6).fill({ class: 'Beast', name: 'Test' }),
        stats: { hp: 40, speed: 40, skill: 40, morale: 40 }
      };

      const mixedAxie = {
        id: '456',
        class: 'Beast',
        breedCount: 0,
        parts: [
          { class: 'Beast', name: 'Test' },
          { class: 'Beast', name: 'Test' },
          { class: 'Beast', name: 'Test' },
          { class: 'Plant', name: 'Test' },
          { class: 'Aquatic', name: 'Test' },
          { class: 'Bird', name: 'Test' }
        ],
        stats: { hp: 40, speed: 40, skill: 40, morale: 40 }
      };

      const marketStats = {
        count: 50,
        avgPrice: 100,
        medianPrice: 100
      };

      const pureResult = valuationService.calculateBaseValuation(pureAxie, marketStats, []);
      const mixedResult = valuationService.calculateBaseValuation(mixedAxie, marketStats, []);

      // Pure axie should have higher valuation
      expect(pureResult.estimatedValue).toBeGreaterThan(mixedResult.estimatedValue);
    });
  });

  describe('calculateConfidence', () => {
    it('should return base confidence when no data available', () => {
      const confidence = valuationService.calculateConfidence(null, []);
      expect(confidence).toBe(50);
    });

    it('should increase confidence with more listings', () => {
      const lowListings = { count: 5, avgPrice: 100, medianPrice: 100 };
      const highListings = { count: 50, avgPrice: 100, medianPrice: 100 };

      const lowConfidence = valuationService.calculateConfidence(lowListings, []);
      const highConfidence = valuationService.calculateConfidence(highListings, []);

      expect(highConfidence).toBeGreaterThan(lowConfidence);
    });

    it('should increase confidence with recent sales data', () => {
      const marketStats = { count: 10, avgPrice: 100, medianPrice: 100 };
      const noSales = [];
      const withSales = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];

      const noSalesConfidence = valuationService.calculateConfidence(marketStats, noSales);
      const withSalesConfidence = valuationService.calculateConfidence(marketStats, withSales);

      expect(withSalesConfidence).toBeGreaterThan(noSalesConfidence);
    });
  });

  describe('generateValuation', () => {
    it('should generate a complete valuation object', async () => {
      const axie = {
        id: '123',
        class: 'Plant',
        breedCount: 2,
        parts: [
          { id: '1', name: 'Pumpkin', class: 'Plant', type: 'Eyes' },
          { id: '2', name: 'Leafy', class: 'Plant', type: 'Ears' },
          { id: '3', name: 'Turnip', class: 'Plant', type: 'Back' },
          { id: '4', name: 'Serious', class: 'Plant', type: 'Mouth' },
          { id: '5', name: 'Cactus', class: 'Plant', type: 'Horn' },
          { id: '6', name: 'Carrot', class: 'Plant', type: 'Tail' }
        ],
        stats: { hp: 61, speed: 31, skill: 31, morale: 41 }
      };

      const marketStats = {
        count: 30,
        avgPrice: 75,
        medianPrice: 70,
        minPrice: 40,
        maxPrice: 150
      };

      const valuation = await valuationService.generateValuation(axie, marketStats, []);

      expect(valuation).toHaveProperty('axieId', '123');
      expect(valuation).toHaveProperty('estimatedValue');
      expect(valuation).toHaveProperty('confidence');
      expect(valuation).toHaveProperty('priceRange');
      expect(valuation).toHaveProperty('analysis');
      expect(valuation).toHaveProperty('marketComparison');
      expect(valuation).toHaveProperty('timestamp');

      expect(valuation.analysis).toHaveProperty('purity');
      expect(valuation.analysis).toHaveProperty('isPure');
      expect(valuation.analysis).toHaveProperty('overallScore');
      expect(valuation.analysis).toHaveProperty('valuableParts');

      expect(valuation.marketComparison.similarListings).toBe(30);
      expect(valuation.marketComparison.averagePrice).toBe(75);
    });

    it('should handle missing market data gracefully', async () => {
      const axie = {
        id: '999',
        class: 'Dusk',
        breedCount: 0,
        parts: [],
        stats: {}
      };

      const valuation = await valuationService.generateValuation(axie, null, []);

      expect(valuation.axieId).toBe('999');
      expect(valuation.estimatedValue).toBeNull();
      expect(valuation.confidence).toBe(0);
      expect(valuation.priceRange).toBeNull();
      expect(valuation.analysis).toBeDefined();
    });
  });
});
