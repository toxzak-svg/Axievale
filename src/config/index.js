require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  openaiApiKey: process.env.OPENAI_API_KEY,
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
  axieGraphqlEndpoint: process.env.AXIE_GRAPHQL_ENDPOINT || 'https://graphql-gateway.axieinfinity.com/graphql',
  maxBodyLength: parseInt(process.env.MAX_BODY_LENGTH || '10485760', 10), // 10MB default
  batchValuationLimit: parseInt(process.env.BATCH_VALUATION_LIMIT || '10', 10)
};
