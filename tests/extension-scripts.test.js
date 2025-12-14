// @jest-environment jsdom
// Tests for extension scripts (contentScript, background, popup).
// We run them in JSDOM and mock the `chrome` API and `fetch` where necessary.

const fs = require('fs');
const path = require('path');

beforeEach(() => {
  // Minimal chrome mock
  global.chrome = {
    runtime: { sendMessage: jest.fn() },
    storage: { sync: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() } }
  };
  global.fetch = jest.fn();
  // Ensure window/document and MutationObserver exist for VM context
  if (typeof global.window === 'undefined') global.window = global;
  if (typeof global.MutationObserver === 'undefined') {
    class _MO {
      constructor(cb) { this._cb = cb; global.__lastMutationObserver = this; }
      observe() { /* no-op */ }
      disconnect() { /* no-op */ }
    }
    global.MutationObserver = _MO;
  }
});

afterEach(() => {
  jest.resetAllMocks();
  // Disconnect any MutationObserver created in tests
  try {
    if (global.__lastMutationObserver && typeof global.__lastMutationObserver.disconnect === 'function') {
      global.__lastMutationObserver.disconnect();
      global.__lastMutationObserver = null;
    }
  } catch (e) {}
  // Clear timers to avoid open handles
  try { jest.clearAllTimers(); } catch (e) {}
  // Reset any mocked runtime listeners
  try {
    if (global.chrome && global.chrome.runtime && global.chrome.runtime.onMessage && global.chrome.runtime.onMessage.addListener && global.chrome.runtime.onMessage.addListener.mockReset) {
      global.chrome.runtime.onMessage.addListener.mockReset();
    }
  } catch (e) {}
  delete global.chrome;
  delete global.fetch;
});

test('contentScript extracts id and price and annotates elements', async () => {
  // Prepare DOM
  document.body.innerHTML = `
    <div class="ListingCard" data-axie-id="123">
      <a href="/axie/123">Link</a>
      <div class="price">$12</div>
    </div>
  `;
  
  // Mock chrome.runtime.sendMessage to return valuation
  chrome.runtime.sendMessage.mockImplementation(({ type }) => ({ success: true, data: { signal: 'undervalued', valuation: { estimatedValue: 10 } } }));

  // Load content script in test-mode so it doesn't auto-run observers; require for coverage
  global.window.__AXIEVALE_TEST__ = true;
  require(path.join(__dirname, '..', 'src', 'extension', 'contentScript.js'));

  // Run the exposed test API to process listings
  if (global.window.__axievale_test_api && typeof global.window.__axievale_test_api.processListings === 'function') {
    await global.window.__axievale_test_api.processListings();
  } else {
    // fallback short wait
    await new Promise(r => setTimeout(r, 20));
  }

  const badge = document.querySelector('div[style]');
  expect(badge).not.toBeNull();
  expect(badge.textContent).toContain('Undervalued');
  // cleanup: disconnect observer and clear any pending timeouts
  try { if (global.__lastMutationObserver && typeof global.__lastMutationObserver.disconnect === 'function') { global.__lastMutationObserver.disconnect(); global.__lastMutationObserver = null; } } catch (e) {}
  try { if (global.window && global.window.__axievale_mutation_timeout) { clearTimeout(global.window.__axievale_mutation_timeout); global.window.__axievale_mutation_timeout = null; } } catch (e) {}
}, 2000);

test('background handles getValuation and returns fetch error', async () => {
  // Mock storage get to return baseUrl empty and provide runtime listener mock before requiring script
  global.chrome = { storage: { sync: { get: jest.fn().mockResolvedValue({}) } }, runtime: { onMessage: { addListener: jest.fn() } } };

  // Mock fetch to return non-ok
  global.fetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'err' });

  // Require background script to register listener
  const scriptPath = path.join(__dirname, '..', 'src', 'extension', 'background.js');
  require(scriptPath);

  // Find added listener
  const listener = chrome.runtime.onMessage.addListener.mock.calls[0][0];

  // Mock sendResponse
  const sendResponse = jest.fn();

  // Call listener with message
  const ret = listener({ type: 'getValuation', axieId: '1' }, {}, sendResponse);
  // Listener returns true for async
  expect(ret).toBe(true);

  // Allow async flow
  await new Promise(r => setTimeout(r, 20));

  // cleanup any mutation timeout created by script
  try { if (global.window && global.window.__axievale_mutation_timeout) { clearTimeout(global.window.__axievale_mutation_timeout); global.window.__axievale_mutation_timeout = null; } } catch (e) {}
  expect(sendResponse).toHaveBeenCalled();
}, 2000);

test('popup reads and writes storage fields', async () => {
  // Build DOM expected by popup.js
  document.body.innerHTML = `<input id="baseUrl"/><input id="extSecret"/><button id="save"></button>`;
  global.chrome = { storage: { sync: { get: jest.fn().mockResolvedValue({ baseUrl: 'http://x', extensionSecret: 's' }), set: jest.fn().mockResolvedValue() } } };

  // Require popup script in test-mode and call initPopup
  global.window.__AXIEVALE_TEST__ = true;
  const popupPath = path.join(__dirname, '..', 'src', 'extension', 'popup.js');
  require(popupPath);
  if (global.window.__axievale_test_api && typeof global.window.__axievale_test_api.initPopup === 'function') {
    await global.window.__axievale_test_api.initPopup();
  } else {
    await new Promise(r => setTimeout(r, 10));
  }
  expect(document.getElementById('baseUrl').value).toBe('http://x');

  // Simulate clicking save
  document.getElementById('baseUrl').value = 'http://y';
  document.getElementById('extSecret').value = 'newsecret';
  document.getElementById('save').click();
  await new Promise(r => setTimeout(r, 10));
  expect(global.chrome.storage.sync.set).toHaveBeenCalled();
  }, 2000);
