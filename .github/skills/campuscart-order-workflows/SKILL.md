---
name: campuscart-order-workflows
description: Guides CampusCart order state-machine changes. Use when editing quotes, acceptance, fulfilment, cancellation, or inventory behavior.
---
# campuscart-order-workflows

Purpose
- Implement or review CampusCart order lifecycle behavior with strict state-machine and inventory guarantees.
- Keep seller quote and fulfillment flows consistent from API to UI.

When to use
- Use for any change to quoting, acceptance, preparation, readiness, completion, rejection, cancellation, or inventory updates.
- Trigger on modifications around `backend/app/routers/orders.py` and `backend/app/services/orders.py`.

Procedure
1. Confirm the affected order statuses among `placed`, `quote_requested`, `quoted`, `accepted`, `preparing`, `ready`, `completed`, `rejected`, and `cancelled`.
2. Make transition logic changes in `backend/app/services/orders.py`, not ad hoc in controllers or clients.
3. Preserve atomic stock decrement with conditional `$gte` updates and one-time restoration on cancel or reject.
4. Verify seller and buyer permissions for each action and any notification or chat side effects.
5. Add backend tests for valid, invalid, and repeated transition attempts.

Expected outputs
- Updated state-machine logic, endpoint adjustments, tests, and any required UI/API notes.
- Explicit inventory and payment-behavior rationale.

Completion checks
- Run `cd backend && pip install -r requirements-dev.txt && ruff check . && mypy app && pytest`
- If order UI changed, also run `cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build`
