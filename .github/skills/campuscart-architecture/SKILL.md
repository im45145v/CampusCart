---
name: campuscart-architecture
description: Defines CampusCart system boundaries and design decisions. Use when work spans backend, frontend, edge, or deployment concerns.
---
# campuscart-architecture

Purpose
- Evaluate CampusCart architecture decisions before implementation so responsibilities stay in the correct layer.
- Protect clear boundaries among FastAPI backend, React frontend, and `edge/uno_q/` seller assistant tooling.

When to use
- Use for new subsystem design, major refactors, or tasks touching multiple routers, services, and client flows.
- Trigger when a prompt asks where logic should live or how components should collaborate.

Procedure
1. Inspect the relevant backend routers in `backend/app/routers/`, service modules in `backend/app/services/`, and frontend routes/components in `frontend/src/`.
2. Decide whether the change belongs in API handlers, service modules, shared dependencies, client presentation, or the edge service.
3. Preserve known boundaries: order transitions in `backend/app/services/orders.py`, auth/RBAC in `backend/app/security.py` and `backend/app/deps.py`, AI validation in backend services, token-scoped edge access in `backend/app/routers/edge.py` and `edge/uno_q/`.
4. Call out data, security, rollout, and documentation impacts.
5. Recommend the implementing agent and skill set.

Expected outputs
- Architecture decision summary with touched paths and rationale.
- Risks, alternatives considered, and required docs updates.

Completion checks
- No responsibility is pushed to the wrong layer just for convenience.
- Required verification commands are identified for each touched surface.
