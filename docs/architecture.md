# Architecture

```
React SPA (frontend/)  --REST-->  FastAPI (backend/app) --> MongoDB Atlas
        |                              ^   |
        +------ WebSocket /ws/chat ----+   +--> Gemma 4 (Gemini generateContent, or a local OpenAI-compatible URL)
                                           +--> ElevenLabs speech-to-text (optional fallback)
UNO Q service (edge/uno_q) --read-only API token--> /api/edge/*
```

- **Roles:** one account may be buyer and seller. `seller` is granted when a user applies for a store. A new store is `pending` until an admin approves it (`POST /api/admin/stores/{id}/decision`); until then it is hidden and cannot take orders. A rejected store can be submitted again. `admin` can only
  be granted with `python -m scripts.create_admin <email>` (run from `backend/`). Permissions are enforced in
  `app/deps.py` and in each router (ownership checks).
- **Money** is stored as integer minor units (`*_minor`). Totals are always computed by the server from stored prices.
- **Catalogue:** one `products` shape serves food, printing, handmade, goods and services. A listing type field covers
  new, second-hand, rent, lend and exchange. A karma value is a separate integer and never mixes with money
  (a karma ledger and exchange flow are not implemented yet).
- **Orders** (`app/services/orders.py`): statuses `placed, quote_requested, quoted, accepted, preparing, ready,
  completed, rejected, cancelled`. Transitions are table-driven per actor. Stock is reserved with a conditional
  atomic update (`stock >= qty`) so concurrent orders cannot oversell; it is restored exactly once on cancel/reject.
  Printing orders start as `quote_requested`; the seller sends a manual quote and the buyer approves it.
  Payment is pay-on-pickup, paid directly to the seller (seller confirms), or campus-wallet credits.
  Campus wallet is an on-campus ledger in `wallet_ledger`: the student records a top-up, staff can reverse it,
  and payouts are requests the desk marks paid. No UPI or bank payment is verified. Wallet charges are atomic
  (`balance >= amount`). Catalogue orders from an active store plan are discounted on the server; quote orders are not.
  Completing a wallet-paid order credits the seller the charged amount (no platform fee). Cancel or reject refunds it once.
- **Plans:** sellers publish up to six memberships (`plans`). Subscribing or renewing debits the campus wallet.
  There is no card charge and no silent auto-renew. One active subscription per buyer per store.
- **Vouchers:** store codes and campus-wide codes live in `vouchers`. Checkout computes the discount in minor units
  after any membership share. One use per student is held on the order and released on cancel or reject. The store
  receives the amount the student pays.
- **Live orders:** status, quote, and payment changes are pushed on the existing `/ws/chat` socket as `{type: "order"}`.
  The connection manager is still in-memory.
- **Reviews:** one review per completed order, with optional quality, timing, and value scores. The store owner may reply once.
- **Chat:** see [api.md](api.md#chat). Messages get a per-conversation monotonic `seq`; clients recover missed
  messages with `after_seq` and page history with `before_seq`. A `presence` frame tells partners when someone
  connects or their last socket closes. The connection manager is in-memory, so with more than
  one backend instance a pub/sub layer (e.g. Redis) is required. Chat does not depend on AI/speech/edge integrations;
  if the WebSocket is down the client falls back to the REST send endpoint.
- **AI:** `app/services/llm.py` turns informal text into a draft with hosted Gemma 4 when `GEMMA_API_KEY` is set.
  Dictation sends the recording to the same model. Output is validated; price, stock and prep time are
  dropped unless the number literally appears in the seller's text. The AI never publishes: the seller reviews and
  submits the form, and listings start unpublished. `GEMMA_BASE_URL` keeps the local OpenAI-compatible path.
- **Edge:** `edge/uno_q` is a separate service using scoped read-only tokens (`cc_...`, stored hashed).
- **Extras and print pricing:** food add-ons add integer minor units on top of the catalogue price. A print listing
  with a rate card is priced from the file's page count (PDF via pypdf, images as one page) before the seller sees the job.
  Printing without a rate card stays a manual quote. The connection that pushes notifications is the same in-memory chat socket.
- **Collections:** users, stores, products, orders, conversations, messages, reviews, reports, audit_logs,
  wallet_ledger, plans, subscriptions, notifications, vouchers, voucher_redemptions, ws_tickets (TTL), api tokens. Indexes are created at startup (`app/db.py`).
