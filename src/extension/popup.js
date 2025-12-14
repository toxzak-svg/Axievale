// Test mode flag
const __AXIEVALE_IS_TEST = (typeof window !== 'undefined') && window.__AXIEVALE_TEST__;

// Only attach the simple top-level click handler in non-test runtimes
if (!__AXIEVALE_IS_TEST) {
  const saveBtn = document.getElementById('save');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const baseUrl = document.getElementById('baseUrl').value.trim();
      const extSecret = document.getElementById('extSecret').value.trim();
      if (baseUrl) await chrome.storage.sync.set({ baseUrl });
      if (extSecret) await chrome.storage.sync.set({ extensionSecret: extSecret });
      try { window.close(); } catch (e) { /* ignore in non-browser envs */ }
    });
  }
}

// load existing

  async function initPopup() {
    document.getElementById('save').addEventListener('click', async () => {
      const baseUrl = document.getElementById('baseUrl').value.trim();
      const extSecret = document.getElementById('extSecret').value.trim();
      if (baseUrl) await chrome.storage.sync.set({ baseUrl });
      if (extSecret) await chrome.storage.sync.set({ extensionSecret: extSecret });
      // show simple saved feedback
      const status = document.getElementById('status');
      if (status) status.textContent = 'Saved';
    });

    const vals = await chrome.storage.sync.get(['baseUrl', 'extensionSecret']);
    if (vals && vals.baseUrl) document.getElementById('baseUrl').value = vals.baseUrl;
    if (vals && vals.extensionSecret) document.getElementById('extSecret').value = vals.extensionSecret;
  }

  if (!__AXIEVALE_IS_TEST) {
    // Auto-init in normal extension runtime
    initPopup();
  } else {
    // Expose init for tests to call manually
    try { window.__axievale_test_api = window.__axievale_test_api || {}; window.__axievale_test_api.initPopup = initPopup; } catch (e) {}
  }
