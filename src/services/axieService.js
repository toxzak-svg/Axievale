const axios = require('axios');
const config = require('../config');

/**
 * Service for interacting with Axie Infinity marketplace API
 */
class AxieService {
  constructor() {
    this.endpoint = config.axieGraphqlEndpoint;
  }

  /**
   * Fetch recently sold Axies from the marketplace
   * @param {number} limit - Number of records to fetch
   * @returns {Promise<Array>} Array of recently sold Axies
   */
  async getRecentSales(limit = 20) {
    const query = `
      query GetRecentlyAxieSold($from: Int!, $size: Int!) {
        settledAuctions {
          axies(from: $from, size: $size) {
            total
            results {
              id
              name
              class
              breedCount
              genes
              stats {
                hp
                speed
                skill
                morale
              }
              parts {
                id
                name
                class
                type
                specialGenes
              }
              auction {
                currentPrice
                currentPriceUSD
                startedAt
                endedAt
                seller
              }
              transferHistory {
                total
                results {
                  timestamp
                  withPrice
                  withPriceUsd
                  from
                  to
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await axios.post(this.endpoint, {
        query,
        variables: { from: 0, size: limit }
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        maxBodyLength: 10 * 1024 * 1024 // 10MB limit
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      return response.data.data?.settledAuctions?.axies?.results || [];
    } catch (error) {
      console.error('Error fetching recent sales:', error.message);
      throw error;
    }
  }

  /**
   * Fetch Axies currently listed on the marketplace
   * @param {Object} filters - Filtering options
   * @returns {Promise<Array>} Array of listed Axies
   */
  async getMarketplaceListings(filters = {}) {
    const {
      limit = 20,
      offset = 0,
      classes = [],
      parts = [],
      breedCount = null,
      sortBy = 'PriceAsc'
    } = filters;

    const query = `
      query GetAxieBriefList(
        $from: Int!
        $size: Int!
        $sort: SortBy!
        $auctionType: AuctionType
        $criteria: AxieSearchCriteria
      ) {
        axies(
          from: $from
          size: $size
          sort: $sort
          auctionType: $auctionType
          criteria: $criteria
        ) {
          total
          results {
            id
            name
            class
            breedCount
            genes
            image
            stats {
              hp
              speed
              skill
              morale
            }
            parts {
              id
              name
              class
              type
              specialGenes
            }
            auction {
              currentPrice
              currentPriceUSD
              startingPrice
              startingTimestamp
              duration
            }
            battleInfo {
              banned
            }
          }
        }
      }
    `;

    const criteria = {};
    if (classes.length > 0) criteria.classes = classes;
    if (parts.length > 0) criteria.parts = parts;
    if (breedCount !== null) criteria.breedCount = [breedCount, breedCount];

    try {
      const response = await axios.post(this.endpoint, {
        query,
        variables: {
          from: offset,
          size: limit,
          sort: sortBy,
          auctionType: 'Sale',
          criteria: Object.keys(criteria).length > 0 ? criteria : null
        }
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        maxBodyLength: 10 * 1024 * 1024 // 10MB limit
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      return response.data.data?.axies?.results || [];
    } catch (error) {
      console.error('Error fetching marketplace listings:', error.message);
      throw error;
    }
  }

  /**
   * Fetch details for a specific Axie
   * @param {string} axieId - The Axie ID
   * @returns {Promise<Object>} Axie details
   */
  async getAxieDetails(axieId) {
    const query = `
      query GetAxieDetail($axieId: ID!) {
        axie(axieId: $axieId) {
          id
          name
          class
          breedCount
          genes
          image
          stats {
            hp
            speed
            skill
            morale
          }
          parts {
            id
            name
            class
            type
            specialGenes
            abilities {
              id
              name
              attack
              defense
              energy
              description
            }
          }
          auction {
            currentPrice
            currentPriceUSD
            startingPrice
            endingPrice
            duration
            startingTimestamp
          }
          potentialPoints {
            beast
            aquatic
            plant
            bug
            bird
            reptile
            mech
            dawn
            dusk
          }
          transferHistory {
            total
            results {
              timestamp
              withPrice
              withPriceUsd
              from
              to
            }
          }
          battleInfo {
            banned
            level
            charm
            rune
          }
        }
      }
    `;

    try {
      const response = await axios.post(this.endpoint, {
        query,
        variables: { axieId }
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        maxBodyLength: 10 * 1024 * 1024 // 10MB limit
      });

      if (response.data.errors) {
        throw new Error(response.data.errors[0].message);
      }

      return response.data.data?.axie || null;
    } catch (error) {
      console.error('Error fetching axie details:', error.message);
      throw error;
    }
  }

  /**
   * Get market statistics for similar Axies
   * @param {Object} axie - The Axie to find comparables for
   * @returns {Promise<Object>} Market statistics
   */
  async getMarketStats(axie) {
    // Find similar Axies based on class and parts
    const listings = await this.getMarketplaceListings({
      limit: 50,
      classes: [axie.class],
      breedCount: axie.breedCount
    });

    if (listings.length === 0) {
      return null;
    }

    // Calculate price statistics
    const prices = listings
      .filter(a => a.auction?.currentPriceUSD)
      .map(a => parseFloat(a.auction.currentPriceUSD));

    if (prices.length === 0) {
      return null;
    }

    prices.sort((a, b) => a - b);

    return {
      count: prices.length,
      minPrice: prices[0],
      maxPrice: prices[prices.length - 1],
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      medianPrice: prices[Math.floor(prices.length / 2)],
      axieClass: axie.class,
      breedCount: axie.breedCount
    };
  }
}

module.exports = new AxieService();
