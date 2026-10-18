import httpx

from .conftest import make_user
from .test_reviews_reports_admin import make_admin


async def test_store_application_needs_admin_approval(
    client: httpx.AsyncClient, database: object
) -> None:
    seller = await make_user(client, "Nia")
    outsider = await make_user(client, "Omar")
    admin = await make_admin(client, database)
    created = await client.post(
        "/api/stores", headers=seller.headers,
        json={"name": "Nia's Notes", "category": "goods", "description": "Second-hand books"},
    )
    assert created.status_code == 201, created.text
    store = created.json()
    assert store["status"] == "pending"
    assert (await client.get("/api/auth/me", headers=seller.headers)).json()["roles"] == ["buyer", "seller"]
    assert (await client.get("/api/stores")).json() == []
    assert (await client.get(f"/api/stores/{store['id']}")).status_code == 404
    assert (await client.get(f"/api/stores/{store['id']}", headers=seller.headers)).status_code == 200
    assert (await client.get(f"/api/stores/{store['id']}/order-options")).status_code == 404
    order = await client.post(
        "/api/orders", headers=outsider.headers,
        json={"store_id": store["id"], "items": [{"product_id": "none", "quantity": 1}]},
    )
    assert order.status_code == 404

    denied = await client.post(
        f"/api/admin/stores/{store['id']}/decision", headers=seller.headers,
        json={"decision": "approved", "reason": "I say so"},
    )
    assert denied.status_code == 403
    jumped = await client.post(
        f"/api/admin/stores/{store['id']}/status", headers=admin.headers,
        params={"suspended": False}, json={"reason": "skip the queue"},
    )
    assert jumped.status_code == 409

    rejected = await client.post(
        f"/api/admin/stores/{store['id']}/decision", headers=admin.headers,
        json={"decision": "rejected", "reason": "Add a pickup spot"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["status"] == "rejected"
    assert rejected.json()["review_reason"] == "Add a pickup spot"
    again = await client.post(
        f"/api/admin/stores/{store['id']}/decision", headers=admin.headers,
        json={"decision": "approved", "reason": "too late"},
    )
    assert again.status_code == 409

    resubmit = await client.post(f"/api/stores/{store['id']}/resubmit", headers=seller.headers)
    assert resubmit.status_code == 200
    assert resubmit.json()["status"] == "pending"
    stranger = await client.post(f"/api/stores/{store['id']}/resubmit", headers=outsider.headers)
    assert stranger.status_code == 403

    approved = await client.post(
        f"/api/admin/stores/{store['id']}/decision", headers=admin.headers,
        json={"decision": "approved", "reason": "Pickup details are clear"},
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == "active"
    listed = (await client.get("/api/stores")).json()
    assert [s["id"] for s in listed] == [store["id"]]
    queue = (await client.get("/api/admin/stores", headers=admin.headers, params={"status": "pending"})).json()
    assert queue == []
