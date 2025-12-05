require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  openaiApiKey: process.env.OPENAI_API_KEY,
  axieGraphqlEndpoint: process.env.AXIE_GRAPHQL_ENDPOINT || 'https://graphql-gateway.axieinfinity.com/graphql'
};
