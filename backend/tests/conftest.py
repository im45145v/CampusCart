from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
from mongomock_motor import AsyncMongoMockClient

from app import db as dbmod
from app.main import app
from app.ratelimit import limiter


@pytest.fixture
async def database() -> AsyncIterator[Any]:
    database = AsyncMongoMockClient(tz_aware=True)["campuscart_test"]
    dbmod.holder.db = database
    await dbmod.ensure_indexes(database)
    limiter.reset()
    yield database
    dbmod.holder.db = None


@pytest.fixture
async def client(database: Any) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def bearer(token: str) -> dict[str, str]:
    return {"Authorization": "Bearer " + token}


class Actor:
    def __init__(self, id: str, headers: dict[str, str], token: str):
        self.id, self.headers, self.token = id, headers, token


async def make_user(client: httpx.AsyncClient, name: str) -> Actor:
    r = await client.post(
        "/api/auth/register",
        json={"name": name, "email": f"{name.lower()}@example.com", "password": "password123"},
    )
    assert r.status_code == 201, r.text
    tok = r.json()["token"]
    return Actor(r.json()["user"]["id"], bearer(tok), tok)


@pytest.fixture
async def seller(client: httpx.AsyncClient) -> Actor:
    return await make_user(client, "Sally")


@pytest.fixture
async def buyer(client: httpx.AsyncClient) -> Actor:
    return await make_user(client, "Bob")


@pytest.fixture
async def other(client: httpx.AsyncClient) -> Actor:
    return await make_user(client, "Eve")


@pytest.fixture
async def store(client: httpx.AsyncClient, seller: Actor) -> dict[str, Any]:
    r = await client.post(
        "/api/stores", headers=seller.headers,
        json={"name": "Sally's Snacks", "category": "food", "description": "Tasty"},
    )
    assert r.status_code == 201, r.text
    return dict(r.json())


async def make_product(
    client: httpx.AsyncClient, seller: Actor, store: dict[str, Any], publish: bool = True, **kw: Any
) -> dict[str, Any]:
    body = {"title": "Samosa", "price_minor": 1500, "stock": 5, "category": "snacks", **kw}
    r = await client.post(f"/api/stores/{store['id']}/products", headers=seller.headers, json=body)
    assert r.status_code == 201, r.text
    p = r.json()
    if publish:
        r = await client.post(f"/api/products/{p['id']}/publish", headers=seller.headers)
        assert r.status_code == 200
        p = r.json()
    return dict(p)
