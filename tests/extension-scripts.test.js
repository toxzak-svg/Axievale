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

  // Load and execute contentScript using vm to preserve filename for coverage
  const vm = require('vm');
  const scriptPath = path.join(__dirname, '..', 'src', 'extension', 'contentScript.js');
  const script = fs.readFileSync(scriptPath, 'utf8');
  const context = {
    window: global.window,
    document: global.document,
    chrome: global.chrome,
    fetch: global.fetch,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  // Provide a MutationObserver in the VM context that we can inspect/cleanup
  context.MutationObserver = class {
    constructor(cb) { this._cb = cb; context.__lastMutationObserver = this; }
    observe() {}
    disconnect() {}
  };
  vm.runInNewContext(script, context, { filename: scriptPath });

  // Wait a tick for processListings to run
  await new Promise(r => setTimeout(r, 20));

  const badge = document.querySelector('div[style]');
  expect(badge).not.toBeNull();
  expect(badge.textContent).toContain('Undervalued');
  // cleanup: disconnect observer and clear any pending timeouts
  if (context && context.MutationObserver && global.__lastMutationObserver && typeof global.__lastMutationObserver.disconnect === 'function') {
    try { global.__lastMutationObserver.disconnect(); } catch (e) {}
    global.__lastMutationObserver = null;
  }
  if (context && context.window && context.window.__axievale_mutation_timeout) {
    try { clearTimeout(context.window.__axievale_mutation_timeout); } catch (e) {}
    context.window.__axievale_mutation_timeout = null;
  }
}, 2000);

test('background handles getValuation and returns fetch error', async () => {
  const vm = require('vm');
  const scriptPath = path.join(__dirname, '..', 'src', 'extension', 'background.js');
  const script = fs.readFileSync(scriptPath, 'utf8');
  // Mock storage get to return baseUrl empty
  global.chrome = { storage: { sync: { get: jest.fn().mockResolvedValue({}) } }, runtime: { onMessage: { addListener: jest.fn() } } };

  // Mock fetch to return non-ok
  global.fetch.mockResolvedValue({ ok: false, status: 500, text: async () => 'err' });

  // Emulate runtime listener behavior: execute script to register listener
  const bgContext = {
    window: global.window,
    document: global.document,
    chrome: global.chrome,
    fetch: global.fetch,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  bgContext.MutationObserver = class { constructor(cb) { this._cb = cb; bgContext.__lastMutationObserver = this; } observe() {} disconnect() {} };
  vm.runInNewContext(script, bgContext, { filename: scriptPath });

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
  if (bgContext && bgContext.window && bgContext.window.__axievale_mutation_timeout) {
    try { clearTimeout(bgContext.window.__axievale_mutation_timeout); } catch (e) {}
    bgContext.window.__axievale_mutation_timeout = null;
  }
  expect(sendResponse).toHaveBeenCalled();
}, 2000);

test('popup reads and writes storage fields', async () => {
  // Build DOM expected by popup.js
  document.body.innerHTML = `<input id="baseUrl"/><input id="extSecret"/><button id="save"></button>`;
  global.chrome = { storage: { sync: { get: jest.fn().mockResolvedValue({ baseUrl: 'http://x', extensionSecret: 's' }), set: jest.fn().mockResolvedValue() } } };

  const vm = require('vm');
  const scriptPath = path.join(__dirname, '..', 'src', 'extension', 'popup.js');
  const script = fs.readFileSync(scriptPath, 'utf8');
  const popupContext = {
    window: global.window,
    document: global.document,
    chrome: global.chrome,
    fetch: global.fetch,
    console: console,
    setTimeout: setTimeout,
    clearTimeout: clearTimeout
  };
  popupContext.MutationObserver = class { constructor(cb) { this._cb = cb; popupContext.__lastMutationObserver = this; } observe() {} disconnect() {} };
  vm.runInNewContext(script, popupContext, { filename: scriptPath });

  // Wait for async init
  await new Promise(r => setTimeout(r, 10));
  expect(document.getElementById('baseUrl').value).toBe('http://x');

  // Simulate clicking save
  document.getElementById('baseUrl').value = 'http://y';
  document.getElementById('extSecret').value = 'newsecret';
  document.getElementById('save').click();
  await new Promise(r => setTimeout(r, 10));
  expect(global.chrome.storage.sync.set).toHaveBeenCalled();
  }, 2000);
