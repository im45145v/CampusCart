from typing import Any

import httpx

from .conftest import Actor, make_product, make_user


async def configure(client: httpx.AsyncClient, seller: Actor, store: dict[str, Any], **settings: Any) -> httpx.Response:
    return await client.patch(
        f"/api/stores/{store['id']}", headers=seller.headers, json={"order_settings": settings}
    )


async def order(
    client: httpx.AsyncClient, buyer: Actor, store: dict[str, Any], product: dict[str, Any], qty: int = 1, **kw: Any
) -> httpx.Response:
    return await client.post(
        "/api/orders", headers=buyer.headers,
        json={"store_id": store["id"], "items": [{"product_id": product["id"], "quantity": qty}], **kw},
    )


async def test_theme_banner_and_defaults(client: httpx.AsyncClient, seller: Actor, store: dict[str, Any]) -> None:
    assert store["theme"]["primary"] == "#C65D3A" and store["banner_url"] is None
    r = await client.patch(
        f"/api/stores/{store['id']}", headers=seller.headers,
        json={"banner_url": "/uploads/abc.png", "tagline": "Hot and fast",
              "theme": {"primary": "#112233", "font": "serif", "radius": "pill"}},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["theme"]["primary"] == "#112233" and body["theme"]["accent"] == "#263D32"
    assert body["banner_url"] == "/uploads/abc.png" and body["tagline"] == "Hot and fast"
    cleared = await client.patch(f"/api/stores/{store['id']}", headers=seller.headers, json={"banner_url": None})
    assert cleared.json()["banner_url"] is None


async def test_rejects_unsafe_theme_and_banner(client: httpx.AsyncClient, seller: Actor, store: dict[str, Any]) -> None:
    for bad in (
        {"theme": {"primary": "red; background:url(x)"}},
        {"theme": {"font": "comic"}},
        {"banner_url": "javascript:alert(1)"},
        {"banner_url": "http://insecure.example/x.png"},
    ):
        r = await client.patch(f"/api/stores/{store['id']}", headers=seller.headers, json=bad)
        assert r.status_code == 422, bad


async def test_only_owner_can_change_branding(client: httpx.AsyncClient, other: Actor, store: dict[str, Any]) -> None:
    r = await client.patch(f"/api/stores/{store['id']}", headers=other.headers, json={"tagline": "mine now"})
    assert r.status_code == 403


async def test_settings_validation(client: httpx.AsyncClient, seller: Actor, store: dict[str, Any]) -> None:
    assert (await configure(client, seller, store, slots_enabled=True, slots=[])).status_code == 422
    assert (await configure(client, seller, store, slots=["13:00-12:00"])).status_code == 422
    assert (await configure(client, seller, store, slots=["12:00-13:00", "12:00-13:00"])).status_code == 422
    assert (await configure(client, seller, store, custom_fields=[{"id": "a", "label": "A", "type": "select"}])).status_code == 422
    assert (await configure(client, seller, store, fulfillment_options=[])).status_code == 422


async def test_time_slots_capacity_and_options(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, other: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(client, seller, store, stock=20)
    r = await configure(client, seller, store, slots_enabled=True, slots=["00:00-23:59"], slot_capacity=1, slot_days_ahead=1)
    assert r.status_code == 200, r.text
    opts = (await client.get(f"/api/stores/{store['id']}/order-options")).json()
    assert len(opts["days"]) == 2 and opts["days"][0]["slots"][0]["remaining"] == 1
    slot = {"date": opts["days"][1]["date"], "label": "00:00-23:59"}

    assert (await order(client, buyer, store, p)).status_code == 422  # slot required
    bad = await order(client, buyer, store, p, pickup_slot={"date": slot["date"], "label": "01:00-02:00"})
    assert bad.status_code == 422
    ok = await order(client, buyer, store, p, pickup_slot=slot)
    assert ok.status_code == 201 and ok.json()["pickup_slot"] == slot
    full = await order(client, other, store, p, pickup_slot=slot)
    assert full.status_code == 409
    opts = (await client.get(f"/api/stores/{store['id']}/order-options")).json()
    assert opts["days"][1]["slots"][0]["remaining"] == 0 and not opts["days"][1]["slots"][0]["available"]
    # a failed slot booking must give its stock back
    assert (await client.get(f"/api/products/{p['id']}")).json()["stock"] == 19
    # cancelling frees the place
    await client.post(f"/api/orders/{ok.json()['id']}/status", headers=buyer.headers, json={"status": "cancelled"})
    assert (await order(client, other, store, p, pickup_slot=slot)).status_code == 201


async def test_slots_rejected_when_disabled_and_far_future(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(client, seller, store)
    r = await order(client, buyer, store, p, pickup_slot={"date": "2030-01-01", "label": "10:00-11:00"})
    assert r.status_code == 422
    await configure(client, seller, store, slots_enabled=True, slots=["00:00-23:59"])
    r = await order(client, buyer, store, p, pickup_slot={"date": "2099-01-01", "label": "00:00-23:59"})
    assert r.status_code == 422


async def test_quantity_min_order_and_options(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(client, seller, store, stock=50)  # 1500 each
    await configure(client, seller, store, max_qty_per_item=3, min_order_minor=3000,
                    fulfillment_options=["pickup"], payment_options=["pay_on_pickup"])
    assert (await order(client, buyer, store, p, qty=4)).status_code == 422
    assert (await order(client, buyer, store, p, qty=1)).status_code == 422
    assert (await order(client, buyer, store, p, qty=2, fulfillment="campus_meetup")).status_code == 422
    assert (await order(client, buyer, store, p, qty=2, payment_method="manual_confirmation")).status_code == 422
    ok = await order(client, buyer, store, p, qty=2)
    assert ok.status_code == 201 and ok.json()["total_minor"] == 3000
    assert (await client.get(f"/api/products/{p['id']}")).json()["stock"] == 48


async def test_custom_questions(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(client, seller, store)
    await configure(client, seller, store, custom_fields=[
        {"id": "spice", "label": "Spice level", "type": "select", "options": ["mild", "hot"], "required": True},
        {"id": "cutlery", "label": "Need cutlery", "type": "checkbox"},
    ])
    assert (await order(client, buyer, store, p)).status_code == 422
    assert (await order(client, buyer, store, p, answers={"spice": "nuclear"})).status_code == 422
    assert (await order(client, buyer, store, p, answers={"spice": "hot", "evil": "x"})).status_code == 422
    ok = await order(client, buyer, store, p, answers={"spice": "hot", "cutlery": "true"})
    assert ok.status_code == 201
    assert ok.json()["answers"] == [
        {"id": "spice", "label": "Spice level", "value": "hot"},
        {"id": "cutlery", "label": "Need cutlery", "value": "yes"},
    ]


async def test_wait_estimate_uses_prep_and_queue(client: httpx.AsyncClient, seller: Actor, store: dict[str, Any]) -> None:
    p = await make_product(client, seller, store, prep_time_min=10, stock=20)
    await configure(client, seller, store, lead_time_min=5, queue_min_per_order=3)
    first = await make_user(client, "Zed")
    second = await make_user(client, "Yan")
    a = await order(client, first, store, p)
    assert a.json()["est_wait_min"] == 15  # 5 lead + 0 queued + 10 prep
    b = await order(client, second, store, p)
    assert b.json()["est_wait_min"] == 18  # one order ahead adds 3
    opts = (await client.get(f"/api/stores/{store['id']}/order-options")).json()
    assert opts["current_wait_min"] == 11
