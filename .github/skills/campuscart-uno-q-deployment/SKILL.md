---
name: campuscart-uno-q-deployment
description: Guides deployment and operations for CampusCart UNO Q. Use when changing edge rollout, secrets, Telegram setup, or MCP exposure.
---
# campuscart-uno-q-deployment

Purpose
- Prepare CampusCart UNO Q and edge-related changes for safe deployment and operations.
- Keep optional Telegram and MCP capabilities explicit and controlled.

When to use
- Use for environment setup, deployment docs, release planning, or rollout of edge assistant capabilities.
- Trigger on changes affecting `edge/uno_q/`, `render.yaml`, CI, backend edge endpoints, or operational secrets.

Procedure
1. Identify required configuration for backend edge endpoints, seller API tokens, Telegram allow-listed chat IDs, and any MCP exposure.
2. Confirm the edge service remains separate from the backend and does not require shell or direct DB access.
3. Verify environment assumptions against `backend/app/config.py`, deployment files, and operator docs.
4. Note rollout order when backend and edge changes must land together.
5. Document smoke checks and rollback triggers.

Expected outputs
- Deployment checklist, secret expectations, release caveats, and operator notes.
- Clear separation between required and optional edge features.

Completion checks
- Run `python -m compileall edge/uno_q` when edge code changed.
- Run `cd backend && pip install -r requirements-dev.txt && ruff check . && mypy app && pytest` when backend edge contracts changed.
