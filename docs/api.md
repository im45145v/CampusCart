# API contracts

Base path `/api`. JSON bodies use strict schemas (unknown fields are rejected with 422). Authenticated calls send the
login JWT in the standard `Authorization` bearer header. Interactive docs are at `/docs` on the running backend; the
routers in `backend/app/routers/` are the source of truth.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (rate limited) |
| Home | `GET /home`, `GET /health` |
| Stores | `GET /stores`, `POST /stores`, `GET /stores/mine`, `GET/PATCH /stores/{id}`, `GET /stores/{id}/order-options`, `GET /stores/{id}/reviews` |
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

## Store branding and ordering rules
Stores carry `banner_url` (own `/uploads/...` or `https://` only), `tagline`, `announcement`, a `theme`
(`primary`, `accent`, `background` as `#RRGGBB`, `font`, `radius`; anything else is a 422, so no CSS can be injected)
and `order_settings`. `PATCH` merges partial `theme`/`order_settings`; `banner_url: null` clears the banner.

`order_settings` is enforced by the server in `services/orders.py`: allowed `fulfillment_options` and `payment_options`,
`max_qty_per_item`, `min_order_minor` (quote-based printing is exempt), buyer-facing `custom_fields` (text, select,
checkbox; `required` honoured), and optional pickup time slots (`slots` as `HH:MM-HH:MM`, `slot_days_ahead`,
`slot_capacity`, `utc_offset_min`, default 330 = IST). Orders then accept `pickup_slot: {date, label}` and
`answers: {field_id: value}`, and store `pickup_slot`, `answers` and `est_wait_min`
(`lead_time_min` + `queue_min_per_order` per open order + the slowest item's `prep_time_min`).
`GET /stores/{id}/order-options` returns the settings plus live slot availability for the checkout UI.

Limits: slot capacity is re-checked after insert, so a simultaneous last-place booking fails safe with 409. Slots
are per store, not per item, and the wait time is an estimate, not a promise.

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
