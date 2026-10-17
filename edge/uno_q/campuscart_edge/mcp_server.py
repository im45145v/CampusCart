"""Optional MCP server exposing ONLY the allow-listed tools (needs `pip install mcp`)."""
from typing import Any

from .client import CampusCartClient
from .config import EdgeSettings
from .tools import build_tools, call_tool


def main() -> None:
    from mcp.server.fastmcp import FastMCP  # optional dependency

    s = EdgeSettings()
    client = CampusCartClient(s.campuscart_api_url, s.campuscart_api_token)
    tools = build_tools()
    mcp = FastMCP("campuscart-seller")

    @mcp.tool()
    async def get_pending_orders() -> Any:
        """Open orders, most urgent first."""
        return await call_tool(client, tools, "get_pending_orders", {})

    @mcp.tool()
    async def get_order_summary(order_id: str) -> Any:
        """Summary of one order."""
        return await call_tool(client, tools, "get_order_summary", {"order_id": order_id})

    @mcp.tool()
    async def get_low_stock_products(threshold: int = 5) -> Any:
        """Products at or below the stock threshold."""
        return await call_tool(client, tools, "get_low_stock_products", {"threshold": threshold})

    @mcp.tool()
    async def get_today_sales() -> Any:
        """Revenue from orders completed today."""
        return await call_tool(client, tools, "get_today_sales", {})

    @mcp.tool()
    async def get_product_availability(query: str) -> Any:
        """Availability of products matching a name."""
        return await call_tool(client, tools, "get_product_availability", {"query": query})

    mcp.run()


if __name__ == "__main__":
    main()
