# Security notes

- Sign-in: email a 6-digit code and a one-time link (10 minutes, 5 guesses, SHA-256 at rest, single use). Production sends them with Resend and never returns the code. Development without `RESEND_API_KEY` returns `dev_code` for local use. Password login remains for seeded accounts: bcrypt, and accounts created by email have no password hash. JWT secret from `JWT_SECRET`; the app refuses to start in production with the dev default.
- RBAC and ownership are checked server-side on every route. Non-parties get 404 for orders and conversations.
- Never trusted from clients: prices, totals, order status, sender id, roles (request models forbid extra fields). A payment method is accepted only when that stall enabled it.
- Search input is regex-escaped. Uploads are content-sniffed, size-limited and renamed with random ids.
- Rate limits: auth, reports, AI and speech endpoints (per IP) and chat (per user). In-memory, per process.
- WebSocket: single-use short-lived ticket, Origin check, membership check per message, size limits, persisted before ack.
- Admin actions (deactivate, suspend, moderate, resolve, reading a reported conversation) are written to the audit log.
- AI: output is validated, ungrounded numbers are dropped, drafts never publish.
- Edge tokens: random `cc_...` values stored as SHA-256, read-only, revocable, limited to `/api/edge/*`. The UNO Q
  service has a fixed tool list, validated arguments and a Telegram chat allow-list; no shell or database access.
- Secrets live in environment variables (`.env.example`); `.env` is git-ignored.
- Wallet top-ups use YouPI-PG. `YOUPI_API_URL`, `YOUPI_MERCHANT_ID`, and `YOUPI_WEBHOOK_SECRET` must all be set. The webhook secret is the HMAC key and the merchant key; it is not returned by any route. `POST /api/payments/youpi` verifies `X-Gateway-Signature` over the raw body, then re-reads the payment with that key. The balance moves only when that record is a verified UPI success for the checkout UniCart created, for the same amount. A browser success flag, a cash-on-delivery callback, and an admin approve call do not credit a YouPI top-up. `POST /api/me/wallet/add` is retired.
