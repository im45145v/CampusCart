import asyncio
from datetime import date, timedelta
from typing import Any

import httpx

from .conftest import Actor, bearer, make_product


async def place(client: httpx.AsyncClient, buyer: Actor, store: dict[str, Any], items: list[dict[str, Any]], **kw: Any) -> httpx.Response:
    return await client.post(
        "/api/orders", headers=buyer.headers, json={"store_id": store["id"], "items": items, **kw}
    )


async def stock_of(client: httpx.AsyncClient, pid: str) -> int:
    return int((await client.get(f"/api/products/{pid}")).json()["stock"])


async def test_server_calculates_total_and_ignores_client_price(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(client, seller, store)
    r = await place(client, buyer, store, [{"product_id": p["id"], "quantity": 2}])
    assert r.status_code == 201
    o = r.json()
    assert o["total_minor"] == 3000 and o["status"] == "placed"
    assert await stock_of(client, p["id"]) == 3
    # extra client-controlled fields are rejected outright
    bad = await place(client, buyer, store, [{"product_id": p["id"], "quantity": 1, "price_minor": 1}])
    assert bad.status_code == 422
    bad = await place(client, buyer, store, [{"product_id": p["id"], "quantity": 1}], status="completed")
    assert bad.status_code == 422


async def test_cannot_oversell_and_failed_order_rolls_back(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    a = await make_product(client, seller, store, title="Apple", stock=5)
    b = await make_product(client, seller, store, title="Banana", stock=1)
    r = await place(client, buyer, store, [{"product_id": a["id"], "quantity": 2}, {"product_id": b["id"], "quantity": 2}])
    assert r.status_code == 409
    assert await stock_of(client, a["id"]) == 5  # first reservation was rolled back
    assert await stock_of(client, b["id"]) == 1


async def test_concurrent_orders_never_oversell(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(client, seller, store, stock=3)
    results = await asyncio.gather(
        *[place(client, buyer, store, [{"product_id": p["id"], "quantity": 1}]) for _ in range(8)]
    )
    assert sorted(r.status_code for r in results).count(201) == 3
    assert await stock_of(client, p["id"]) == 0


async def test_variants_and_cancel_restores_stock_once(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(
        client, seller, store, stock=None,
        variants=[{"name": "Small", "price_minor": 1000, "stock": 4}, {"name": "Large", "price_minor": 2000, "stock": 1}],
    )
    large = next(v for v in p["variants"] if v["name"] == "Large")
    no_variant = await place(client, buyer, store, [{"product_id": p["id"], "quantity": 1}])
    assert no_variant.status_code == 422
    r = await place(client, buyer, store, [{"product_id": p["id"], "variant_id": large["id"], "quantity": 1}])
    o = r.json()
    assert o["total_minor"] == 2000
    again = await place(client, buyer, store, [{"product_id": p["id"], "variant_id": large["id"], "quantity": 1}])
    assert again.status_code == 409
    c = await client.post(f"/api/orders/{o['id']}/status", headers=buyer.headers, json={"status": "cancelled"})
    assert c.status_code == 200
    again = await client.post(f"/api/orders/{o['id']}/status", headers=buyer.headers, json={"status": "cancelled"})
    assert again.status_code == 409
    prod = (await client.get(f"/api/products/{p['id']}")).json()
    assert next(v for v in prod["variants"] if v["name"] == "Large")["stock"] == 1


async def test_status_transitions_and_permissions(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, other: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(client, seller, store)
    o = (await place(client, buyer, store, [{"product_id": p["id"], "quantity": 1}])).json()
    url = f"/api/orders/{o['id']}/status"

    async def go(actor: Actor, status: str) -> int:
        return (await client.post(url, headers=actor.headers, json={"status": status})).status_code

    assert await go(buyer, "accepted") == 409  # buyers cannot accept their own order
    assert await go(buyer, "completed") == 409
    assert await go(other, "accepted") == 404  # outsiders cannot even see it
    assert await go(seller, "preparing") == 409  # no skipping steps
    assert await go(seller, "accepted") == 200
    assert await go(seller, "preparing") == 200
    assert await go(buyer, "cancelled") == 409  # too late for buyer
    assert await go(seller, "ready") == 200
    assert await go(seller, "completed") == 200
    assert await go(seller, "cancelled") == 409  # terminal
    assert (await client.get(f"/api/orders/{o['id']}", headers=other.headers)).status_code == 404
    assert [x["id"] for x in (await client.get("/api/orders", headers=buyer.headers)).json()] == [o["id"]]
    assert (await client.get("/api/seller/orders", headers=buyer.headers)).status_code == 403
    prod = (await client.get(f"/api/products/{p['id']}")).json()
    assert prod["sold_count"] == 1


async def test_reject_restores_stock(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(client, seller, store, stock=2)
    o = (await place(client, buyer, store, [{"product_id": p["id"], "quantity": 2}])).json()
    assert await stock_of(client, p["id"]) == 0
    r = await client.post(f"/api/orders/{o['id']}/status", headers=seller.headers, json={"status": "rejected"})
    assert r.status_code == 200
    assert await stock_of(client, p["id"]) == 2


async def test_unpublished_closed_and_own_store_rules(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    draft = await make_product(client, seller, store, publish=False)
    assert (await place(client, buyer, store, [{"product_id": draft["id"], "quantity": 1}])).status_code == 409
    p = await make_product(client, seller, store)
    assert (await place(client, seller, store, [{"product_id": p["id"], "quantity": 1}])).status_code == 400
    await client.patch(f"/api/stores/{store['id']}", headers=seller.headers, json={"is_open": False})
    assert (await place(client, buyer, store, [{"product_id": p["id"], "quantity": 1}])).status_code == 409


async def test_printing_quote_flow(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(client, seller, store, title="Poster print", kind="printing", stock=9)
    assert p["stock"] is None
    o = (await place(client, buyer, store, [{"product_id": p["id"], "quantity": 1}],
                     request_details="A2 colour, 3 copies", file_urls=["/uploads/x.png"])).json()
    assert o["status"] == "quote_requested" and o["total_minor"] == 0
    q = await client.post(f"/api/orders/{o['id']}/quote", headers=buyer.headers, json={"total_minor": 1})
    assert q.status_code == 403
    q = await client.post(f"/api/orders/{o['id']}/quote", headers=seller.headers, json={"total_minor": 45000})
    assert q.json()["status"] == "quoted" and q.json()["total_minor"] == 45000
    a = await client.post(f"/api/orders/{o['id']}/status", headers=buyer.headers, json={"status": "accepted"})
    assert a.status_code == 200
    pay = await client.post(f"/api/orders/{o['id']}/confirm-payment", headers=seller.headers)
    assert pay.json()["payment_status"] == "confirmed_by_seller"


async def test_seller_summary_and_edge_tools(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, other: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(client, seller, store, title="Brownie", stock=3)
    o = (await place(client, buyer, store, [{"product_id": p["id"], "quantity": 1}])).json()
    tok = (await client.post("/api/seller/api-tokens", headers=seller.headers)).json()
    assert (await client.post("/api/seller/api-tokens", headers=buyer.headers)).status_code == 403
    h = bearer(tok["token"])
    pend = (await client.get("/api/edge/pending-orders", headers=h)).json()
    assert [x["id"] for x in pend] == [o["id"]]
    assert (await client.get(f"/api/edge/orders/{o['id']}/summary", headers=h)).status_code == 200
    low = (await client.get("/api/edge/low-stock", headers=h)).json()
    assert low[0]["title"] == "Brownie"
    av = (await client.get("/api/edge/products/availability", headers=h, params={"q": "brown"})).json()
    assert av[0]["in_stock"] is True
    assert "revenue_minor" in (await client.get("/api/edge/today-sales", headers=h)).json()
    # a JWT, garbage, or another seller's data must not work
    assert (await client.get("/api/edge/pending-orders", headers=seller.headers)).status_code == 401
    assert (await client.get("/api/edge/pending-orders", headers=bearer("garbage"))).status_code == 401
    # edge tokens cannot call write endpoints
    assert (await client.post(f"/api/orders/{o['id']}/status", headers=h, json={"status": "accepted"})).status_code == 401
    summary = (await client.get("/api/seller/summary", headers=seller.headers)).json()
    assert summary["orders_by_status"] == {"placed": 1}
    await client.delete(f"/api/seller/api-tokens/{tok['id']}", headers=seller.headers)
    assert (await client.get("/api/edge/pending-orders", headers=h)).status_code == 401


async def test_returned_borrow_goes_back_on_the_shelf(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    lent = await make_product(
        client, seller, store, title="Projector", listing_type="lend", stock=1, price_minor=8000,
    )
    sold = await make_product(client, seller, store, title="Plate", stock=1, price_minor=1500)
    borrow = await place(client, buyer, store, [{"product_id": lent["id"], "quantity": 1}])
    assert borrow.status_code == 201, borrow.text
    assert await stock_of(client, lent["id"]) == 0
    sale = await place(client, buyer, store, [{"product_id": sold["id"], "quantity": 1}])
    assert sale.status_code == 201
    for status in ("accepted", "preparing", "ready", "completed"):
        done = await client.post(
            f"/api/orders/{borrow.json()['id']}/status", headers=seller.headers, json={"status": status},
        )
        assert done.status_code == 200, done.text
    assert await stock_of(client, lent["id"]) == 1
    for status in ("accepted", "preparing", "ready", "completed"):
        done = await client.post(
            f"/api/orders/{sale.json()['id']}/status", headers=seller.headers, json={"status": status},
        )
        assert done.status_code == 200, done.text
    assert await stock_of(client, sold["id"]) == 0


async def test_daily_rate_uses_the_dates_and_stops_at_the_listing_cap(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(
        client, seller, store, title="Drill", listing_type="lend", stock=2,
        price_minor=1000, rate_unit="day", max_units=2,
    )
    today = date.today()
    ok = await place(
        client, buyer, store, [{"product_id": p["id"], "quantity": 1}],
        collect_on=today.isoformat(), return_on=(today + timedelta(days=2)).isoformat(),
    )
    assert ok.status_code == 201, ok.text
    body = ok.json()
    assert body["items"][0]["billed_units"] == 2
    assert body["total_minor"] == 2000
    over = await place(
        client, buyer, store, [{"product_id": p["id"], "quantity": 1}],
        collect_on=today.isoformat(), return_on=(today + timedelta(days=3)).isoformat(),
    )
    assert over.status_code == 422


async def test_hourly_rate_counts_from_the_handover(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    settings = await client.patch(
        f"/api/stores/{store['id']}", headers=seller.headers,
        json={"order_settings": {
            "fulfillment_options": ["pickup"], "payment_options": ["pay_on_pickup"],
            "slots_enabled": True, "slots": ["12:00-14:00"], "slot_required": True, "slot_days_ahead": 2,
        }},
    )
    assert settings.status_code == 200, settings.text
    p = await make_product(
        client, seller, store, title="Speaker", listing_type="lend", stock=1,
        price_minor=500, rate_unit="hour", max_units=6,
    )
    day = (date.today() + timedelta(days=1)).isoformat()
    ok = await place(
        client, buyer, store, [{"product_id": p["id"], "quantity": 1}],
        pickup_slot={"date": day, "label": "12:00-14:00"}, return_on=day, return_time="18:00",
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["items"][0]["billed_units"] == 6
    assert ok.json()["total_minor"] == 3000
    over = await place(
        client, buyer, store, [{"product_id": p["id"], "quantity": 1}],
        pickup_slot={"date": day, "label": "12:00-14:00"}, return_on=day, return_time="20:00",
    )
    assert over.status_code == 422
