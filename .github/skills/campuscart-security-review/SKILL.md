---
name: campuscart-security-review
description: Guides CampusCart security analysis. Use when reviewing auth, tokens, chat, AI, edge exposure, or deployment-sensitive changes.
---
# campuscart-security-review

Purpose
- Perform focused CampusCart security review on changed code, configs, or workflows.
- Catch exploitable issues and broken trust assumptions before merge or release.

When to use
- Use for auth changes, sensitive data handling, chat transport, AI input handling, edge tokens, admin paths, or deployment/security reviews.
- Trigger when a task explicitly asks for security review or touches a high-risk boundary.

Procedure
1. Trace authentication, authorization, secret handling, and user-controlled inputs in the touched files.
2. Check for missing role enforcement, unsafe token scope, injection paths, client-trusted totals or sender IDs, weak ticket handling, and misleading payment claims.
3. Review logs, audit behavior, and rate limiting where abuse could matter.
4. Confirm frontend and edge messages do not overstate actual guarantees.
5. Recommend concrete fixes and tests for every confirmed issue.

Expected outputs
- High-confidence findings with severity, exploit path, and remediation steps.
- Confirmation when no material issues were found.

Completion checks
- Run `cd backend && pip install -r requirements-dev.txt && ruff check . && mypy app && pytest` for backend-sensitive changes.
- Run `cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build` when auth or trust messaging changed in the UI.
- Run `python -m compileall edge/uno_q` when edge code changed.
