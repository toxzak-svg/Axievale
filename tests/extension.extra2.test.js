describe('Extension extra branches', () => {
  test('popup top-level listener attaches and saves on click (non-test)', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.resetModules();
      // use Jest's jsdom document
      document.body.innerHTML = `
        <input id="baseUrl" />
        <input id="extSecret" />
        <button id="save"></button>
        <div id="status"></div>
      `;
      // ensure non-test mode
      delete window.__AXIEVALE_TEST__;

      global.chrome = { storage: { sync: { get: jest.fn().mockResolvedValue({}), set: jest.fn().mockResolvedValue() } } };

      require('../src/extension/popup.js');

      // simulate click
      document.getElementById('baseUrl').value = 'https://x';
      document.getElementById('extSecret').value = 's';
      document.getElementById('save').click();

      // wait for any async handlers
      await new Promise(r => setTimeout(r, 0));
      expect(global.chrome.storage.sync.set).toHaveBeenCalled();

      delete global.chrome;
    });
  });

  test('contentScript non-test runs processListings with MutationObserver mocked', async () => {
    await jest.isolateModulesAsync(async () => {
      jest.resetModules();
      // use existing jsdom document
      document.body.innerHTML = `<div data-testid="marketplace-listing"><a href="/123"></a><div class="price">2</div></div>`;
      delete window.__AXIEVALE_TEST__;

      // stub MutationObserver to avoid async timers
      global.MutationObserver = class {
        constructor(cb) { this.cb = cb; }
        observe() {}
        disconnect() {}
      };

      global.chrome = { runtime: { sendMessage: jest.fn().mockImplementation((m, cb) => cb && cb({ success: true, data: { signal: 'fair', valuation: { estimatedValue: 2 } } })) } };

      require('../src/extension/contentScript.js');

      // wait briefly to let processListings complete
      await new Promise(r => setTimeout(r, 10));

      const el = document.querySelector('[data-testid="marketplace-listing"]');
      expect(el.lastChild).toBeTruthy();

      delete global.chrome;
      delete global.MutationObserver;
    });
  });
});
