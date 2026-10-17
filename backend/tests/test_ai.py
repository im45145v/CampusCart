import json
from typing import Any

import httpx
import pytest

from app.main import app
from app.services import llm

from .conftest import Actor


class FakeProvider:
    def __init__(self, reply: str | Exception) -> None:
        self.reply = reply

    async def complete(self, system: str, user: str) -> str:
        if isinstance(self.reply, Exception):
            raise self.reply
        return self.reply


@pytest.fixture
def use_provider() -> Any:
    def setter(p: Any) -> None:
        app.dependency_overrides[llm.get_provider] = lambda: p

    yield setter
    app.dependency_overrides.clear()


async def test_draft_is_validated_and_never_published(
    client: httpx.AsyncClient, seller: Actor, store: dict[str, Any], use_provider: Any
) -> None:
    reply = "```json\n" + json.dumps({
        "title": "Chai", "kind": "product", "category": "Drinks",
        "price": 20, "stock": 50,  # 50 was never said by the seller -> must be dropped
        "description": "Hot tea",
    }) + "\n```"
    use_provider(FakeProvider(reply))
    r = await client.post("/api/ai/listing-draft", headers=seller.headers, json={"text": "selling chai for 20 rupees"})
    assert r.status_code == 200
    d = r.json()
    assert d["draft"]["price_minor"] == 2000 and d["draft"]["stock"] is None
    assert d["draft"]["published"] is False
    assert "stock" in d["missing_fields"] and d["warnings"]
    assert (await client.get("/api/products")).json() == []  # nothing was created


async def test_draft_bad_output_and_unavailable_fall_back(
    client: httpx.AsyncClient, seller: Actor, store: dict[str, Any], use_provider: Any
) -> None:
    use_provider(FakeProvider("I'm sorry, I can't do that"))
    assert (await client.post("/api/ai/listing-draft", headers=seller.headers, json={"text": "selling chai"})).status_code == 503
    use_provider(FakeProvider(llm.LLMUnavailable("down")))
    assert (await client.post("/api/ai/listing-draft", headers=seller.headers, json={"text": "selling chai"})).status_code == 503
    use_provider(None)
    r = await client.post("/api/ai/listing-draft", headers=seller.headers, json={"text": "selling chai"})
    assert r.status_code == 503 and "manually" in r.json()["detail"]
    # manual creation still works
    p = await client.post(f"/api/stores/{store['id']}/products", headers=seller.headers, json={"title": "Chai", "price_minor": 2000})
    assert p.status_code == 201


async def test_draft_requires_seller(client: httpx.AsyncClient, buyer: Actor, use_provider: Any) -> None:
    use_provider(FakeProvider("{}"))
    assert (await client.post("/api/ai/listing-draft", headers=buyer.headers, json={"text": "selling chai"})).status_code == 403
    assert (await client.post("/api/ai/listing-draft", json={"text": "selling chai"})).status_code == 401


async def test_transcribe_validation(client: httpx.AsyncClient, seller: Actor, store: dict[str, Any]) -> None:
    bad = await client.post("/api/ai/transcribe", headers=seller.headers, files={"audio": ("a.txt", b"hi", "text/plain")})
    assert bad.status_code == 415
    unconfigured = await client.post("/api/ai/transcribe", headers=seller.headers, files={"audio": ("a.webm", b"abc", "audio/webm")})
    assert unconfigured.status_code == 503  # no ElevenLabs key: text input remains the fallback
