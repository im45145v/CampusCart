---
name: campuscart-mongodb-modeling
description: Guides MongoDB schema and index decisions for CampusCart. Use when changing persistence, queries, money fields, or inventory rules.
---
# campuscart-mongodb-modeling

Purpose
- Design and review MongoDB persistence for CampusCart without breaking inventory, money, or lookup invariants.
- Keep schema and index choices aligned with backend behavior.

When to use
- Use for collection design, field additions, query tuning, index work, and persistence-sensitive bug fixes.
- Trigger when changing `backend/app/db.py`, model-like Pydantic structures, or collection access patterns.

Procedure
1. Work from the known collections: `users`, `stores`, `products`, `orders`, `conversations`, `messages`, `reviews`, `reports`, `audit_logs`, `wallet_ledger`, `plans`, `subscriptions`, `notifications`, `vouchers`, `voucher_redemptions`, `ws_tickets`, `api_tokens`.
2. Preserve string UUID `_id` values and integer minor-unit money fields such as `price_minor` and `total_minor`.
3. Keep totals computed server-side and stock changes atomic with conditional `$gte` updates plus one-time restore on cancel or reject.
4. Add or refine indexes in `backend/app/db.py` where query paths justify them.
5. Cover persistence changes with backend tests.

Expected outputs
- Field/index plan, code updates, and data integrity notes.
- Clear explanation of order, chat, or token lifecycle impacts.

Completion checks
- Run `cd backend && pip install -r requirements-dev.txt && ruff check . && mypy app && pytest`
- Verify money and inventory rules remain unchanged unless the task explicitly redefines them.
