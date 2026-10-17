# Security notes

- Passwords: bcrypt. JWT secret from `JWT_SECRET`; the app refuses to start in production with the dev default.
- RBAC and ownership are checked server-side on every route. Non-parties get 404 for orders and conversations.
- Never trusted from clients: prices, totals, order status, sender id, roles (request models forbid extra fields).
- Search input is regex-escaped. Uploads are content-sniffed, size-limited and renamed with random ids.
- Rate limits: auth, reports, AI and speech endpoints (per IP) and chat (per user). In-memory, per process.
- WebSocket: single-use short-lived ticket, Origin check, membership check per message, size limits, persisted before ack.
- Admin actions (deactivate, suspend, moderate, resolve, reading a reported conversation) are written to the audit log.
- AI: output is validated, ungrounded numbers are dropped, drafts never publish.
- Edge tokens: random `cc_...` values stored as SHA-256, read-only, revocable, limited to `/api/edge/*`. The UNO Q
  service has a fixed tool list, validated arguments and a Telegram chat allow-list; no shell or database access.
- Secrets live in environment variables (`.env.example`); `.env` is git-ignored.
