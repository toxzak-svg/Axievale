Axievale Extension

Install
- Load the `src/extension` folder as an unpacked extension in Chrome (Developer mode).

Permissions
- The extension requests minimal host permissions for the Axie marketplace. Provide server base URL in popup if your server isn't the same origin as the marketplace.

Security
- Do NOT store provider API keys in this extension. Use server-side hosting and set `EXTENSION_SECRET` in server `.env` and configure the extension popup with that secret if you want restricted access.

Developer notes
- The extension calls `/api/extension/valuation` on the server; ensure CORS allows requests from the marketplace origin or serve the extension from the same origin as the API.
