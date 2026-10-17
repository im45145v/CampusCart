# Architecture

```
React SPA (frontend/)  --REST-->  FastAPI (backend/app) --> MongoDB Atlas
        |                              ^   |
        +------ WebSocket /ws/chat ----+   +--> Gemma (OpenAI-compatible endpoint, optional)
                                           +--> ElevenLabs speech-to-text (optional)
UNO Q service (edge/uno_q) --read-only API token--> /api/edge/*
```

- **Roles:** one account may be buyer and seller. `seller` is granted when a user creates a store; `admin` can only
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
  Payment is pay-on-pickup or paid directly to the seller; the seller manually confirms. No payment is verified.
- **Chat:** see [api.md](api.md#chat). Messages get a per-conversation monotonic `seq`; clients recover missed
  messages with `after_seq` and page history with `before_seq`. The connection manager is in-memory, so with more than
  one backend instance a pub/sub layer (e.g. Redis) is required. Chat does not depend on AI/speech/edge integrations;
  if the WebSocket is down the client falls back to the REST send endpoint.
- **AI:** `app/services/llm.py` turns informal text into a draft. Output is validated; price, stock and prep time are
  dropped unless the number literally appears in the seller's text. The AI never publishes: the seller reviews and
  submits the form, and listings start unpublished.
- **Edge:** `edge/uno_q` is a separate service using scoped read-only tokens (`cc_...`, stored hashed).
- **Collections:** users, stores, products, orders, conversations, messages, reviews, reports, audit_logs,
  ws_tickets (TTL), api tokens. Indexes are created at startup (`app/db.py`).
