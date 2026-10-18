# API contracts

Base path `/api`. JSON bodies use strict schemas (unknown fields are rejected with 422). Authenticated calls send the
login JWT in the standard `Authorization` bearer header. Interactive docs are at `/docs` on the running backend; the
routers in `backend/app/routers/` are the source of truth.

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (rate limited) |
| Home | `GET /home`, `GET /health` |
| Stores | `GET /stores`, `POST /stores` (starts `pending`), `POST /stores/{id}/resubmit`, `GET /stores/mine`, `GET/PATCH /stores/{id}`, `GET /stores/{id}/order-options`, `GET /stores/{id}/reviews` |
| Products | `GET /products` (q, category, store, price, availability), `POST /stores/{id}/products` (draft), `GET/PATCH /products/{id}`, `POST /products/{id}/publish`, `/unpublish` |
| Orders | `POST /orders`, `GET /orders`, `GET /seller/orders`, `GET /orders/{id}`, `POST /orders/{id}/status`, `/quote`, `/confirm-payment`, `/review`, `GET /orders/{id}/review`, `POST /products/{id}/print-preview` |
| Notifications | `GET /me/notifications`, `POST /me/notifications/read` |
| Wallet | `GET /me/wallet`, `POST /me/wallet/add`, `POST /me/wallet/remove`. Admin: `GET /admin/wallet`, `POST /admin/wallet/{id}/paid`, `/return`, `/reverse` |
| Plans | `GET/POST /stores/{id}/plans`, `PATCH /plans/{id}`, `POST /plans/{id}/subscribe`, `GET /me/subscriptions`, `POST /subscriptions/{id}/renew`, `/cancel`, `GET /stores/{id}/subscribers` |
| Vouchers | `GET /stores/{id}/vouchers`, `POST /stores/{id}/vouchers`, `PATCH /vouchers/{id}` (`active`), `POST /vouchers/preview`, admin `GET/POST /admin/vouchers` |
| Account | saved stores under `/me/saved-stores`, `GET /seller/summary`, `GET /seller/charts`, API tokens under `/seller/api-tokens` |
| Reports | `POST /reports` |
| Admin | users, stores, products moderation, reports (`/admin/reports`, `/resolve`, reported conversation), `GET /admin/audit`, `POST /admin/stores/{id}/decision` (`approved` or `rejected` while `pending`) |
| AI | `POST /ai/listing-draft` and `POST /ai/transcribe` use hosted Gemma 4 when `GEMMA_API_KEY` is set (503 means type the listing) |
| Uploads | `POST /uploads` (seller; PNG/JPEG/WebP), `POST /uploads/documents` (any logged-in user; PDF or image, page count returned) |
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
`payment_options` may include `campus_wallet`. That method debits the buyer's campus-wallet balance when the
catalogue total is known, or when the buyer accepts a quote. Cancel and reject credit it back once. Completing the
order credits the seller the same amount. `POST /orders/{id}/confirm-payment` rejects a wallet-paid order.
`POST /me/wallet/add` records a campus-ledger top-up (₹10–₹2,000, ₹5,000 per UTC day) and does not verify UPI.
`POST /me/wallet/remove` debits a payout request that staff later mark paid or return.

An active store plan discounts catalogue orders by `discount_percent` (server-side, before the wallet debit).
A voucher code on `POST /orders` (`voucher_code`) is checked the same way. `POST /vouchers/preview` shows the discount before the order is placed. Percent or a fixed amount, after the membership share, and only on lines the code covers. Conditions can require a first campus order, a first order at that store, a new account, a minimum covered subtotal, a minimum item count, a category, a product kind, or a payment option. Each student can use a code once. Cancel or reject releases that use. Quote-only orders cannot take a code. The store receives the discounted total; nothing here reimburses the difference.
Food extras (`addons` on a product, picks on an order line) are priced per item in minor units and included in that discount.
A printing listing with `print_spec` is priced from the uploaded file: impressions = pages × copies, sheets = ceil(pages / sides) × copies, then paper, binding, and an integer urgent percent. Membership discount does not apply to that print total. Printing without a rate card stays a seller quote.
`GET /me/notifications` is the bell. New orders, status changes, quotes, messages, store decisions, and desk wallet actions insert a row and push `{type: "notification"}` on the chat socket. The socket list is still in-memory.
Printing quotes are not discounted. Subscribing, renewing, and the first period are wallet debits. Cancelling does
not refund the current period. One active subscription per buyer per store.

`POST /reviews/{id}/reply` lets the store owner reply once. Reviews may include `aspects` of quality, timing, and value.
Order changes are also pushed on `/ws/chat` as `{type: "order", order}`.

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
`message`, `typing`, `read`, `presence {user_id, online}`, `pong`, `error {code}`.
`presence` is pushed when a conversation partner connects or their last socket closes, and the connecting user is told who is already online.
The connection list is in-memory, so presence and live delivery stay on one API process.
Sender identity comes from the ticket's user. Non-members get `not_found`. Limits: message length, frame size and
10 messages per 10 s per user.
