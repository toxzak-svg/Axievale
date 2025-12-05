const express = require('express');
const config = require('../config');
const axieService = require('../services/axieService');
const valuationService = require('../services/valuationService');

const router = express.Router();

/**
 * GET /api/marketplace
 * Fetch current marketplace listings
 */
router.get('/marketplace', async (req, res) => {
  try {
    const {
      limit = 20,
      offset = 0,
      classes,
      sortBy = 'PriceAsc'
    } = req.query;

    const filters = {
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
      sortBy
    };

    if (classes) {
      filters.classes = classes.split(',').map(c => c.trim());
    }

    const listings = await axieService.getMarketplaceListings(filters);
    
    res.json({
      success: true,
      data: listings,
      count: listings.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/marketplace/recent-sales
 * Fetch recently sold Axies
 */
router.get('/marketplace/recent-sales', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const sales = await axieService.getRecentSales(parseInt(limit, 10));
    
    res.json({
      success: true,
      data: sales,
      count: sales.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/axie/:id
 * Fetch details for a specific Axie
 */
router.get('/axie/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const axie = await axieService.getAxieDetails(id);
    
    if (!axie) {
      return res.status(404).json({
        success: false,
        error: 'Axie not found'
      });
    }
    
    res.json({
      success: true,
      data: axie
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/axie/:id/valuation
 * Get AI-powered valuation for a specific Axie
 */
router.get('/axie/:id/valuation', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Fetch axie details
    const axie = await axieService.getAxieDetails(id);
    
    if (!axie) {
      return res.status(404).json({
        success: false,
        error: 'Axie not found'
      });
    }

    // Get market statistics for similar Axies
    const marketStats = await axieService.getMarketStats(axie);

    // Get recent sales data
    let recentSales = [];
    try {
      recentSales = await axieService.getRecentSales(20);
    } catch (err) {
      // Continue without recent sales data
      console.warn('Could not fetch recent sales:', err.message);
    }

    // Generate valuation
    const valuation = await valuationService.generateValuation(axie, marketStats, recentSales);
    
    res.json({
      success: true,
      data: {
        axie,
        valuation
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/valuation/batch
 * Get valuations for multiple Axies
 */
router.post('/valuation/batch', async (req, res) => {
  try {
    const { axieIds } = req.body;
    
    if (!axieIds || !Array.isArray(axieIds)) {
      return res.status(400).json({
        success: false,
        error: 'axieIds must be an array'
      });
    }

    if (axieIds.length > config.batchValuationLimit) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${config.batchValuationLimit} Axies per batch request`
      });
    }

    const valuations = await Promise.all(
      axieIds.map(async (id) => {
        try {
          const axie = await axieService.getAxieDetails(id);
          if (!axie) return { axieId: id, error: 'Not found' };
          
          const marketStats = await axieService.getMarketStats(axie);
          const valuation = await valuationService.generateValuation(axie, marketStats, []);
          
          return { axie, valuation };
        } catch (err) {
          return { axieId: id, error: err.message };
        }
      })
    );

    res.json({
      success: true,
      data: valuations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
