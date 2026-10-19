---
name: campuscart-documentation
description: Guides UniCart documentation updates. Use when architecture, APIs, workflows, commands, or security assumptions have changed.
---
# campuscart-documentation

Purpose
- Keep UniCart documentation aligned with the live architecture, workflows, and constraints.
- Favor concise, repo-specific guidance over generic prose.

When to use
- Use when APIs, architecture, deployment, security assumptions, commands, or agent workflows change.
- Trigger on doc refresh requests or when code changes invalidate existing guidance.

Procedure
1. Update the nearest relevant file in `docs/`, `.github/copilot-instructions.md`, `.github/agents/`, `.github/skills/`, or `AGENTS.md`.
2. Reference real paths, commands, statuses, tokens, and flows from the repo instead of abstract descriptions.
3. Preserve important truth statements: money in minor units, manual payment confirmation, draft-only AI listing assistance, ticket-based chat auth, read-only seller-scoped edge tools.
4. Cross-check docs against the owning code paths such as `backend/app/services/orders.py`, `backend/app/services/llm.py`, `backend/app/routers/chat.py`, and `edge/uno_q/`.
5. Add follow-up notes when another doc should be updated by the same change.

Expected outputs
- Accurate markdown updates with concrete commands, paths, and caveats.
- Clear note of what changed and why.

Completion checks
- All referenced paths and commands exist or are already established in the repo plan.
- Instruction files and workflow docs are updated together when architecture or process changes.
