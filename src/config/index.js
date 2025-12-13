require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY,
  googleAiModel: process.env.GOOGLE_AI_MODEL || 'gemini-1.5-flash',
  axieGraphqlEndpoint: process.env.AXIE_GRAPHQL_ENDPOINT || 'https://graphql-gateway.axieinfinity.com/graphql',
  maxBodyLength: parseInt(process.env.MAX_BODY_LENGTH || '10485760', 10), // 10MB default
  batchValuationLimit: parseInt(process.env.BATCH_VALUATION_LIMIT || '10', 10)
  ,
  // Optional secret that extensions must present in header `x-extension-secret` when calling extension endpoints
  extensionSecret: process.env.EXTENSION_SECRET || null,
  // Extension endpoint cache TTL seconds
  extensionCacheTtlSec: parseInt(process.env.EXTENSION_CACHE_TTL_SEC || '60', 10)
  ,
  // Comma-separated list of allowed CORS origins for API (e.g. https://marketplace.axieinfinity.com)
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
};
