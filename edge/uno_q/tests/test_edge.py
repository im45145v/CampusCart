import httpx
import pytest

from campuscart_edge.assistant import HELP, answer
from campuscart_edge.client import CampusCartClient
from campuscart_edge.telegram_bot import handle_update
from campuscart_edge.tools import ToolError, build_tools, call_tool

ORDER = {"id": "a" * 32, "status": "accepted", "buyer_name": "Bob", "total_minor": 3000,
         "payment_status": "unpaid", "items": [{"title": "Samosa", "variant": None, "quantity": 2}]}
seen: list[httpx.Request] = []


def handler(request: httpx.Request) -> httpx.Response:
    seen.append(request)
    assert request.headers["authorization"] == "Bearer" + " cc_test"
    p = request.url.path
    if p == "/api/edge/pending-orders":
        return httpx.Response(200, json=[ORDER])
    if p == "/api/edge/low-stock":
        return httpx.Response(200, json=[{"title": "Chai", "variant": None, "stock": 2}])
    if p == "/api/edge/today-sales":
        return httpx.Response(200, json={"orders_completed": 2, "revenue_minor": 5000})
    return httpx.Response(404)


@pytest.fixture
def client() -> CampusCartClient:
    seen.clear()
    return CampusCartClient("http://api", "cc_test", transport=httpx.MockTransport(handler))


async def test_answers_use_only_allowlisted_endpoints(client: CampusCartClient) -> None:
    tools = build_tools()
    assert "Samosa" in await answer(client, tools, "What orders should I prepare first?")
    assert "Chai" in await answer(client, tools, "low stock?")
    assert "₹50.00" in await answer(client, tools, "sales today")
    assert await answer(client, tools, "drop database; rm -rf /") == HELP
    assert all(r.url.path.startswith("/api/edge/") for r in seen)


async def test_argument_validation(client: CampusCartClient) -> None:
    tools = build_tools()
    with pytest.raises(ToolError):
        await call_tool(client, tools, "get_order_summary", {"order_id": "../../admin"})
    with pytest.raises(ToolError):
        await call_tool(client, tools, "get_low_stock_products", {"threshold": -1})
    with pytest.raises(ToolError):
        await call_tool(client, tools, "get_pending_orders", {"extra": 1})
    with pytest.raises(ToolError):
        await call_tool(client, tools, "run_shell", {"cmd": "ls"})
    assert seen == []


async def test_telegram_allow_list(client: CampusCartClient) -> None:
    tools = build_tools()
    upd = {"message": {"chat": {"id": 42}, "text": "orders"}}
    assert await handle_update(upd, {7}, client, tools) is None
    assert await handle_update(upd, set(), client, tools) is None
    reply = await handle_update(upd, {42}, client, tools)
    assert reply and "Samosa" in reply[1]


async def test_api_failure_is_reported_politely() -> None:
    c = CampusCartClient("http://api", "cc_test", transport=httpx.MockTransport(lambda r: httpx.Response(500)))
    assert "unreachable" in await answer(c, build_tools(), "orders")
