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

Per-user quotas & paywall
- The server supports simple per-user trial quotas and a paywall workflow.
- Register a trial user via `POST /api/users/register` — response returns `id` and `apiKey` (use as `x-user-id` and `x-user-key` request headers).
- Each new user receives `TRIAL_REQUESTS` free requests. When trial is exhausted the endpoint will return HTTP 402.
- To mark a user as paid (simulate payment webhook), call `POST /api/users/:id/activate` with header `x-extension-secret` set to your server secret.
- In production, integrate Stripe or another payment provider and call `/users/:id/activate` from your payment webhook handler.
Per-user JWT auth
- Optionally exchange `userId` + `apiKey` for a short-lived JWT with `POST /api/auth/login` (returns `token`). Requires `jsonwebtoken` and `JWT_SECRET` configured. Use the JWT as `Authorization: Bearer <token>` for future calls.

Stripe integration (webhook)
- A minimal webhook activation endpoint is available at `POST /api/payments/webhook` (not yet implemented). For now, use `POST /api/users/:id/activate` protected by `EXTENSION_SECRET` to activate paid users.
- To integrate Stripe: enable `STRIPE_SECRET` and `STRIPE_WEBHOOK_SECRET` in `.env`, install the `stripe` package, and implement the webhook to verify signatures and call `/api/users/:id/activate` on successful payment.
