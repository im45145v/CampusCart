from datetime import UTC, datetime, timedelta
from typing import Any

import httpx

from .conftest import Actor, make_product
from .test_reviews_reports_admin import make_admin
from .test_wallet_plans_reviews import _wallet


def _code(code: str, **extra: Any) -> dict[str, Any]:
    body: dict[str, Any] = {
        "code": code, "title": extra.pop("title", code), "kind": "amount", "amount_minor": 500,
        "audience": "anyone",
    }
    body.update(extra)
    return body


async def test_amount_code_min_and_wallet_charge(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    created = await client.post(
        f"/api/stores/{store['id']}/vouchers", headers=seller.headers,
        json=_code("save5", min_subtotal_minor=3000),
    )
    assert created.status_code == 201, created.text
    assert (await client.post(
        f"/api/stores/{store['id']}/vouchers", headers=buyer.headers, json=_code("nope1")
    )).status_code == 403
    product = await make_product(client, seller, store, price_minor=2000, stock=5)
    items = [{"product_id": product["id"], "quantity": 1}]
    low = await client.post(
        "/api/vouchers/preview", headers=buyer.headers,
        json={"store_id": store["id"], "code": "save5", "items": items},
    )
    assert low.status_code == 422
    await client.patch(
        f"/api/stores/{store['id']}", headers=seller.headers,
        json={"order_settings": {"payment_options": ["pay_on_pickup", "campus_wallet"]}},
    )
    bigger = await make_product(client, seller, store, title="Combo", price_minor=4000, stock=5)
    items = [{"product_id": bigger["id"], "quantity": 1}]
    preview = await client.post(
        "/api/vouchers/preview", headers=buyer.headers,
        json={"store_id": store["id"], "code": "save5", "items": items, "payment_method": "campus_wallet"},
    )
    assert preview.status_code == 200, preview.text
    assert preview.json()["discount_minor"] == 500
    assert preview.json()["payable_minor"] == 3500
    await _wallet(client, buyer, 40_00)
    placed = await client.post(
        "/api/orders", headers=buyer.headers,
        json={"store_id": store["id"], "payment_method": "campus_wallet", "voucher_code": "save5", "items": items},
    )
    assert placed.status_code == 201, placed.text
    order = placed.json()
    assert order["total_minor"] == 3500
    assert order["voucher_discount_minor"] == 500
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 500
    again = await client.post(
        "/api/orders", headers=buyer.headers,
        json={"store_id": store["id"], "payment_method": "campus_wallet", "voucher_code": "SAVE5", "items": items},
    )
    assert again.status_code == 422


async def test_first_order_releases_on_cancel(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    assert (await client.post(
        f"/api/stores/{store['id']}/vouchers", headers=seller.headers,
        json=_code("FIRST1", kind="percent", percent=20, amount_minor=None, audience="first_order"),
    )).status_code == 201
    product = await make_product(client, seller, store, price_minor=1000, stock=5)
    payload = {
        "store_id": store["id"], "voucher_code": "first1",
        "items": [{"product_id": product["id"], "quantity": 1}],
    }
    first = await client.post("/api/orders", headers=buyer.headers, json=payload)
    assert first.status_code == 201, first.text
    assert first.json()["total_minor"] == 800
    blocked = await client.post("/api/orders", headers=buyer.headers, json=payload)
    assert blocked.status_code == 422
    cancelled = await client.post(
        f"/api/orders/{first.json()['id']}/status", headers=buyer.headers, json={"status": "cancelled"}
    )
    assert cancelled.status_code == 200
    retry = await client.post("/api/orders", headers=buyer.headers, json=payload)
    assert retry.status_code == 201, retry.text
    assert retry.json()["voucher_discount_minor"] == 200


async def test_conditions_campus_code_and_membership(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, other: Actor, store: dict[str, Any], database: Any
) -> None:
    product = await make_product(client, seller, store, price_minor=10_000, stock=5, category="snacks")
    coffee = await make_product(client, seller, store, title="Coffee", price_minor=3000, stock=5, category="coffee")
    assert (await client.post(
        f"/api/stores/{store['id']}/vouchers", headers=seller.headers,
        json=_code("SNACK", amount_minor=1000, categories=["snacks"], min_items=1),
    )).status_code == 201
    wrong = await client.post(
        "/api/orders", headers=buyer.headers,
        json={"store_id": store["id"], "voucher_code": "snack", "items": [{"product_id": coffee["id"], "quantity": 1}]},
    )
    assert wrong.status_code == 422
    right = await client.post(
        "/api/orders", headers=other.headers,
        json={"store_id": store["id"], "voucher_code": "snack", "items": [{"product_id": product["id"], "quantity": 1}]},
    )
    assert right.status_code == 201, right.text
    assert right.json()["total_minor"] == 9000

    admin = await make_admin(client, database)
    campus = await client.post(
        "/api/admin/vouchers", headers=admin.headers,
        json=_code("DESK5", title="Desk welcome", amount_minor=500, audience="anyone"),
    )
    assert campus.status_code == 201, campus.text
    listed = (await client.get(f"/api/stores/{store['id']}/vouchers")).json()
    assert {row["code"] for row in listed} >= {"SNACK", "DESK5"}
    fresh = await client.post(
        "/api/orders", headers=buyer.headers,
        json={"store_id": store["id"], "voucher_code": "desk5", "items": [{"product_id": coffee["id"], "quantity": 1}]},
    )
    assert fresh.status_code == 201, fresh.text
    assert fresh.json()["total_minor"] == 2500

    plan = await client.post(
        f"/api/stores/{store['id']}/plans", headers=seller.headers,
        json={"title": "Regulars", "price_minor": 1000, "discount_percent": 10},
    )
    assert plan.status_code == 201, plan.text
    await _wallet(client, buyer, 20_00)
    assert (await client.post(f"/api/plans/{plan.json()['id']}/subscribe", headers=buyer.headers)).status_code == 201
    member = await client.post(
        "/api/vouchers/preview", headers=buyer.headers,
        json={"store_id": store["id"], "code": "desk5", "items": [{"product_id": product["id"], "quantity": 1}]},
    )
    assert member.status_code == 422  # already used DESK5
    assert (await client.post(
        f"/api/stores/{store['id']}/vouchers", headers=seller.headers,
        json=_code("MORE5", amount_minor=500),
    )).status_code == 201
    stacked = await client.post(
        "/api/vouchers/preview", headers=buyer.headers,
        json={"store_id": store["id"], "code": "more5", "items": [{"product_id": product["id"], "quantity": 1}]},
    )
    assert stacked.status_code == 200, stacked.text
    assert stacked.json()["membership_discount_minor"] == 1000
    assert stacked.json()["discount_minor"] == 500
    assert stacked.json()["payable_minor"] == 8500

    buyer_row = await database.users.find_one({"_id": buyer.id})
    await database.users.update_one(
        {"_id": buyer.id}, {"$set": {"created_at": datetime.now(UTC) - timedelta(days=40)}}
    )
    assert (await client.post(
        f"/api/stores/{store['id']}/vouchers", headers=seller.headers,
        json=_code("NEW10", kind="percent", percent=10, amount_minor=None, audience="new_account", new_account_days=14),
    )).status_code == 201
    aged = await client.post(
        "/api/vouchers/preview", headers=buyer.headers,
        json={"store_id": store["id"], "code": "new10", "items": [{"product_id": coffee["id"], "quantity": 1}]},
    )
    assert aged.status_code == 422
    assert buyer_row is not None


async def test_used_up_quote_and_pause(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, other: Actor, store: dict[str, Any]
) -> None:
    assert (await client.post(
        f"/api/stores/{store['id']}/vouchers", headers=seller.headers,
        json=_code("ONCE", max_redemptions=1, payment_methods=["campus_wallet"]),
    )).status_code == 201
    product = await make_product(client, seller, store, price_minor=2000, stock=5)
    cash = await client.post(
        "/api/orders", headers=buyer.headers,
        json={"store_id": store["id"], "voucher_code": "once", "items": [{"product_id": product["id"], "quantity": 1}]},
    )
    assert cash.status_code == 422
    await client.patch(
        f"/api/stores/{store['id']}", headers=seller.headers,
        json={"order_settings": {"payment_options": ["pay_on_pickup", "campus_wallet"]}},
    )
    await _wallet(client, buyer, 20_00)
    await _wallet(client, other, 20_00)
    taken = await client.post(
        "/api/orders", headers=buyer.headers,
        json={"store_id": store["id"], "payment_method": "campus_wallet", "voucher_code": "once",
              "items": [{"product_id": product["id"], "quantity": 1}]},
    )
    assert taken.status_code == 201, taken.text
    gone = await client.post(
        "/api/orders", headers=other.headers,
        json={"store_id": store["id"], "payment_method": "campus_wallet", "voucher_code": "once",
              "items": [{"product_id": product["id"], "quantity": 1}]},
    )
    assert gone.status_code == 422
    printing = await make_product(client, seller, store, title="Poster", kind="printing", price_minor=0, stock=None)
    quoted = await client.post(
        "/api/orders", headers=other.headers,
        json={"store_id": store["id"], "voucher_code": "once", "items": [{"product_id": printing["id"], "quantity": 1}]},
    )
    assert quoted.status_code == 422
    code_id = (await client.get(f"/api/stores/{store['id']}/vouchers", headers=seller.headers)).json()[0]["id"]
    assert (await client.patch(f"/api/vouchers/{code_id}", headers=seller.headers, json={"active": False})).status_code == 200
    hidden = await client.get(f"/api/stores/{store['id']}/vouchers")
    assert hidden.json() == []
