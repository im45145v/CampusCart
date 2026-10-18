import hashlib
import hmac
import json
from typing import Any

import httpx
import pytest

from app.config import get_settings
from app.services import youpi
from app.services.wallet import credit

from .conftest import Actor, make_product
from .test_reviews_reports_admin import make_admin

SECRET = "test-youpi-webhook-secret"


def _sign(raw: bytes) -> str:
    digest = hmac.new(SECRET.encode(), raw, hashlib.sha256).hexdigest()
    return "sha256=" + digest


def _enable_youpi(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "youpi_api_url", "http://youpi.test")
    monkeypatch.setattr(settings, "youpi_merchant_id", "merchant-1")
    monkeypatch.setattr(settings, "youpi_webhook_secret", SECRET)


async def _wallet(client: httpx.AsyncClient, actor: Actor, amount: int = 50_00, *, database: Any) -> None:
    del client
    await credit(database, actor.id, amount, "topup", note="test load", method="youpi")


async def test_add_and_remove_funds(
    client: httpx.AsyncClient, buyer: Actor, database: Any
) -> None:
    desk = await client.get("/api/payments/desk")
    assert desk.status_code == 200
    assert set(desk.json()) == {"provider", "checkout"}
    assert desk.json()["provider"] == "youpi"
    retired = await client.post(
        "/api/me/wallet/add", headers=buyer.headers,
        json={"amount_minor": 20_00, "method": "upi", "note": "desk", "transaction_id": "UTRDESK0001"},
    )
    assert retired.status_code == 410
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 0
    broke = await client.post(
        "/api/me/wallet/remove", headers=buyer.headers,
        json={"amount_minor": 10_00, "note": "too soon"},
    )
    assert broke.status_code == 409
    await _wallet(client, buyer, 20_00, database=database)
    wallet = (await client.get("/api/me/wallet", headers=buyer.headers)).json()
    assert wallet["balance_minor"] == 20_00
    assert wallet["checkout"] == "unavailable"
    admin = await make_admin(client, database)
    low = await client.post(
        "/api/me/wallet/remove", headers=buyer.headers,
        json={"amount_minor": 100, "note": "back to desk"},
    )
    assert low.status_code == 422
    gone = await client.post(
        "/api/me/wallet/remove", headers=buyer.headers,
        json={"amount_minor": 30_00, "note": "too much"},
    )
    assert gone.status_code == 409
    out = await client.post(
        "/api/me/wallet/remove", headers=buyer.headers,
        json={"amount_minor": 10_00, "note": "hostel desk, Friday"},
    )
    assert out.status_code == 201, out.text
    assert out.json()["status"] == "requested"
    duplicate = await client.post(
        "/api/me/wallet/remove", headers=buyer.headers,
        json={"amount_minor": 10_00, "note": "hostel desk, Friday"},
    )
    assert duplicate.status_code == 409
    wallet = (await client.get("/api/me/wallet", headers=buyer.headers)).json()
    assert wallet["balance_minor"] == 10_00
    assert {e["reason"] for e in wallet["entries"]} >= {"topup", "withdrawal"}
    paid = await client.post(f"/api/admin/wallet/{out.json()['id']}/paid", headers=admin.headers)
    assert paid.status_code == 200
    assert paid.json()["status"] == "paid"
    assert (await client.post(
        f"/api/admin/wallet/{out.json()['id']}/paid", headers=admin.headers,
    )).status_code == 409
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 10_00


async def test_youpi_callback_credits_once(
    client: httpx.AsyncClient, buyer: Actor, database: Any, monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_youpi(monkeypatch)

    async def fake_create(order_id: str, amount_minor: int, return_url: str) -> dict[str, str]:
        assert amount_minor == 20_00
        assert return_url.endswith("/account")
        return {"paymentId": f"pay-{order_id}", "checkoutUrl": f"http://youpi.test/checkout/{order_id}"}

    async def fake_fetch(payment_id: str) -> dict[str, Any]:
        order_id = payment_id.removeprefix("pay-")
        return {
            "paymentId": payment_id, "orderId": order_id, "status": "SUCCESS", "method": "UPI",
            "amountPaise": 20_00, "verificationLevel": 1, "verificationTag": "Single Verification",
            "verificationSources": ["SMS"],
        }

    monkeypatch.setattr(youpi, "create_payment", fake_create)
    monkeypatch.setattr(youpi, "fetch_payment", fake_fetch)
    opened = await client.post(
        "/api/me/wallet/checkout", headers=buyer.headers, json={"amount_minor": 20_00},
    )
    assert opened.status_code == 201, opened.text
    body = opened.json()
    assert body["status"] == "requested"
    assert body["checkout_url"] == f"http://youpi.test/checkout/{body['id']}"
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 0
    same = await client.post(
        "/api/me/wallet/checkout", headers=buyer.headers, json={"amount_minor": 20_00},
    )
    assert same.json()["id"] == body["id"]
    admin = await make_admin(client, database)
    assert (await client.post(
        f"/api/admin/wallet/{body['id']}/approve", headers=admin.headers,
    )).status_code == 409

    payload = {
        "event": "SUCCESS", "paymentId": body["youpi_payment_id"], "orderId": body["id"],
        "amount": "20.00", "amountPaise": 20_00, "currency": "INR", "method": "UPI",
    }
    raw = json.dumps(payload).encode()
    unsigned = await client.post("/api/payments/youpi", content=raw)
    assert unsigned.status_code == 401
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 0
    browser = await client.post(
        "/api/payments/youpi", headers={"X-Gateway-Signature": _sign(raw)},
        json={"event": "SUCCESS", "credited": True},
    )
    assert browser.status_code == 401

    cod = dict(payload, method="COD")
    cod_raw = json.dumps(cod).encode()
    ignored = await client.post(
        "/api/payments/youpi", content=cod_raw, headers={"X-Gateway-Signature": _sign(cod_raw)},
    )
    assert ignored.status_code == 200
    assert ignored.json()["credited"] is False
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 0

    confirmed = await client.post(
        "/api/payments/youpi", content=raw, headers={"X-Gateway-Signature": _sign(raw)},
    )
    assert confirmed.status_code == 200, confirmed.text
    assert confirmed.json()["credited"] is True
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 20_00
    again = await client.post(
        "/api/payments/youpi", content=raw, headers={"X-Gateway-Signature": _sign(raw)},
    )
    assert again.status_code == 200
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 20_00


async def test_youpi_rejects_a_signed_callback_the_gateway_does_not_confirm(
    client: httpx.AsyncClient, buyer: Actor, monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_youpi(monkeypatch)

    async def fake_create(order_id: str, amount_minor: int, return_url: str) -> dict[str, str]:
        del amount_minor, return_url
        return {"paymentId": f"pay-{order_id}", "checkoutUrl": f"http://youpi.test/checkout/{order_id}"}

    async def fake_fetch(payment_id: str) -> dict[str, Any]:
        return {
            "paymentId": payment_id, "orderId": payment_id.removeprefix("pay-"),
            "status": "SUCCESS", "method": "COD", "amountPaise": "2000",
            "verificationLevel": 1, "verificationTag": "COD_ORDER_PLACED",
            "verificationSources": [],
        }

    monkeypatch.setattr(youpi, "create_payment", fake_create)
    monkeypatch.setattr(youpi, "fetch_payment", fake_fetch)
    opened = await client.post(
        "/api/me/wallet/checkout", headers=buyer.headers, json={"amount_minor": 20_00},
    )
    body = opened.json()
    payload = {
        "event": "SUCCESS", "paymentId": body["youpi_payment_id"], "orderId": body["id"],
        "amountPaise": 20_00, "method": "UPI",
    }
    raw = json.dumps(payload).encode()
    response = await client.post(
        "/api/payments/youpi", content=raw, headers={"X-Gateway-Signature": _sign(raw)},
    )
    assert response.status_code == 200
    assert response.json()["credited"] is False
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 0


async def test_youpi_checkout_respects_the_daily_cap(
    client: httpx.AsyncClient, buyer: Actor, monkeypatch: pytest.MonkeyPatch,
) -> None:
    _enable_youpi(monkeypatch)

    async def fake_create(order_id: str, amount_minor: int, return_url: str) -> dict[str, str]:
        del amount_minor, return_url
        return {"paymentId": f"pay-{order_id}", "checkoutUrl": f"http://youpi.test/checkout/{order_id}"}

    monkeypatch.setattr(youpi, "create_payment", fake_create)
    for amount in (2_000_00, 1_500_00):
        row = await client.post(
            "/api/me/wallet/checkout", headers=buyer.headers, json={"amount_minor": amount},
        )
        assert row.status_code == 201, row.text
    capped = await client.post(
        "/api/me/wallet/checkout", headers=buyer.headers, json={"amount_minor": 1_600_00},
    )
    assert capped.status_code == 409
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 0


async def test_admin_reverses_a_topup(
    client: httpx.AsyncClient, buyer: Actor, database: Any
) -> None:
    await _wallet(client, buyer, 20_00, database=database)
    admin = await make_admin(client, database)
    topups = (await client.get(
        "/api/admin/wallet", headers=admin.headers, params={"status": "posted", "reason": "topup"}
    )).json()
    assert len(topups) == 1
    reversed_row = await client.post(f"/api/admin/wallet/{topups[0]['id']}/reverse", headers=admin.headers)
    assert reversed_row.status_code == 200, reversed_row.text
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 0
    await _wallet(client, buyer, 20_00, database=database)
    payout = (await client.get("/api/me/wallet", headers=buyer.headers)).json()["entries"][0]
    assert (await client.post(
        "/api/me/wallet/remove", headers=buyer.headers,
        json={"amount_minor": 10_00, "note": "desk Friday"},
    )).status_code == 201
    waiting = (await client.get("/api/admin/wallet", headers=admin.headers)).json()
    assert waiting[0]["status"] == "requested"
    paid = await client.post(f"/api/admin/wallet/{waiting[0]['id']}/paid", headers=admin.headers)
    assert paid.status_code == 200
    assert payout["amount_minor"] == 20_00


async def test_wallet_order_refunds_and_pays_seller(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any], database: Any
) -> None:
    await client.patch(
        f"/api/stores/{store['id']}", headers=seller.headers,
        json={"order_settings": {"payment_options": ["pay_on_pickup", "campus_wallet"]}},
    )
    p = await make_product(client, seller, store, price_minor=1500, stock=2)
    broke = await client.post(
        "/api/orders", headers=buyer.headers,
        json={"store_id": store["id"], "payment_method": "campus_wallet",
              "items": [{"product_id": p["id"], "quantity": 1}]},
    )
    assert broke.status_code == 409
    assert (await client.get(f"/api/products/{p['id']}")).json()["stock"] == 2

    await _wallet(client, buyer, 50_00, database=database)
    placed = await client.post(
        "/api/orders", headers=buyer.headers,
        json={"store_id": store["id"], "payment_method": "campus_wallet",
              "items": [{"product_id": p["id"], "quantity": 1}]},
    )
    assert placed.status_code == 201, placed.text
    order = placed.json()
    assert order["payment_status"] == "wallet_paid"
    assert order["total_minor"] == 1500
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 35_00

    cancelled = await client.post(
        f"/api/orders/{order['id']}/status", headers=buyer.headers, json={"status": "cancelled"}
    )
    assert cancelled.status_code == 200
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 50_00
    assert (await client.get(f"/api/products/{p['id']}")).json()["stock"] == 2

    again = await client.post(
        "/api/orders", headers=buyer.headers,
        json={"store_id": store["id"], "payment_method": "campus_wallet",
              "items": [{"product_id": p["id"], "quantity": 1}]},
    )
    oid = again.json()["id"]
    for status in ("accepted", "preparing", "ready", "completed"):
        r = await client.post(
            f"/api/orders/{oid}/status", headers=seller.headers, json={"status": status}
        )
        assert r.status_code == 200, r.text
    confirm = await client.post(f"/api/orders/{oid}/confirm-payment", headers=seller.headers)
    assert confirm.status_code == 409
    assert (await client.get("/api/me/wallet", headers=seller.headers)).json()["balance_minor"] == 1500
    charts = (await client.get("/api/seller/charts", headers=seller.headers)).json()
    assert len(charts["days"]) == 14
    assert sum(d["orders"] for d in charts["days"]) == 1
    assert charts["by_status"]["completed"] == 1


async def test_subscription_discounts_checkout(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any], database: Any
) -> None:
    plan = await client.post(
        f"/api/stores/{store['id']}/plans", headers=seller.headers,
        json={"title": "Lunch club", "description": "Weekday thali discount",
              "price_minor": 20_00, "period": "week", "discount_percent": 10},
    )
    assert plan.status_code == 201, plan.text
    poor = await client.post(f"/api/plans/{plan.json()['id']}/subscribe", headers=buyer.headers)
    assert poor.status_code == 409
    await _wallet(client, buyer, 100_00, database=database)
    sub = await client.post(f"/api/plans/{plan.json()['id']}/subscribe", headers=buyer.headers)
    assert sub.status_code == 201, sub.text
    again = await client.post(f"/api/plans/{plan.json()['id']}/subscribe", headers=buyer.headers)
    assert again.status_code == 409
    assert (await client.get("/api/me/wallet", headers=buyer.headers)).json()["balance_minor"] == 80_00

    p = await make_product(client, seller, store, price_minor=1000, stock=5)
    await client.patch(
        f"/api/stores/{store['id']}", headers=seller.headers,
        json={"order_settings": {"payment_options": ["campus_wallet"]}},
    )
    order = await client.post(
        "/api/orders", headers=buyer.headers,
        json={"store_id": store["id"], "payment_method": "campus_wallet",
              "items": [{"product_id": p["id"], "quantity": 2}]},
    )
    assert order.status_code == 201, order.text
    body = order.json()
    assert body["discount_minor"] == 200
    assert body["total_minor"] == 1800
    assert body["subscription_id"] == sub.json()["id"]

    cancelled = await client.post(
        f"/api/subscriptions/{sub.json()['id']}/cancel", headers=buyer.headers
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"


async def test_review_aspects_and_seller_reply(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(client, seller, store)
    o = (await client.post(
        "/api/orders", headers=buyer.headers,
        json={"store_id": store["id"], "items": [{"product_id": p["id"], "quantity": 1}]},
    )).json()
    for status in ("accepted", "preparing", "ready", "completed"):
        assert (await client.post(
            f"/api/orders/{o['id']}/status", headers=seller.headers, json={"status": status}
        )).status_code == 200
    empty = await client.get(f"/api/orders/{o['id']}/review", headers=buyer.headers)
    assert empty.json()["review"] is None
    created = await client.post(
        f"/api/orders/{o['id']}/review", headers=buyer.headers,
        json={"rating": 5, "comment": "Hot and on time",
              "aspects": {"quality": 5, "timing": 4, "value": 5}},
    )
    assert created.status_code == 201, created.text
    review_id = created.json()["id"]
    stranger = await client.post(
        f"/api/reviews/{review_id}/reply", headers=buyer.headers, json={"reply": "thanks"}
    )
    assert stranger.status_code == 404
    reply = await client.post(
        f"/api/reviews/{review_id}/reply", headers=seller.headers, json={"reply": "Glad you liked it"}
    )
    assert reply.status_code == 200, reply.text
    assert (await client.post(
        f"/api/reviews/{review_id}/reply", headers=seller.headers, json={"reply": "again"}
    )).status_code == 409
    listed = (await client.get(f"/api/stores/{store['id']}/reviews")).json()
    assert listed[0]["seller_reply"] == "Glad you liked it"
    assert listed[0]["aspects"]["timing"] == 4
    store_doc = (await client.get(f"/api/stores/{store['id']}")).json()
    assert store_doc["rating_hist"]["5"] == 1
