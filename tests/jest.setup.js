// Polyfills and globals for Jest tests
const util = require('util');
if (typeof global.TextEncoder === 'undefined') global.TextEncoder = util.TextEncoder || class { encode(s){ return Buffer.from(String(s)); } };
if (typeof global.TextDecoder === 'undefined') global.TextDecoder = util.TextDecoder || class { decode(b){ return Buffer.from(b).toString(); } };
// Minimal fetch polyfill to prevent thrown errors in tests that don't mock fetch explicitly
if (typeof global.fetch === 'undefined') {
  global.fetch = async () => ({ ok: false, status: 501, json: async () => ({}), text: async () => '' });
}

// Ensure external AI integrations are disabled during tests
if (typeof process !== 'undefined') process.env.GOOGLE_AI_API_KEY = '';

// Fail fast: set a reasonable global timeout for Jest tests (5s)
jest.setTimeout(5000);
