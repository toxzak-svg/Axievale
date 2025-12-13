const axios = require('axios');
const axieService = require('../src/services/axieService');

jest.mock('axios');

describe('AxieService', () => {
  afterEach(() => jest.resetAllMocks());

  test('getRecentSales returns results when axios responds', async () => {
    const mockRes = { data: { data: { settledAuctions: { axies: { results: [{ id: '1' }, { id: '2' }] } } } } };
    axios.post.mockResolvedValue(mockRes);
    const results = await axieService.getRecentSales(2);
    expect(results).toHaveLength(2);
    expect(axios.post).toHaveBeenCalled();
  });

  test('getMarketplaceListings handles classes filter and returns results', async () => {
    const mockRes = { data: { data: { axies: { results: [{ id: 'a' }, { id: 'b' }] } } } };
    axios.post.mockResolvedValue(mockRes);
    const results = await axieService.getMarketplaceListings({ limit: 2, offset: 0, classes: ['Beast'], sortBy: 'PriceAsc' });
    expect(results).toHaveLength(2);
    expect(axios.post).toHaveBeenCalled();
  });

  test('getAxieDetails returns axie object or null', async () => {
    axios.post.mockResolvedValue({ data: { data: { axie: { id: 'xyz' } } } });
    const axie = await axieService.getAxieDetails('xyz');
    expect(axie).toBeTruthy();
    expect(axie.id).toBe('xyz');

    axios.post.mockResolvedValue({ data: { data: { axie: null } } });
    const axie2 = await axieService.getAxieDetails('nope');
    expect(axie2).toBeNull();
  });

  test('getMarketStats computes stats or null when no prices', async () => {
    // listings with auction.currentPriceUSD strings
    const listings = [
      { auction: { currentPriceUSD: '10' } },
      { auction: { currentPriceUSD: '20' } },
      { auction: { currentPriceUSD: '30' } }
    ];
    axios.post.mockResolvedValue({ data: { data: { axies: { results: listings } } } });

    const axie = { class: 'Beast', breedCount: 1 };
    const stats = await axieService.getMarketStats(axie);
    expect(stats).toBeTruthy();
    expect(stats.avgPrice).toBeGreaterThan(0);

    // no listings
    axios.post.mockResolvedValue({ data: { data: { axies: { results: [] } } } });
    const stats2 = await axieService.getMarketStats(axie);
    expect(stats2).toBeNull();
  });
});
