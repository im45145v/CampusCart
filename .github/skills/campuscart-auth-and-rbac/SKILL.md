---
name: campuscart-auth-and-rbac
description: Guides CampusCart authentication and authorization changes. Use when touching JWTs, role checks, protected routes, or scoped tokens.
---
# campuscart-auth-and-rbac

Purpose
- Change or review CampusCart authentication, authorization, and token-scoped access safely.
- Keep role checks and trust boundaries centralized in backend dependencies.

When to use
- Use for login, JWT handling, seller/admin permissions, protected endpoints, edge tokens, or chat ticket auth.
- Trigger on work involving `backend/app/security.py`, `backend/app/deps.py`, auth routers, admin routes, or `/api/edge/*` access.

Procedure
1. Start with `backend/app/security.py`, `backend/app/deps.py`, and the owning router.
2. Confirm bcrypt hashing, JWT access token flow, and role checks remain enforced through dependencies instead of inline shortcuts.
3. Preserve seller-only AI draft access, admin-only routes, single-use 60s WebSocket tickets, and scoped `cc_...` seller tokens.
4. Add backend tests for allowed and denied cases.
5. Check whether frontend messaging or edge behavior needs updates.

Expected outputs
- Secure auth/RBAC implementation, tests, and concise permission notes.
- Findings for missing checks, over-broad tokens, or trust-boundary regressions.

Completion checks
- Run `cd backend && pip install -r requirements-dev.txt && ruff check . && mypy app && pytest`
- If UI behavior or auth copy changed, also run `cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build`
