from typing import Any

import httpx
import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.config import get_settings
from app.main import app

from .conftest import Actor, make_product


async def start(client: httpx.AsyncClient, who: Actor, store: dict[str, Any], **kw: Any) -> dict[str, Any]:
    r = await client.post("/api/chat/conversations", headers=who.headers, json={"store_id": store["id"], **kw})
    assert r.status_code == 201, r.text
    return dict(r.json())


async def ticket(client: httpx.AsyncClient, who: Actor) -> str:
    return str((await client.post("/api/chat/ws-ticket", headers=who.headers)).json()["ticket"])


async def test_start_resume_inbox_and_membership(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, other: Actor, store: dict[str, Any]
) -> None:
    c1 = await start(client, buyer, store)
    c2 = await start(client, buyer, store)
    assert c1["id"] == c2["id"]  # resumed, not duplicated
    assert (await client.post("/api/chat/conversations", headers=seller.headers, json={"store_id": store["id"]})).status_code == 400
    msg = await client.post(f"/api/chat/conversations/{c1['id']}/messages", headers=buyer.headers, json={"text": "hi"})
    assert msg.status_code == 201 and msg.json()["sender_id"] == buyer.id
    # outsiders get 404 on every conversation endpoint
    for method, path in [("GET", "messages"), ("POST", "read")]:
        r = await client.request(method, f"/api/chat/conversations/{c1['id']}/{path}", headers=other.headers)
        assert r.status_code == 404
    r = await client.post(f"/api/chat/conversations/{c1['id']}/messages", headers=other.headers, json={"text": "x"})
    assert r.status_code == 404
    assert (await client.get("/api/chat/conversations", headers=other.headers)).json() == []
    inbox = (await client.get("/api/chat/conversations", headers=seller.headers)).json()
    assert inbox[0]["unread"] == 1 and inbox[0]["last_message"]["text"] == "hi"
    assert (await client.get("/api/chat/unread", headers=seller.headers)).json() == {"unread": 1}
    await client.post(f"/api/chat/conversations/{c1['id']}/read", headers=seller.headers)
    assert (await client.get("/api/chat/unread", headers=seller.headers)).json() == {"unread": 0}
    assert (await client.get("/api/chat/conversations", headers=buyer.headers)).json()[0]["other_read_seq"] == 1


async def test_order_linked_conversation_and_seller_start(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, other: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(client, seller, store)
    o = (await client.post("/api/orders", headers=buyer.headers, json={"store_id": store["id"], "items": [{"product_id": p["id"], "quantity": 1}]})).json()
    c = await start(client, seller, store, order_id=o["id"])
    assert c["other_user"]["id"] == buyer.id and c["order_id"] == o["id"]
    r = await client.post("/api/chat/conversations", headers=other.headers, json={"store_id": store["id"], "order_id": o["id"]})
    assert r.status_code == 404


async def test_pagination_and_missed_message_recovery(
    client: httpx.AsyncClient, buyer: Actor, store: dict[str, Any]
) -> None:
    c = await start(client, buyer, store)
    for i in range(1, 8):
        await client.post(f"/api/chat/conversations/{c['id']}/messages", headers=buyer.headers, json={"text": f"m{i}"})
    base = f"/api/chat/conversations/{c['id']}/messages"
    page1 = (await client.get(base, headers=buyer.headers, params={"limit": 3})).json()
    assert [m["text"] for m in page1["messages"]] == ["m5", "m6", "m7"] and page1["has_more"]
    page2 = (await client.get(base, headers=buyer.headers, params={"limit": 3, "before_seq": 5})).json()
    assert [m["text"] for m in page2["messages"]] == ["m2", "m3", "m4"]
    missed = (await client.get(base, headers=buyer.headers, params={"after_seq": 5})).json()
    assert [m["text"] for m in missed["messages"]] == ["m6", "m7"]


async def test_websocket_flow(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, other: Actor, store: dict[str, Any], database: Any
) -> None:
    c = await start(client, buyer, store)
    tb, ts = await ticket(client, buyer), await ticket(client, seller)
    tc = TestClient(app)
    with tc.websocket_connect(f"/ws/chat?ticket={tb}") as wb, tc.websocket_connect(f"/ws/chat?ticket={ts}") as wsel:
        assert wb.receive_json()["type"] == "ready" and wsel.receive_json()["type"] == "ready"
        # sender identity spoofing is ignored: the connection decides who sent it
        wb.send_json({"type": "send", "conversation_id": c["id"], "text": "  hello  ", "client_id": "c1", "sender_id": seller.id})
        ack = wb.receive_json()
        assert ack["type"] == "ack" and ack["client_id"] == "c1"
        assert ack["message"]["sender_id"] == buyer.id and ack["message"]["text"] == "hello"
        pushed = wsel.receive_json()
        assert pushed["type"] == "message" and pushed["message"]["id"] == ack["message"]["id"]
        # persisted before ack
        assert await database.messages.count_documents({"conversation_id": c["id"]}) == 1
        # retry with the same client_id is idempotent
        wb.send_json({"type": "send", "conversation_id": c["id"], "text": "hello", "client_id": "c1"})
        assert wb.receive_json()["message"]["id"] == ack["message"]["id"]
        assert await database.messages.count_documents({"conversation_id": c["id"]}) == 1
        # validation
        wb.send_json({"type": "send", "conversation_id": c["id"], "text": "   ", "client_id": "c2"})
        assert wb.receive_json()["code"] == "invalid_message"
        wb.send_text("not json")
        assert wb.receive_json()["code"] == "bad_frame"
        # read receipt + typing
        wsel.send_json({"type": "typing", "conversation_id": c["id"]})
        assert wb.receive_json()["type"] == "typing"
        wsel.send_json({"type": "read", "conversation_id": c["id"], "up_to_seq": 1})
        assert wb.receive_json()["type"] == "read"
    # an outsider cannot send into the conversation
    to = await ticket(client, other)
    with tc.websocket_connect(f"/ws/chat?ticket={to}") as wo:
        wo.receive_json()
        wo.send_json({"type": "send", "conversation_id": c["id"], "text": "intrude", "client_id": "z"})
        assert wo.receive_json()["code"] == "not_found"
    assert await database.messages.count_documents({"conversation_id": c["id"]}) == 1


async def test_websocket_auth_required_and_ticket_single_use(
    client: httpx.AsyncClient, buyer: Actor
) -> None:
    tc = TestClient(app)
    with pytest.raises(WebSocketDisconnect), tc.websocket_connect("/ws/chat") as w:
        w.receive_json()
    with pytest.raises(WebSocketDisconnect), tc.websocket_connect("/ws/chat?ticket=" + buyer.token) as w:
        w.receive_json()  # a JWT is not a ticket
    t = await ticket(client, buyer)
    with tc.websocket_connect(f"/ws/chat?ticket={t}") as w:
        assert w.receive_json()["type"] == "ready"
    with pytest.raises(WebSocketDisconnect), tc.websocket_connect(f"/ws/chat?ticket={t}") as w:
        w.receive_json()  # already consumed
    with pytest.raises(WebSocketDisconnect), tc.websocket_connect(f"/ws/chat?ticket={await ticket(client, buyer)}", headers={"origin": "https://evil.example"}) as w:
        w.receive_json()


async def test_websocket_rate_limit(
    client: httpx.AsyncClient, buyer: Actor, store: dict[str, Any]
) -> None:
    c = await start(client, buyer, store)
    limit = get_settings().chat_rate_limit_messages
    tc = TestClient(app)
    with tc.websocket_connect(f"/ws/chat?ticket={await ticket(client, buyer)}") as w:
        w.receive_json()
        codes = []
        for i in range(limit + 2):
            w.send_json({"type": "send", "conversation_id": c["id"], "text": "x", "client_id": f"k{i}"})
            codes.append(w.receive_json())
        assert [x["type"] for x in codes[:limit]] == ["ack"] * limit
        assert codes[-1]["code"] == "rate_limited"
