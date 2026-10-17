---
name: campuscart-deployment-release
description: Guides CampusCart release and deployment coordination. Use when changing CI, Render, Atlas, secrets, or rollout sequencing.
---
# campuscart-deployment-release

Purpose
- Coordinate CampusCart deployment, CI, and release readiness across backend, frontend, and edge surfaces.
- Keep operator guidance aligned with the actual stack.

When to use
- Use for release prep, CI failures, environment changes, `render.yaml` updates, secret planning, or rollout sequencing.
- Trigger on tasks involving GitHub Actions, Render, Atlas, or multi-surface release coordination.

Procedure
1. Inspect `render.yaml`, `.github/workflows/ci.yml`, environment usage in `backend/app/config.py`, and any edge service assumptions.
2. Check which validations must pass for the release and which services must deploy together.
3. Document secret requirements, smoke tests, rollback points, and any single-instance limitations.
4. Ensure operator docs in `docs/` stay current when workflows or environment expectations change.
5. Escalate security-sensitive configuration review when auth, tokens, or AI providers are involved.

Expected outputs
- Release checklist, CI/deployment change notes, required secrets, and rollout/rollback guidance.
- Clear mapping of which teams or agents own each release step.

Completion checks
- Backend command is listed or run when backend changed: `cd backend && pip install -r requirements-dev.txt && ruff check . && mypy app && pytest`
- Frontend command is listed or run when frontend changed: `cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build`
- Edge command is listed or run when edge changed: `python -m compileall edge/uno_q`
