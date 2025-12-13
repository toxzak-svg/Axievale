const express = require('express');
const config = require('../config');
const axieService = require('../services/axieService');
const valuationService = require('../services/valuationService');

const router = express.Router();

// LRU-bounded in-memory cache for extension valuations: Map preserves insertion order
const extensionCache = new Map();
const CACHE_TTL_MS = (config.extensionCacheTtlSec || 60) * 1000;
const CACHE_MAX_ENTRIES = config.extensionCacheMaxEntries || 1000;

function getCached(key) {
  const entry = extensionCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    extensionCache.delete(key);
    return null;
  }
  // refresh LRU position
  extensionCache.delete(key);
  extensionCache.set(key, entry);
  return entry.value;
}

function setCached(key, value) {
  // Evict oldest entries if exceeding max
  if (extensionCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = extensionCache.keys().next().value;
    if (oldestKey) extensionCache.delete(oldestKey);
  }
  extensionCache.set(key, { ts: Date.now(), value });
}

// Simple rate-limiter per IP for extension endpoint
const rateMap = new Map();
const RATE_MAX = config.extensionRateLimitMax || 60;
const RATE_WINDOW_MS = (config.extensionRateLimitWindowSec || 60) * 1000;

function extensionRateLimiter(req, res, next) {
  try {
    const ip = req.ip || req.get('x-forwarded-for') || req.get('x-real-ip') || 'unknown';
    const now = Date.now();
    const entry = rateMap.get(ip) || { windowStart: now, count: 0 };
    if (now - entry.windowStart > RATE_WINDOW_MS) {
      entry.windowStart = now;
      entry.count = 0;
    }
    entry.count += 1;
    rateMap.set(ip, entry);
    if (entry.count > RATE_MAX) {
      return res.status(429).json({ success: false, error: 'Rate limit exceeded' });
    }
    return next();
  } catch (err) {
    // In case of rate limiter failure, allow request but log
    console.warn('Rate limiter error', err);
    return next();
  }
}

// Per-user quota middleware backed by userStore (trial + paywall)
// Prefer DB-backed store when available
let userStore = null;
try {
  const dbStore = require('../services/userStoreDb');
  if (dbStore) userStore = dbStore;
} catch (e) {
  // ignore
}
if (!userStore) {
  userStore = require('../services/userStore');
}

async function userQuotaMiddleware(req, res, next) {
  try {
    const userId = req.get('x-user-id');
    const userKey = req.get('x-user-key');
    if (!userId || !userKey) return next(); // not a user-based request

    const user = userStore.getUserById(userId);
    if (!user || user.apiKey !== userKey) {
      return res.status(401).json({ success: false, error: 'Invalid user credentials' });
    }

    if (user.isPaid) return next();

    if (user.trialRemaining > 0) {
      userStore.decrementTrial(userId);
      return next();
    }

    // Trial exhausted
    return res.status(402).json({ success: false, error: 'Payment required: trial exhausted' });
  } catch (err) {
    console.warn('userQuotaMiddleware error', err.message);
    return next();
  }
}

// Composite middleware: if user headers present, use userQuotaMiddleware, otherwise use IP rate limiter
function perUserOrIpLimiter(req, res, next) {
  const userId = req.get('x-user-id');
  const userKey = req.get('x-user-key');
  if (userId && userKey) return userQuotaMiddleware(req, res, next);
  return extensionRateLimiter(req, res, next);
}

// Metrics for extension requests
const extensionMetrics = {
  totalRequests: 0,
  totalErrors: 0,
  cacheHits: 0,
  cacheMisses: 0,
  totalLatencyMs: 0,
  avgLatency() { return this.totalRequests ? Math.round(this.totalLatencyMs / this.totalRequests) : 0; }
};

// Optional Prometheus instrumentation (lazy)
let prom = null;
let promCounters = null;
try {
  const promClient = require('prom-client');
  prom = promClient;
  promCounters = {
    requests: new prom.Counter({ name: 'axievale_extension_requests_total', help: 'Total extension requests' }),
    errors: new prom.Counter({ name: 'axievale_extension_errors_total', help: 'Total extension errors' }),
    cacheHits: new prom.Counter({ name: 'axievale_extension_cache_hits_total', help: 'Cache hits' }),
    cacheMisses: new prom.Counter({ name: 'axievale_extension_cache_misses_total', help: 'Cache misses' }),
    latency: new prom.Histogram({ name: 'axievale_extension_request_duration_ms', help: 'Request duration ms', buckets: [10,50,100,200,500,1000] })
  };
} catch (e) {
  prom = null;
  promCounters = null;
}

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

/**
 * POST /api/extension/valuation
 * Endpoint intended for the browser extension to request a quick valuation and signal
 * Body: { axieId: string, listingPrice?: number }
 * Header (optional): x-extension-secret if configured
 */
router.post('/extension/valuation', perUserOrIpLimiter, async (req, res) => {
  const start = Date.now();
  extensionMetrics.totalRequests += 1;
  if (promCounters && promCounters.requests) promCounters.requests.inc();
  try {
    // Optional secret validation
    if (config.extensionSecret) {
      const provided = req.get('x-extension-secret');
      if (!provided || provided !== config.extensionSecret) {
        extensionMetrics.totalErrors += 1;
        if (promCounters && promCounters.errors) promCounters.errors.inc();
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
    }

    const { axieId, listingPrice } = req.body || {};
    if (!axieId) {
      extensionMetrics.totalErrors += 1;
      return res.status(400).json({ success: false, error: 'axieId is required' });
    }

    const cacheKey = `${axieId}:${listingPrice || 'nil'}`;
    const cached = getCached(cacheKey);
    if (cached) {
      extensionMetrics.cacheHits += 1;
      if (promCounters && promCounters.cacheHits) promCounters.cacheHits.inc();
      const latency = Date.now() - start;
      extensionMetrics.totalLatencyMs += latency;
      if (promCounters && promCounters.latency) promCounters.latency.observe(latency);
      console.log(`[extension] cache hit ip=${req.ip || 'unknown'} axie=${axieId} signal=${cached.signal} latency=${latency}ms`);
      return res.json({ success: true, data: cached, cached: true });
    }
    extensionMetrics.cacheMisses += 1;
    if (promCounters && promCounters.cacheMisses) promCounters.cacheMisses.inc();

    // Fetch axie details
    const axie = await axieService.getAxieDetails(axieId);
    if (!axie) {
      extensionMetrics.totalErrors += 1;
      return res.status(404).json({ success: false, error: 'Axie not found' });
    }

    const marketStats = await axieService.getMarketStats(axie);

    let recentSales = [];
    try {
      recentSales = await axieService.getRecentSales(20);
    } catch (err) {
      // ignore
    }

    const valuation = await valuationService.generateValuation(axie, marketStats, recentSales);

    // Determine simple signal relative to valuation price range
    let signal = 'unknown';
    if (listingPrice && valuation && valuation.priceRange) {
      const lp = Number(listingPrice);
      if (!isNaN(lp)) {
        if (lp < valuation.priceRange.low) signal = 'undervalued';
        else if (lp > valuation.priceRange.high) signal = 'overvalued';
        else signal = 'fair';
      }
    }

    const result = { axie, valuation, signal };
    setCached(cacheKey, result);

    const latency = Date.now() - start;
      extensionMetrics.totalLatencyMs += latency;
      if (promCounters && promCounters.latency) promCounters.latency.observe(latency);
    console.log(`[extension] request ip=${req.ip || 'unknown'} axie=${axieId} signal=${signal} cache=miss latency=${latency}ms`);

    res.json({ success: true, data: result });
  } catch (error) {
    extensionMetrics.totalErrors += 1;
    if (promCounters && promCounters.errors) promCounters.errors.inc();
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/users/register
 * Create a new trial user and return credentials (userId + apiKey)
 * Body: { email?: string }
 */
router.post('/users/register', async (req, res) => {
  try {
    const { email } = req.body || {};
    const user = userStore.createUser({ email });
    res.json({ success: true, data: { id: user.id, apiKey: user.apiKey, trialRemaining: user.trialRemaining } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/users/:id/activate
 * Mark a user as paid (protected by extensionSecret) — placeholder for webhook
 */
router.post('/users/:id/activate', async (req, res) => {
  try {
    if (config.extensionSecret) {
      const provided = req.get('x-extension-secret');
      if (!provided || provided !== config.extensionSecret) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
    }
    const { id } = req.params;
    const user = userStore.activateUser(id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: { id: user.id, isPaid: user.isPaid } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/extension/metrics
 * Returns simple metrics for extension requests. Protected by extensionSecret if configured.
 */
router.get('/extension/metrics', (req, res) => {
  if (config.extensionSecret) {
    const provided = req.get('x-extension-secret');
    if (!provided || provided !== config.extensionSecret) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
  }

  res.json({
    success: true,
    data: {
      totalRequests: extensionMetrics.totalRequests,
      totalErrors: extensionMetrics.totalErrors,
      cacheHits: extensionMetrics.cacheHits,
      cacheMisses: extensionMetrics.cacheMisses,
      avgLatencyMs: extensionMetrics.avgLatency()
    }
  });
});

module.exports = router;
