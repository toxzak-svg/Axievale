describe('Extension UI and content script', () => {
  beforeEach(() => {
    // Ensure test mode is detected at require-time
    global.__AXIEVALE_TEST__ = true;
    // Provide a basic mock chrome API
    global.chrome = {
      storage: { sync: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() } },
      runtime: { sendMessage: jest.fn().mockResolvedValue({ success: true, data: { signal: 'undervalued', valuation: { estimatedValue: 123 } } }) }
    };
    // Reset DOM
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.resetModules();
    delete global.__AXIEVALE_TEST__;
    delete global.chrome;
    document.body.innerHTML = '';
  });

  test('popup init loads and saves values', async () => {
    // Prepare DOM
    document.body.innerHTML = `
      <input id="baseUrl" />
      <input id="extSecret" />
      <button id="save"></button>
      <div id="status"></div>
    `;

    // Mock stored values returned on init
    global.chrome.storage.sync.get.mockResolvedValue({ baseUrl: 'https://old', extensionSecret: 's' });

    // Require popup after setting test globals
    const popup = require('../src/extension/popup.js');

    // Call exposed init
    const api = window.__axievale_test_api;
    expect(api).toBeDefined();
    await api.initPopup();

    // Inputs should be populated
    expect(document.getElementById('baseUrl').value).toBe('https://old');

    // Simulate user change and click
    document.getElementById('baseUrl').value = 'https://new';
    document.getElementById('extSecret').value = 'newsec';
    document.getElementById('save').click();

    // storage.set should have been called
    expect(global.chrome.storage.sync.set).toHaveBeenCalled();
    // wait for async handler to complete
    await new Promise(r => setTimeout(r, 0));
    // status should show Saved
    expect(document.getElementById('status').textContent).toBe('Saved');
  });

  test('contentScript extracts listings and annotates', async () => {
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

    // Require content script after setting globals
    await jest.isolateModulesAsync(async () => {
      require('../src/extension/contentScript.js');
      const api = window.__axievale_test_api;
      expect(api).toBeDefined();
      // run processListings
      await api.processListings();
      // element should have an appended badge as the last child
      expect(el.lastChild).toBeTruthy();
      const badge = el.lastChild;
      expect(badge.textContent).toMatch(/Undervalued|Valuation unknown|Overvalued|Fair/);
    });
  });
});
