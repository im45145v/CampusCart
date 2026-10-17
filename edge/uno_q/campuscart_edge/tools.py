"""Allow-listed tools. Arguments are validated; there is no shell, DB or arbitrary-URL access."""
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from .client import CampusCartClient


class NoArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")


class OrderIdArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    order_id: str = Field(pattern=r"^[0-9a-f]{32}$")


class LowStockArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    threshold: int = Field(default=5, ge=0, le=1000)


class ProductQueryArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(min_length=1, max_length=80)


@dataclass
class Tool:
    name: str
    description: str
    args: type[BaseModel]
    run: Callable[[CampusCartClient, Any], Awaitable[Any]]


def build_tools() -> dict[str, Tool]:
    tools = [
        Tool("get_pending_orders", "Open orders for the seller, most urgent first.", NoArgs,
             lambda c, a: c.get("/pending-orders")),
        Tool("get_order_summary", "Summary of one order by id.", OrderIdArgs,
             lambda c, a: c.get(f"/orders/{a.order_id}/summary")),
        Tool("get_low_stock_products", "Products or variants at or below a stock threshold.",
             LowStockArgs, lambda c, a: c.get("/low-stock", threshold=a.threshold)),
        Tool("get_today_sales", "Completed-order revenue for today (UTC).", NoArgs,
             lambda c, a: c.get("/today-sales")),
        Tool("get_product_availability", "Stock/availability of products matching a name.",
             ProductQueryArgs, lambda c, a: c.get("/products/availability", q=a.query)),
    ]
    return {t.name: t for t in tools}


class ToolError(Exception):
    pass


async def call_tool(
    client: CampusCartClient, tools: dict[str, Tool], name: str, arguments: dict[str, Any] | None
) -> Any:
    tool = tools.get(name)
    if not tool:
        raise ToolError(f"unknown tool: {name}")
    try:
        args = tool.args.model_validate(arguments or {})
    except ValidationError as e:
        raise ToolError(f"invalid arguments: {e.errors()[0]['msg']}") from e
    return await tool.run(client, args)
