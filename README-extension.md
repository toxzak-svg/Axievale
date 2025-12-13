Axievale Extension

Install
- Load the `extension-dist` folder as an unpacked extension in Chrome (Developer mode) or use `src/extension` while developing.

Quick Setup
1. Start Axievale server and configure `.env`:
	- Set `EXTENSION_SECRET` (optional) to restrict extension access.
	- Set `CORS_ALLOWED_ORIGINS` to include `https://marketplace.axieinfinity.com` or the origin you will use.
2. Load the extension (`extension-dist`) in Chrome, open the popup and set the Server base URL to your server (e.g., `https://your-server.example.com`) and optional secret.

Permissions
- The extension requests minimal host permissions for the Axie marketplace. Keep `host_permissions` minimal.

Security
- Do NOT store provider API keys in this extension. Keep keys on the server.
- Use `EXTENSION_SECRET` to reduce unauthorized access from random clients.

Developer notes
- The extension calls `/api/extension/valuation` on the server; ensure CORS allows requests from the marketplace origin or set the server base URL in the extension popup to point to your API origin.
- To publish, zip the contents of `extension-dist` and upload to the Chrome Web Store Dashboard.
