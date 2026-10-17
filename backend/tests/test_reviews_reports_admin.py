from typing import Any

import httpx

from .conftest import Actor, bearer, make_product, make_user


async def completed_order(client: httpx.AsyncClient, seller: Actor, buyer: Actor, store: dict[str, Any]) -> str:
    p = await make_product(client, seller, store)
    o = (await client.post("/api/orders", headers=buyer.headers, json={"store_id": store["id"], "items": [{"product_id": p["id"], "quantity": 1}]})).json()
    for s in ("accepted", "preparing", "ready", "completed"):
        r = await client.post(f"/api/orders/{o['id']}/status", headers=seller.headers, json={"status": s})
        assert r.status_code == 200
    return str(o["id"])


async def test_reviews_eligibility_and_duplicates(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, other: Actor, store: dict[str, Any]
) -> None:
    p = await make_product(client, seller, store)
    o = (await client.post("/api/orders", headers=buyer.headers, json={"store_id": store["id"], "items": [{"product_id": p["id"], "quantity": 1}]})).json()
    early = await client.post(f"/api/orders/{o['id']}/review", headers=buyer.headers, json={"rating": 5})
    assert early.status_code == 409
    oid = await completed_order(client, seller, buyer, store)
    assert (await client.post(f"/api/orders/{oid}/review", headers=other.headers, json={"rating": 5})).status_code == 404
    assert (await client.post(f"/api/orders/{oid}/review", headers=seller.headers, json={"rating": 5})).status_code == 404
    assert (await client.post(f"/api/orders/{oid}/review", headers=buyer.headers, json={"rating": 9})).status_code == 422
    assert (await client.post(f"/api/orders/{oid}/review", headers=buyer.headers, json={"rating": 4, "comment": "ok"})).status_code == 201
    assert (await client.post(f"/api/orders/{oid}/review", headers=buyer.headers, json={"rating": 5})).status_code == 409
    assert (await client.get(f"/api/stores/{store['id']}")).json()["rating_avg"] == 4.0
    assert len((await client.get(f"/api/stores/{store['id']}/reviews")).json()) == 1


async def make_admin(client: httpx.AsyncClient, database: Any) -> Actor:
    a = await make_user(client, "Root")
    await database.users.update_one({"_id": a.id}, {"$addToSet": {"roles": "admin"}})
    return Actor(a.id, bearer(a.token), a.token)


async def test_reports_admin_workflow_and_audit(
    client: httpx.AsyncClient, seller: Actor, buyer: Actor, other: Actor, store: dict[str, Any], database: Any
) -> None:
    admin = await make_admin(client, database)
    p = await make_product(client, seller, store)
    conv = (await client.post("/api/chat/conversations", headers=buyer.headers, json={"store_id": store["id"]})).json()
    await client.post(f"/api/chat/conversations/{conv['id']}/messages", headers=buyer.headers, json={"text": "pay me elsewhere"})
    # outsiders cannot report (or probe) a private conversation
    r = await client.post("/api/reports", headers=other.headers, json={"target_type": "conversation", "target_id": conv["id"], "reason": "spam"})
    assert r.status_code == 404
    rep = await client.post("/api/reports", headers=seller.headers, json={"target_type": "conversation", "target_id": conv["id"], "reason": "scam attempt"})
    assert rep.status_code == 201
    assert (await client.post("/api/reports", headers=buyer.headers, json={"target_type": "store", "target_id": store["id"], "reason": "fake"})).status_code == 201
    # non-admins are locked out
    for path in ("users", "stores", "reports", "audit"):
        assert (await client.get(f"/api/admin/{path}", headers=buyer.headers)).status_code == 403
    assert (await client.get("/api/admin/users", headers=admin.headers)).status_code == 200
    assert all("password_hash" not in u for u in (await client.get("/api/admin/users", headers=admin.headers)).json())
    msgs = await client.get(f"/api/admin/reports/{rep.json()['id']}/conversation", headers=admin.headers)
    assert msgs.json()[0]["text"] == "pay me elsewhere"
    res = await client.post(f"/api/admin/reports/{rep.json()['id']}/resolve", headers=admin.headers, json={"status": "resolved", "resolution": "Warned user"})
    assert res.json()["status"] == "resolved"
    again = await client.post(f"/api/admin/reports/{rep.json()['id']}/resolve", headers=admin.headers, json={"status": "dismissed", "resolution": "dup"})
    assert again.status_code == 409
    # moderation hides content and is audited
    assert (await client.post(f"/api/admin/products/{p['id']}/moderate", headers=admin.headers, params={"remove": True}, json={"reason": "prohibited"})).status_code == 200
    assert (await client.get(f"/api/products/{p['id']}")).status_code == 404
    assert (await client.post(f"/api/products/{p['id']}/publish", headers=seller.headers)).status_code == 409
    assert (await client.post(f"/api/admin/stores/{store['id']}/status", headers=admin.headers, params={"suspended": True}, json={"reason": "fraud"})).status_code == 200
    assert (await client.get(f"/api/stores/{store['id']}")).status_code == 404
    assert (await client.post(f"/api/admin/users/{buyer.id}/active", headers=admin.headers, params={"active": False}, json={"reason": "abuse"})).status_code == 200
    assert (await client.get("/api/orders", headers=buyer.headers)).status_code == 401
    assert (await client.post(f"/api/admin/users/{admin.id}/active", headers=admin.headers, params={"active": False}, json={"reason": "oops"})).status_code == 400
    actions = {a["action"] for a in (await client.get("/api/admin/audit", headers=admin.headers)).json()}
    assert {"report.resolved", "product.removed", "store.suspended", "user.deactivate", "conversation.review"} <= actions
