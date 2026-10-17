# CampusCart Copilot Instructions

## Project snapshot
- CampusCart is a campus marketplace with three active surfaces: `backend/` (Python 3.12 FastAPI), `frontend/` (React + TypeScript + Vite + Tailwind), and `edge/uno_q/` (Python edge assistant service).
- Backend package code lives in `backend/app/`; frontend source lives in `frontend/src/`; project docs live in `docs/`; CI is `.github/workflows/ci.yml`; deployment is defined in `render.yaml`.

## Repo layout
- `backend/app/config.py`: settings and environment variables via `pydantic-settings`.
- `backend/app/db.py`: Motor client setup and MongoDB indexes.
- `backend/app/security.py`: bcrypt password hashing and JWT access tokens.
- `backend/app/deps.py`: authentication and RBAC dependencies.
- `backend/app/routers/`: feature routers for auth, stores, products, orders, chat, ws, reviews, reports, admin, ai, uploads, edge, and me.
- `backend/app/services/orders.py`: order state machine and atomic inventory updates.
- `backend/app/services/llm.py`: Gemma provider through an OpenAI-compatible or Ollama HTTP endpoint with validated JSON outputs.
- `backend/app/services/speech.py`: ElevenLabs speech-to-text integration.
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
- Product `listing_type` is one of `new`, `secondhand`, `rent`, `lend`, or `exchange`.
- Karma is a reputation concept and must stay separate from money or balances.
- Order statuses are `placed`, `quote_requested`, `quoted`, `accepted`, `preparing`, `ready`, `completed`, `rejected`, `cancelled`; enforce transitions in `backend/app/services/orders.py`.
- Decrement stock atomically with a conditional update (`$gte`) and restore it at most once on cancel or reject.
- Payments are pay-on-pickup or manually confirmed by the seller; never claim automated UPI verification.
- AI listing drafts never publish listings. `POST /api/ai/listing-draft` may only return price or stock when those values exist in the seller's source text; missing fields must remain missing. `POST /api/ai/transcribe` returns transcript text only.
- Chat uses `POST /api/chat/ws-ticket` plus `/ws/chat?ticket=...`; tickets are single-use and expire after 60 seconds, messages persist before `ack`, sequence numbers are monotonic per conversation, and missed-message recovery uses `after_seq` / `before_seq` semantics.
- Edge integrations must stay read-only against seller data unless the backend explicitly exposes a token-scoped endpoint. `edge/uno_q/` must never require shell or database access.

## Security rules
- Keep auth and RBAC logic in `backend/app/security.py`, `backend/app/deps.py`, and the relevant routers; do not bypass dependency checks in handlers.
- Treat all environment variables, JWT secrets, API tokens, and `cc_...` edge tokens as sensitive.
- Validate request bodies with Pydantic models and reject untrusted client-computed totals or sender identities.
- Preserve rate limiting, audit logging, idempotency, and inventory safety when changing auth, orders, chat, or edge flows.

## UI and theme
- Use the CampusCart palette consistently: background `#F7F4ED`, cards `#FFFFFF`, primary `#C65D3A`, headings/navigation `#263D32`, charcoal body text, and muted taupe secondary accents.
- Use Manrope for headings and Inter for body text.
- Prefer accessible, calm marketplace UI patterns that fit Tailwind plus the shadcn-style component system in `frontend/src/components/ui/`.

## Working style
- Make surgical changes in the relevant area instead of spreading logic across backend, frontend, and edge without need.
- Update nearby docs in `docs/` when architecture, workflows, security assumptions, or commands change.
- Do not add fake infrastructure claims: if behavior is manual, single-instance, optional, or future work, say so explicitly.
