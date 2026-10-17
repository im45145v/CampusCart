---
name: campuscart-mcp-tool-development
description: Guides CampusCart UNO Q and MCP tool development. Use when adding seller assistant tools or changing edge/backend contracts.
---
# campuscart-mcp-tool-development

Purpose
- Add or refine CampusCart seller assistant tools exposed through `edge/uno_q/` and optional MCP integration.
- Keep tool arguments validated and data access least-privilege.

When to use
- Use for new UNO Q tools, MCP server wiring, seller assistant responses, or read-only analytics helpers.
- Trigger on changes under `edge/uno_q/` or `/api/edge/*` backend contracts.

Procedure
1. Start from existing tool patterns such as `get_pending_orders`, `get_order_summary`, `get_low_stock_products`, `get_today_sales`, and `get_product_availability`.
2. Validate tool arguments with Pydantic and access CampusCart data through the scoped seller API token (`cc_...`) only.
3. Keep tools read-only unless a backend contract explicitly introduces a safe write operation.
4. Avoid shell access, direct database access, and unrestricted Telegram or MCP exposure.
5. Update backend token or route handling when the edge contract changes.

Expected outputs
- Tool definition changes, backend contract notes, and operator caveats.
- Clear statement of permissions, trust boundaries, and unsupported actions.

Completion checks
- Run `python -m compileall edge/uno_q`
- If backend edge routes or token validation changed, also run `cd backend && pip install -r requirements-dev.txt && ruff check . && mypy app && pytest`
