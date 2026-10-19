# UniCart Copilot workflows

Use `.github/copilot-instructions.md` as the baseline context, then select the narrowest agent and skill pair that matches the task.

| Task | Primary agent | Supporting agent(s) | Recommended skill(s) | Notes |
| --- | --- | --- | --- | --- |
| New feature spanning UI, API, and data flow | `product-architect` | `frontend-engineer`, `backend-api-engineer`, `database-engineer`, `qa-test-engineer` | `campuscart-feature-planning`, `campuscart-architecture`, then implementation skill(s) | Start with scope, acceptance criteria, data contracts, and verification plan before editing code. |
| New API endpoint or backend behavior | `backend-api-engineer` | `database-engineer`, `security-engineer`, `qa-test-engineer` | `campuscart-api-development`, plus `campuscart-auth-and-rbac` or `campuscart-order-workflows` when relevant | Touch routers in `backend/app/routers/`, shared deps, services, and backend tests together. |
| Frontend flow or component change | `frontend-engineer` | `ui-ux-designer`, `qa-test-engineer` | `campuscart-ui-development`, `campuscart-test-driven-development` | Match existing React Router, Tailwind, shadcn-style, and theme conventions. |
| Chat or WebSocket behavior change | `backend-api-engineer` | `frontend-engineer`, `qa-test-engineer`, `security-engineer` | `campuscart-websocket-chat`, `campuscart-api-development` | Preserve ticket auth, monotonic `seq`, persisted-before-ack semantics, and recovery endpoints. |
| Order workflow, inventory, or seller quote flow | `backend-api-engineer` | `database-engineer`, `security-engineer`, `qa-test-engineer` | `campuscart-order-workflows`, `campuscart-mongodb-modeling` | Validate transitions in `backend/app/services/orders.py` and keep inventory restore idempotent. |
| AI listing draft or transcription work | `ai-llm-engineer` | `backend-api-engineer`, `security-engineer`, `qa-test-engineer` | `campuscart-ai-integration` | Never auto-publish listings and never fabricate price or stock absent from source text. |
| UNO Q tool or seller assistant change | `edge-iot-engineer` | `backend-api-engineer`, `security-engineer`, `devops-release-engineer` | `campuscart-mcp-tool-development`, `campuscart-uno-q-deployment` | Keep edge tools read-only, token-scoped, and free of shell or direct DB access. |
| Authentication, RBAC, token, or audit work | `security-engineer` | `backend-api-engineer`, `database-engineer`, `qa-test-engineer` | `campuscart-auth-and-rbac`, `campuscart-security-review` | Review `security.py`, `deps.py`, ticket issuance, admin routes, and audit coverage together. |
| Security review or pre-merge hardening | `security-engineer` | `code-reviewer`, `qa-test-engineer` | `campuscart-security-review`, `campuscart-code-review` | Focus on exploitable issues, broken invariants, missing authorization, and unsafe edge exposure. |
| Debugging regressions | `qa-test-engineer` | area owner agent for the affected surface | `campuscart-debugging`, optionally `campuscart-test-driven-development` | Reproduce first, narrow scope, then hand off to the owning implementation agent if a fix is needed. |
| Release, CI, or deployment change | `devops-release-engineer` | `backend-api-engineer`, `frontend-engineer`, `security-engineer` | `campuscart-deployment-release`, `campuscart-uno-q-deployment` when edge is involved | Check `render.yaml`, `.github/workflows/ci.yml`, required secrets, and rollback notes. |
| Documentation refresh | `product-architect` | area owner agent as needed | `campuscart-documentation` | Update task-specific docs whenever APIs, architecture, security assumptions, or workflows change. |

## Suggested sequences

### New feature
1. `product-architect` + `campuscart-feature-planning`
2. `product-architect` + `campuscart-architecture`
3. Implementation agents by surface (`frontend-engineer`, `backend-api-engineer`, `database-engineer`)
4. `qa-test-engineer` + `campuscart-test-driven-development`
5. `security-engineer` and `code-reviewer` before merge

### Backend/API work
1. `backend-api-engineer` + `campuscart-api-development`
2. Add `database-engineer` or `security-engineer` if storage or auth changes
3. Finish with `qa-test-engineer`

### Edge / UNO Q work
1. `edge-iot-engineer` + `campuscart-mcp-tool-development`
2. Add `backend-api-engineer` for `/api/edge/*` contract changes
3. Add `devops-release-engineer` for deployment, secrets, or Telegram / MCP rollout changes

## Maintenance rule

When the architecture, repo layout, validation commands, deployment flow, or security model changes, update `.github/copilot-instructions.md`, the affected `.github/agents/*`, the affected `.github/skills/*`, and this workflow map in the same pull request.
