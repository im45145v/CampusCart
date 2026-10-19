---
name: campuscart-api-development
description: Guides UniCart FastAPI endpoint and service work. Use when adding or modifying backend routes, models, or business logic.
---
# campuscart-api-development

Purpose
- Add or modify UniCart FastAPI endpoints and backend behavior in `backend/app/`.
- Keep request validation, RBAC, service logic, and tests in sync.

When to use
- Use for new routers, endpoint changes, response shape updates, and backend business rules.
- Trigger on tasks affecting auth, stores, products, orders, chat, reviews, reports, admin, AI, uploads, edge, or `me` routes.

Procedure
1. Identify the owning router in `backend/app/routers/` and any shared dependencies in `config.py`, `deps.py`, `security.py`, `ratelimit.py`, or `audit.py`.
2. Put reusable business logic in service modules such as `backend/app/services/orders.py` or `backend/app/services/llm.py` instead of duplicating it in handlers.
3. Validate inputs and outputs with Pydantic models and preserve audit, auth, and rate-limit behavior.
4. Update or add tests in `backend/tests/` using the existing `mongomock-motor`, `httpx`, and WebSocket patterns.
5. Note whether the frontend or edge service must also change.

Expected outputs
- Endpoint implementation, service updates, tests, and contract notes.
- Explicit mention of any data model or security implications.

Completion checks
- Run `cd backend && pip install -r requirements-dev.txt && ruff check . && mypy app && pytest`
- Ensure no client-trusted totals, sender IDs, or payment-verification claims were introduced.
