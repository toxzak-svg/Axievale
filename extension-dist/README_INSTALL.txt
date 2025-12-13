Axievale Extension - Install & Publish Notes

Install locally (developer mode):
1. Open Chrome and go to chrome://extensions
2. Enable "Developer mode" (top-right)
3. Click "Load unpacked" and select the `extension-dist` folder in this repo
4. Open the Axie Marketplace and configure the extension (click extension icon -> Axievale) and set your server base URL (e.g., https://your-server.example.com) and optional extension secret if configured on the server.

Publish:
- Zip the contents of `extension-dist` (NOT the folder itself) and upload to the Chrome Web Store Developer Dashboard.
- Ensure your manifest.json `permissions` and `host_permissions` are accurate and minimal.
- Do NOT include any provider API keys in the extension. Keep keys on your server and set `EXTENSION_SECRET` to restrict access.

Server setup:
- Configure `.env` on server: set `EXTENSION_SECRET`, `CORS_ALLOWED_ORIGINS` (include https://marketplace.axieinfinity.com), and any rate limit values if desired.
- Start the server and ensure `/api/extension/valuation` is reachable from the origin you allow.

Security reminders:
- Do NOT put provider API keys in the extension package.
- Use server-side keys and the optional `EXTENSION_SECRET` to restrict access from the extension.
