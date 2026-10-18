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


async def test_hosted_gemma_4_request_shape() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen["url"] = str(request.url)
        seen["key"] = request.headers.get("x-goog-api-key")
        seen["body"] = body
        parts = body["contents"][0]["parts"]
        if any(isinstance(p, dict) and "inlineData" in p for p in parts):
            return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "extra egg on fried rice"}]}}]})
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [
            {"text": "hidden", "thought": True}, {"text": "thinking aside"},
        ]}}]})

    provider = llm.GoogleGemmaProvider("gemma-4-26b-a4b-it", "test-key", transport=httpx.MockTransport(handler))
    assert await provider.complete("system", "note") == "thinking aside"
    assert seen["url"].endswith("/models/gemma-4-26b-a4b-it:generateContent")
    assert seen["key"] == "test-key"
    assert seen["body"]["systemInstruction"]["parts"][0]["text"] == "system"
    assert await provider.transcribe(b"abc", "audio/webm") == "extra egg on fried rice"
    assert seen["body"]["contents"][0]["parts"][1]["inlineData"]["mimeType"] == "audio/webm"


def test_api_key_selects_hosted_gemma_4(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import get_settings

    monkeypatch.setenv("GEMMA_API_KEY", "studio-key")
    monkeypatch.setenv("GEMMA_BASE_URL", "")
    monkeypatch.setenv("BACKBOARD_API_KEY", "")
    get_settings.cache_clear()
    try:
        provider = llm.get_provider()
        assert isinstance(provider, llm.GoogleGemmaProvider)
        assert provider.model == "gemma-4-26b-a4b-it"
    finally:
        get_settings.cache_clear()


def test_placeholder_keys_leave_the_assistant_off(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import get_settings

    monkeypatch.setenv("GEMMA_API_KEY", "paste-key-here")
    monkeypatch.setenv("GEMMA_BASE_URL", "")
    monkeypatch.setenv("BACKBOARD_API_KEY", "paste-key-here")
    get_settings.cache_clear()
    try:
        assert llm.get_provider() is None
    finally:
        get_settings.cache_clear()


async def test_backboard_request_shape() -> None:
    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["key"] = request.headers.get("x-api-key")
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json={"content": "{\"title\": \"Chai\"}"})

    provider = llm.BackboardProvider(
        "bb-key", "openai", "gpt-4o", transport=httpx.MockTransport(handler),
    )
    assert await provider.complete("system", "note") == '{"title": "Chai"}'
    assert seen["url"] == "https://app.backboard.io/api/threads/messages"
    assert seen["key"] == "bb-key"
    assert seen["body"]["llm_provider"] == "openai"
    assert seen["body"]["model_name"] == "gpt-4o"
    assert seen["body"]["content"].startswith("system")


def test_gemma_failure_uses_backboard(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import get_settings

    monkeypatch.setenv("GEMMA_API_KEY", "studio-key")
    monkeypatch.setenv("GEMMA_BASE_URL", "")
    monkeypatch.setenv("BACKBOARD_API_KEY", "bb-key")
    monkeypatch.setenv("BACKBOARD_LLM_PROVIDER", "openai")
    monkeypatch.setenv("BACKBOARD_MODEL", "gpt-4o")
    get_settings.cache_clear()
    try:
        provider = llm.get_provider()
        assert isinstance(provider, llm.FallbackProvider)
    finally:
        get_settings.cache_clear()


async def test_fallback_complete_calls_backboard_after_gemma_fails() -> None:
    class Down:
        async def complete(self, system: str, user: str) -> str:
            raise llm.LLMUnavailable("gemma down")

        async def transcribe(self, data: bytes, mime: str) -> str:
            raise llm.LLMUnavailable("no audio")

    seen: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["called"] = True
        return httpx.Response(200, json={"content": "ok"})

    secondary = llm.BackboardProvider("bb-key", "openai", "gpt-4o", transport=httpx.MockTransport(handler))
    assert await llm.FallbackProvider(Down(), secondary).complete("system", "note") == "ok"
    assert seen["called"] is True


def test_uri_in_database_name_is_used_as_the_connection(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import get_settings

    monkeypatch.setenv("MONGODB_URI", "mongodb://localhost:27017")
    monkeypatch.setenv(
        "MONGODB_DB",
        "mongodb+srv://campuscart:secret@cluster0.example.mongodb.net/campuscart?retryWrites=true",
    )
    get_settings.cache_clear()
    try:
        settings = get_settings()
        assert settings.mongodb_uri.startswith("mongodb+srv://campuscart:secret@")
        assert settings.mongodb_db == "campuscart"
    finally:
        get_settings.cache_clear()


def test_dotted_database_name_falls_back_to_campuscart(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import get_settings

    monkeypatch.setenv("MONGODB_URI", "mongodb+srv://campuscart:secret@cluster0.example.mongodb.net/")
    monkeypatch.setenv("MONGODB_DB", "cluster0.example.mongodb.net")
    get_settings.cache_clear()
    try:
        settings = get_settings()
        assert settings.mongodb_uri.startswith("mongodb+srv://")
        assert settings.mongodb_db == "campuscart"
    finally:
        get_settings.cache_clear()


class TalkingProvider(FakeProvider):
    async def transcribe(self, data: bytes, mime: str) -> str:
        assert data == b"abc" and mime == "audio/webm"
        return "ten brownies"


async def test_dictation_uses_gemma_when_configured(
    client: httpx.AsyncClient, seller: Actor, store: dict[str, Any], use_provider: Any
) -> None:
    assert store["id"]
    use_provider(TalkingProvider("{}"))
    r = await client.post(
        "/api/ai/transcribe", headers=seller.headers,
        files={"audio": ("a.webm", b"abc", "audio/webm")},
    )
    assert r.status_code == 200 and r.json()["transcript"] == "ten brownies"


async def test_transcribe_validation(client: httpx.AsyncClient, seller: Actor, store: dict[str, Any]) -> None:
    bad = await client.post("/api/ai/transcribe", headers=seller.headers, files={"audio": ("a.txt", b"hi", "text/plain")})
    assert bad.status_code == 415
    unconfigured = await client.post("/api/ai/transcribe", headers=seller.headers, files={"audio": ("a.webm", b"abc", "audio/webm")})
    assert unconfigured.status_code == 503  # no Gemma key: type the listing instead
