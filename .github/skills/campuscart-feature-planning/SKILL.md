---
name: campuscart-feature-planning
description: Plans cross-surface UniCart features and delivery slices. Use when a request needs scoping, acceptance criteria, or implementation sequencing.
---
# campuscart-feature-planning

Purpose
- Break a UniCart feature request into implementation slices across `backend/`, `frontend/`, `edge/uno_q/`, `docs/`, and deployment files when needed.
- Keep the plan anchored to real repo paths and core product rules.

When to use
- Use when a task spans more than one surface or needs acceptance criteria before coding.
- Trigger on requests for scoping, implementation plans, handoffs, milestones, or cross-team coordination.

Procedure
1. Identify the affected user roles, flows, and constraints.
2. Map the change to concrete files such as `backend/app/routers/*.py`, `backend/app/services/*.py`, `frontend/src/`, `edge/uno_q/`, `render.yaml`, or `docs/`.
3. List domain invariants that must hold: money in minor units, explicit order statuses, seller-scoped edge access, AI draft-only behavior, manual payment confirmation.
4. Split work into backend, frontend, database, edge, QA, security, and docs slices only when necessary.
5. Assign the smallest reasonable set of UniCart agents and skills for execution.

Expected outputs
- Scope summary, non-goals, touched paths, risks, and verification plan.
- Ordered implementation sequence with clear handoffs.

Completion checks
- Every touched surface has an owner and verification command.
- Backend validation is listed when backend behavior changes: `cd backend && pip install -r requirements-dev.txt && ruff check . && mypy app && pytest`
- Frontend validation is listed when UI changes: `cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build`
