from typing import Any

import httpx

from .conftest import Actor, make_product, make_user


async def test_register_login_and_roles(client: httpx.AsyncClient) -> None:
    a = await make_user(client, "Amy")
    me = await client.get("/api/auth/me", headers=a.headers)
    assert me.json()["roles"] == ["buyer"]
    r = await client.post("/api/auth/login", json={"email": "amy@example.com", "password": "password123"})
    assert r.status_code == 200
    r = await client.post("/api/auth/login", json={"email": "amy@example.com", "password": "wrongpass"})
    assert r.status_code == 401
    dup = await client.post(
        "/api/auth/register",
        json={"name": "x", "email": "AMY@example.com", "password": "password123"},
    )
    assert dup.status_code == 409


async def test_cannot_self_assign_admin(client: httpx.AsyncClient) -> None:
    r = await client.post(
        "/api/auth/register",
        json={"name": "x", "email": "x@example.com", "password": "password123", "roles": ["admin"]},
    )
    assert r.status_code == 422


async def test_auth_required_and_login_rate_limit(client: httpx.AsyncClient) -> None:
    assert (await client.get("/api/orders")).status_code == 401
    for _ in range(10):
        await client.post("/api/auth/login", json={"email": "n@example.com", "password": "password123"})
    r = await client.post("/api/auth/login", json={"email": "n@example.com", "password": "password123"})
    assert r.status_code == 429


async def test_store_creation_grants_seller_role(
    client: httpx.AsyncClient, seller: Actor, store: dict[str, Any]
) -> None:
    me = await client.get("/api/auth/me", headers=seller.headers)
    assert "seller" in me.json()["roles"]


async def test_only_owner_can_edit_store_and_products(
    client: httpx.AsyncClient, seller: Actor, other: Actor, store: dict[str, Any]
) -> None:
    r = await client.patch(f"/api/stores/{store['id']}", headers=other.headers, json={"name": "Hax"})
    assert r.status_code == 403
    r = await client.post(
        f"/api/stores/{store['id']}/products", headers=other.headers,
        json={"title": "Fake", "price_minor": 1},
    )
    assert r.status_code == 403
    p = await make_product(client, seller, store)
    r = await client.patch(f"/api/products/{p['id']}", headers=other.headers, json={"price_minor": 1})
    assert r.status_code == 403
    r = await client.post(f"/api/products/{p['id']}/unpublish", headers=other.headers)
    assert r.status_code == 403


async def test_drafts_hidden_until_published_and_search(
    client: httpx.AsyncClient, seller: Actor, store: dict[str, Any]
) -> None:
    draft = await make_product(client, seller, store, publish=False, title="Secret Draft")
    assert draft["published"] is False
    assert (await client.get(f"/api/products/{draft['id']}")).status_code == 404
    assert (await client.get("/api/products", params={"q": "Secret"})).json() == []
    await client.post(f"/api/products/{draft['id']}/publish", headers=seller.headers)
    found = (await client.get("/api/products", params={"q": "secret"})).json()
    assert [p["id"] for p in found] == [draft["id"]]
    # regex metacharacters are treated literally
    assert (await client.get("/api/products", params={"q": ".*"})).json() == []
    cheap = (await client.get("/api/products", params={"max_price": 100})).json()
    assert cheap == []
    out = (await client.get("/api/products", params={"in_stock": False})).json()
    assert out == []


async def test_home_payload(client: httpx.AsyncClient, seller: Actor, store: dict[str, Any]) -> None:
    await make_product(client, seller, store)
    h = (await client.get("/api/home")).json()
    assert h["featured_stores"][0]["id"] == store["id"]
    assert len(h["popular_products"]) == 1
    assert h["featured_products"] == []
    assert len(h["latest_products"]) == 1
    assert h["category_rails"][0]["slug"] == "food"
    assert {c["slug"] for c in h["categories"]} >= {"food", "printing"}


async def test_a_stall_can_feature_three_listings(
    client: httpx.AsyncClient, seller: Actor, store: dict[str, Any]
) -> None:
    for i in range(3):
        made = await make_product(client, seller, store, title=f"Featured {i}", featured=True)
        assert made["featured"] is True
    plain = await make_product(client, seller, store, title="Everyday samosa")
    blocked = await client.post(
        f"/api/stores/{store['id']}/products",
        headers=seller.headers,
        json={"title": "One too many", "price_minor": 100, "stock": 1, "category": "snacks", "featured": True},
    )
    assert blocked.status_code == 422
    h = (await client.get("/api/home")).json()
    titles = {p["title"] for p in h["featured_products"]}
    assert titles == {"Featured 0", "Featured 1", "Featured 2"}
    assert plain["title"] in {p["title"] for p in h["latest_products"]}
    assert plain["title"] not in titles


async def test_saved_stores(client: httpx.AsyncClient, buyer: Actor, store: dict[str, Any]) -> None:
    assert (await client.put(f"/api/me/saved-stores/{store['id']}", headers=buyer.headers)).status_code == 204
    saved = (await client.get("/api/me/saved-stores", headers=buyer.headers)).json()
    assert [s["id"] for s in saved] == [store["id"]]
    await client.delete(f"/api/me/saved-stores/{store['id']}", headers=buyer.headers)
    assert (await client.get("/api/me/saved-stores", headers=buyer.headers)).json() == []


async def test_upload_validates_content(client: httpx.AsyncClient, seller: Actor, store: dict[str, Any], tmp_path: Any, monkeypatch: Any) -> None:
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path))
    bad = await client.post("/api/uploads", headers=seller.headers,
                            files={"file": ("a.png", b"<script>alert(1)</script>", "image/png")})
    assert bad.status_code == 415
    ok = await client.post("/api/uploads", headers=seller.headers,
                           files={"file": ("../../evil.exe", b"\x89PNG\r\n\x1a\n" + b"0" * 20, "image/png")})
    assert ok.status_code == 201
    assert ok.json()["url"].endswith(".png") and ".." not in ok.json()["url"]
