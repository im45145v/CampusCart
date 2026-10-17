---
name: campuscart-debugging
description: Guides CampusCart debugging and root-cause isolation. Use when a regression or failing flow must be reproduced and narrowed down.
---
# campuscart-debugging

Purpose
- Diagnose CampusCart regressions quickly and hand off a precise fix path.
- Separate symptom, reproduction, root cause, and verification clearly.

When to use
- Use for failing tests, broken flows, inconsistent data, chat issues, order bugs, auth problems, or deployment regressions.
- Trigger when the main task is to explain or isolate a defect before or during a fix.

Procedure
1. Reproduce the issue with the smallest reliable command, test, or request path.
2. Narrow the fault to the owning area: `backend/app/routers/`, `backend/app/services/`, `frontend/src/`, `edge/uno_q/`, deployment files, or docs.
3. Check repository-specific invariants such as order transitions, inventory restore rules, WebSocket ticket rules, and AI grounding limits.
4. Capture the root cause in file-level terms and identify the best implementation agent or skill to fix it.
5. Re-run the relevant validation command after the fix.

Expected outputs
- Reproduction steps, impacted files, suspected or confirmed root cause, and fix recommendation.
- Minimal follow-up validation plan.

Completion checks
- The issue is reproducible before the fix and no longer reproducible after the fix.
- Relevant backend, frontend, or edge verification commands are listed or run.
