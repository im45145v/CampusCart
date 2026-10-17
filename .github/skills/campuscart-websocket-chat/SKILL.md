---
name: campuscart-websocket-chat
description: Guides CampusCart real-time chat changes. Use when touching WebSocket tickets, sequencing, persistence, reconnect, or chat UI contracts.
---
# campuscart-websocket-chat

Purpose
- Maintain CampusCart real-time chat behavior without weakening delivery, auth, or recovery guarantees.
- Keep WebSocket, persistence, and REST recovery endpoints consistent.

When to use
- Use for `/ws/chat`, chat ticket issuance, message persistence, ordering, reconnect, and chat UI/API coordination.
- Trigger on changes in `backend/app/routers/chat.py`, `backend/app/routers/ws.py`, related services, or chat-facing frontend code.

Procedure
1. Preserve the single-use 60-second ticket flow from `POST /api/chat/ws-ticket` to `/ws/chat?ticket=...`.
2. Persist each message before `ack`, derive sender from the authenticated connection, and maintain monotonic per-conversation `seq` values.
3. Keep missed-message recovery through `GET /api/chat/conversations/{id}/messages?after_seq=` and pagination through `before_seq`.
4. Respect client idempotency via `client_id`, plus in-memory rate limiting and in-memory connection management unless a scaling task says otherwise.
5. Add backend tests and coordinate frontend updates when transport semantics surface in the UI.

Expected outputs
- Correct chat transport or recovery implementation, tests, and UX/API notes.
- Clear statement of any single-instance limitations that remain.

Completion checks
- Run `cd backend && pip install -r requirements-dev.txt && ruff check . && mypy app && pytest`
- If chat UI changed, also run `cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build`
