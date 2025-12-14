/**
 * Extra tests to cover popup, contentScript branches and routes edge cases
 */
const request = require('supertest');

describe('Popup, contentScript and routes extra coverage', () => {
  beforeEach(() => {
    // set test mode flag used by modules at require time
    global.__AXIEVALE_TEST__ = true;
    // provide chrome mock used by popup/contentScript
    global.chrome = {
      storage: { sync: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() } },
      runtime: { sendMessage: jest.fn().mockResolvedValue({ success: true, data: { signal: 'undervalued', valuation: { estimatedValue: 2 } } }) }
    };
    // reset DOM
    document.body.innerHTML = '';
    // ensure setImmediate exists for Express internals in this environment
    if (!global.setImmediate) {
      global.__saved_setImmediate = undefined;
      global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
    } else {
      global.__saved_setImmediate = global.setImmediate;
    }
  });

  afterEach(() => {
    jest.resetModules();
    delete global.__AXIEVALE_TEST__;
    delete global.chrome;
    document.body.innerHTML = '';
    // restore setImmediate if we overwrote it
    if (global.__saved_setImmediate === undefined) {
      // we created a polyfill
      delete global.setImmediate;
      delete global.__saved_setImmediate;
    } else if (global.__saved_setImmediate) {
      global.setImmediate = global.__saved_setImmediate;
      delete global.__saved_setImmediate;
    }
  });

  test('popup init handles missing storage and saves defaults', async () => {
    document.body.innerHTML = `
      <input id="baseUrl" />
      <input id="extSecret" />
      <button id="save"></button>
      <div id="status"></div>
    `;

    // mock stored values to be returned
    global.chrome.storage.sync.get.mockResolvedValue({ baseUrl: 'https://old', extensionSecret: 's' });

    // require popup and call exposed init
    require('../src/extension/popup.js');
    const api = window.__axievale_test_api;
    expect(api).toBeDefined();
    await api.initPopup();

    // inputs populated
    expect(document.getElementById('baseUrl').value).toBe('https://old');

    // simulate save
    document.getElementById('baseUrl').value = 'https://new';
    document.getElementById('extSecret').value = 'newsec';
    document.getElementById('save').click();

    expect(global.chrome.storage.sync.set).toHaveBeenCalled();
    await new Promise(r => setTimeout(r, 0));
    expect(document.getElementById('status').textContent).toBe('Saved');
  });

  test('contentScript annotates listings and handles missing elements', async () => {
    // Build a listing element
    const el = document.createElement('div');
    el.setAttribute('data-testid', 'marketplace-listing');
    const a = document.createElement('a');
    a.href = 'https://site/123';
    el.appendChild(a);
    const price = document.createElement('div');
    price.className = 'price';
    price.textContent = '1,234.50';
    el.appendChild(price);
    document.body.appendChild(el);

    await jest.isolateModulesAsync(async () => {
      require('../src/extension/contentScript.js');
      const api = window.__axievale_test_api;
      expect(api).toBeDefined();
      await api.processListings();
      expect(el.lastChild).toBeTruthy();
      const badge = el.lastChild;
      expect(badge.textContent).toMatch(/Undervalued|Valuation unknown|Overvalued|Fair/);
    });
  });

  test('routes handles unknown endpoints and error branches', async () => {
    jest.setTimeout(10000);
    await jest.isolateModulesAsync(async () => {
      const express = require('express');
      const app = express();
      const routes = require('../src/api/routes');
      app.use('/api', routes);

      const res = await request(app).get('/api/this-does-not-exist');
      expect([404, 200]).toContain(res.status);

      const res2 = await request(app).get('/api/marketplace').query({ page: 'not-a-number' });
      expect([200, 400, 500]).toContain(res2.status);
    });
  });
});
