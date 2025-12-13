document.getElementById('save').addEventListener('click', async () => {
  const baseUrl = document.getElementById('baseUrl').value.trim();
  const extSecret = document.getElementById('extSecret').value.trim();
  if (baseUrl) await chrome.storage.sync.set({ baseUrl });
  if (extSecret) await chrome.storage.sync.set({ extensionSecret: extSecret });
  window.close();
});

// load existing
(async () => {
  const vals = await chrome.storage.sync.get(['baseUrl', 'extensionSecret']);
  if (vals.baseUrl) document.getElementById('baseUrl').value = vals.baseUrl;
  if (vals.extensionSecret) document.getElementById('extSecret').value = vals.extensionSecret;
})();
