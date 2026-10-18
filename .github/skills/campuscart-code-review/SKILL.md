---
name: campuscart-code-review
description: Guides high-signal UniCart diff review. Use when checking a change for bugs, regressions, and repo-specific invariant violations.
---
# campuscart-code-review

Purpose
- Review UniCart diffs for correctness, regression risk, and architecture fit.
- Focus on real defects, not style churn.

When to use
- Use before merge, after a refactor, or when a change touches sensitive domain logic.
- Trigger on requests for review, audit, sanity check, or pre-merge validation.

Procedure
1. Read the diff and identify touched surfaces: backend, frontend, edge, CI, deployment, or docs.
2. Check UniCart-specific invariants: minor-unit money, server-computed totals, order state transitions, single-use 60s chat tickets, persisted-before-ack messages, grounded AI drafts, and seller-scoped edge access.
3. Verify tests and docs were updated when behavior changed.
4. Separate confirmed bugs from softer suggestions.
5. Point the author to the right owning agent or skill if follow-up work is needed.

Expected outputs
- Ranked findings with file references and concise explanations.
- Explicit statement when no high-confidence defects were found.

Completion checks
- Required validation commands are identified for all touched surfaces.
- No reported issue is purely stylistic without a correctness, security, or maintainability consequence.
