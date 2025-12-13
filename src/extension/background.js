// Background service worker (MV3) for extension
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'getValuation') {
    (async () => {
      try {
        const { axieId, listingPrice } = message;
        const body = { axieId };
        if (listingPrice !== undefined) body.listingPrice = listingPrice;

        // Read configured server base URL and optional secret from storage
        const vals = await chrome.storage.sync.get(['baseUrl', 'extensionSecret']);
        const baseUrl = vals.baseUrl || '';
        const extensionSecret = vals.extensionSecret || '';

        const headers = { 'Content-Type': 'application/json' };
        if (extensionSecret) headers['x-extension-secret'] = extensionSecret;

        const endpoint = (baseUrl && baseUrl.length)
          ? `${baseUrl.replace(/\/$/, '')}/api/extension/valuation`
          : '/api/extension/valuation';

        const resp = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(body)
        });

        if (!resp.ok) {
          const text = await resp.text();
          sendResponse({ success: false, error: `HTTP ${resp.status}: ${text}` });
          return;
        }

        const data = await resp.json();
        sendResponse(data);
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true; // indicate async response
  }
});
