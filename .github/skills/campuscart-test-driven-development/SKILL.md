---
name: campuscart-test-driven-development
description: Guides test-first CampusCart changes. Use when a bug or feature should be reproduced with automated tests before implementation.
---
# campuscart-test-driven-development

Purpose
- Drive CampusCart changes through failing tests first when behavior is well-defined and regression risk is meaningful.
- Keep tests close to the touched surface and domain invariant.

When to use
- Use for bug fixes, state-machine changes, auth work, chat sequencing changes, and any feature with clear expected behavior.
- Trigger when the task benefits from reproducing the problem before implementing the fix.

Procedure
1. Reproduce the current behavior with a backend or frontend test before changing implementation.
2. Place backend tests in `backend/tests/` using the existing `mongomock-motor`, `httpx`, and WebSocket tools; place frontend tests beside the relevant feature patterns in `frontend/`.
3. Implement the minimal code change that makes the new test pass while preserving existing invariants.
4. Run the narrowest relevant tests during iteration, then finish with the repo’s standard validation command for the touched surface.
5. Record any manual checks needed when full automation is not practical.

Expected outputs
- New or updated automated tests, reproducible failure proof, and verified fix.
- Clear note if a case cannot yet be automated.

Completion checks
- Backend work ends with `cd backend && pip install -r requirements-dev.txt && ruff check . && mypy app && pytest`
- Frontend work ends with `cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build`
