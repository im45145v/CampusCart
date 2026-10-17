# API contracts

Base path `/api`. JSON bodies use strict schemas (unknown fields are rejected with 422). Authenticated calls send the
login JWT in the standard `Authorization` bearer header. Interactive docs are at `/docs` on the running backend; the
routers in `backend/app/routers/` are the source of truth.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (rate limited) |
| Home | `GET /home`, `GET /health` |
| Stores | `GET /stores`, `POST /stores`, `GET /stores/mine`, `GET/PATCH /stores/{id}`, `GET /stores/{id}/reviews` |
| Products | `GET /products` (q, category, store, price, availability), `POST /stores/{id}/products` (draft), `GET/PATCH /products/{id}`, `POST /products/{id}/publish`, `/unpublish` |
| Orders | `POST /orders`, `GET /orders`, `GET /seller/orders`, `GET /orders/{id}`, `POST /orders/{id}/status`, `/quote`, `/confirm-payment`, `/review` |
| Account | saved stores under `/me/saved-stores`, `GET /seller/summary`, API tokens under `/seller/api-tokens` |
| Reports | `POST /reports` |
| Admin | users, stores, products moderation, reports (`/admin/reports`, `/resolve`, reported conversation), `GET /admin/audit` |
| AI | `POST /ai/listing-draft` (503 means use the manual form), `POST /ai/transcribe` |
| Uploads | `POST /uploads` (seller; PNG/JPEG/WebP, size limited, content sniffed) |
| Edge | `GET /edge/pending-orders`, `/edge/orders/{id}/summary`, `/edge/low-stock`, `/edge/today-sales`, `/edge/products/availability` (API token only) |

Order creation: `{store_id, items:[{product_id, variant_id?, quantity}], fulfillment, payment_method, note, ...}`.
Prices and status in the body are rejected. Illegal status transitions return 409.

## Chat
REST (`/api/chat`): start or resume a conversation (store, optional order/product), list inbox (unread + last message),
unread count, message history (`after_seq` for missed messages, `before_seq` for older pages), REST send fallback,
mark read, and `POST /ws-ticket`.

WebSocket `/ws/chat?ticket=<single-use ticket, valid 60 s>`. The JWT is never put in a URL. A bad, used or expired
ticket is rejected; a disallowed `Origin` is rejected.

Client frames: `send {conversation_id, text, client_id}`, `read {conversation_id, up_to_seq}`,
`typing {conversation_id}`, `ping`.
Server frames: `ready`, `ack` (only after the message is stored; retrying the same `client_id` is idempotent),
`message`, `typing`, `read`, `pong`, `error {code}`.
Sender identity comes from the ticket's user. Non-members get `not_found`. Limits: message length, frame size and
10 messages per 10 s per user.
