# CampusCart Copilot Instructions

## Project snapshot
- CampusCart is a campus marketplace with three active surfaces: `backend/` (Python 3.12 FastAPI), `frontend/` (React + TypeScript + Vite + Tailwind), and `edge/uno_q/` (Python edge assistant service).
- Backend package code lives in `backend/app/`; frontend source lives in `frontend/src/`; project docs live in `docs/`; CI is `.github/workflows/ci.yml`; deployment is defined in `render.yaml`.

## Repo layout
- `backend/app/config.py`: settings and environment variables via `pydantic-settings`.
- `backend/app/db.py`: Motor client setup and MongoDB indexes.
- `backend/app/security.py`: bcrypt password hashing, SHA-256 email sign-in codes, and JWT access tokens.
- `backend/app/deps.py`: authentication and RBAC dependencies.
- `backend/app/routers/`: feature routers for auth, stores, products, orders, plans, wallet, chat, ws, reviews, reports, admin, ai, uploads, edge, and me.
- `backend/app/services/orders.py`: order state machine and atomic inventory updates.
- `backend/app/services/llm.py`: hosted Gemma 4 (`generateContent` on `gemma-4-26b-a4b-it`) when `GEMMA_API_KEY` is set; `GEMMA_BASE_URL` selects an OpenAI-compatible or Ollama server instead. Validated JSON only.
- `backend/app/services/speech.py`: the same Gemma 4 model transcribes audio; ElevenLabs is the fallback when that key is set.
- `backend/tests/`: pytest coverage using `mongomock-motor`, `httpx` ASGI client, and `starlette` `TestClient` for WebSockets.
- `frontend/src/components/ui/`: shadcn-style primitives; use React Router, Lucide, and Vitest patterns already established in `frontend/`.
- `edge/uno_q/`: separate Python service using scoped `cc_...` seller API tokens and optional Telegram or MCP integrations.

## Validation commands
- Backend: `cd backend && pip install -r requirements-dev.txt && ruff check . && mypy app && pytest`
- Frontend: `cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build`
- Docs-only changes normally do not require build or test runs.

## Domain rules
- MongoDB documents use string UUID `_id` values.
- Store money in integer minor units only (`price_minor`, `total_minor`, and similar fields); compute totals server-side.
- Store `category` is `food`, `printing`, `handmade`, `goods`, `services`, or `lending`. A lending store is one student lending their own things.
- Product `listing_type` is one of `new`, `secondhand`, `rent`, `lend`, or `exchange`. A `lend` line reserves stock while the borrow is open and returns that stock when the seller marks the order completed. The price is a borrow fee, not a held deposit. A stall may feature at most three listings. Featuring is a free home-page flag, not a paid placement, and it does not expire.
- Karma is a reputation concept and must stay separate from money or balances.
- Order statuses are `placed`, `quote_requested`, `quoted`, `accepted`, `preparing`, `ready`, `completed`, `rejected`, `cancelled`; enforce transitions in `backend/app/services/orders.py`.
- Decrement stock atomically with a conditional update (`$gte`) and restore it at most once on cancel or reject.
- Payments are whatever that stall enabled: pay-on-pickup, manually confirmed by the seller, or campus-wallet credits. A stall that enables only campus wallet is pay upfront: debit when the price is known, no cash at collection, refund once on cancel or reject until the order is completed. The wallet is an on-campus ledger. A top-up stores the UPI transaction ID the student typed and stays requested until an admin approves it; that ID is not proof of payment, and the spendable balance does not increase before approval. Staff can reverse a posted top-up. Payouts leave the balance when requested and staff mark them paid or return them. Never claim automated UPI or bank verification. Karma stays separate from wallet balances.
- Food extras add minor units on top of the catalogue price. Print jobs with a rate card are priced from the uploaded file; printing without a rate card stays a seller quote. Voucher discounts are computed on the server from the code's rules and released if the order is cancelled or rejected. In-app notifications are stored and pushed on the chat socket.
- AI listing drafts never publish listings. `POST /api/ai/listing-draft` may only return price or stock when those values exist in the seller's source text; missing fields must remain missing. `POST /api/ai/transcribe` returns transcript text only.
- Chat uses `POST /api/chat/ws-ticket` plus `/ws/chat?ticket=...`; tickets are single-use and expire after 60 seconds, messages persist before `ack`, sequence numbers are monotonic per conversation, and missed-message recovery uses `after_seq` / `before_seq` semantics.
- Edge integrations must stay read-only against seller data unless the backend explicitly exposes a token-scoped endpoint. `edge/uno_q/` must never require shell or database access.

## Security rules
- Keep auth and RBAC logic in `backend/app/security.py`, `backend/app/deps.py`, and the relevant routers; do not bypass dependency checks in handlers.
- Treat all environment variables, JWT secrets, API tokens, and `cc_...` edge tokens as sensitive.
- Validate request bodies with Pydantic models and reject untrusted client-computed totals or sender identities.
- Preserve rate limiting, audit logging, idempotency, and inventory safety when changing auth, orders, chat, or edge flows.

## UI and theme
- Use the CampusCart palette consistently: background `#F7F5EF`, cards `#FFFFFF`, primary teal `#20B8A5`, teal hover `#159786`, navigation and headings midnight `#142B3B`, gold highlight `#FFC857` (small accents only), primary text `#182B36`, secondary text `#64748B`, borders `#E5E5DD`, success `#15803D`, warning `#A16207`, and error `#B91C1C`. White text on teal is about 2.5:1, so teal buttons use midnight text. Gold is only a highlight behind dark text.
- Use Manrope for headings and Inter for body text. A stall theme may recolor that stall’s own pages; the app shell stays on this palette.
- Prefer accessible, calm marketplace UI patterns that fit Tailwind plus the shadcn-style component system in `frontend/src/components/ui/`.

## Working style
- Make surgical changes in the relevant area instead of spreading logic across backend, frontend, and edge without need.
- Update nearby docs in `docs/` when architecture, workflows, security assumptions, or commands change.
- Do not add fake infrastructure claims: if behavior is manual, single-instance, optional, or future work, say so explicitly.
