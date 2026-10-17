from typing import Any

from .client import CampusCartClient
from .summarize import summarize_low_stock, summarize_pending, summarize_sales
from .tools import Tool, ToolError, call_tool

HELP = "Ask: 'orders' (what to prepare first), 'low stock', 'sales today', 'stock <product>'."


async def answer(client: CampusCartClient, tools: dict[str, Tool], text: str) -> str:
    """Keyword router. Unrecognised text never reaches any tool."""
    t = text.strip().lower()
    try:
        if t.startswith("stock "):
            rows: list[dict[str, Any]] = await call_tool(
                client, tools, "get_product_availability", {"query": t[6:].strip()[:80]}
            )
            if not rows:
                return "No matching product."
            return "\n".join(f"- {r['title']}: {'in stock' if r['in_stock'] else 'out of stock'}" for r in rows)
        if "order" in t or "prepare" in t:
            return summarize_pending(await call_tool(client, tools, "get_pending_orders", {}))
        if "low" in t or "inventory" in t:
            return summarize_low_stock(await call_tool(client, tools, "get_low_stock_products", {}))
        if "sale" in t or "revenue" in t:
            return summarize_sales(await call_tool(client, tools, "get_today_sales", {}))
    except ToolError as e:
        return f"Sorry: {e}"
    except Exception:  # noqa: BLE001 - network/API failure must not crash the bot
        return "CampusCart is unreachable right now. Try again shortly."
    return HELP


