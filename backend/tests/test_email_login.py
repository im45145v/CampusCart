from datetime import timedelta
from typing import Any

import httpx

from app.config import get_settings
from app.util import now


def _wrong(code: str) -> str:
    return "000000" if code != "000000" else "111111"


async def test_new_email_needs_a_name_then_code_signs_them_in(
    client: httpx.AsyncClient, database: Any
) -> None:
    missing = await client.post("/api/auth/email/start", json={"email": "New@example.com"})
    assert missing.status_code == 200
    assert missing.json() == {"needs_name": True}
    assert await database.users.count_documents({"email": "new@example.com"}) == 0

    started = await client.post(
        "/api/auth/email/start", json={"email": "new@example.com", "name": "Nia"},
    )
    assert started.status_code == 200
    body = started.json()
    assert body["sent"] is True
    code = body["dev_code"]
    bad = await client.post(
        "/api/auth/email/verify", json={"email": "new@example.com", "code": _wrong(code)},
    )
    assert bad.status_code == 401
    ok = await client.post(
        "/api/auth/email/verify", json={"email": "new@example.com", "code": code},
    )
    assert ok.status_code == 200
    assert ok.json()["user"]["name"] == "Nia"
    assert ok.json()["user"]["roles"] == ["buyer"]
    me = await client.get("/api/auth/me", headers={"Authorization": "Bearer " + ok.json()["token"]})
    assert me.status_code == 200
    again = await client.post(
        "/api/auth/email/verify", json={"email": "new@example.com", "code": code},
    )
    assert again.status_code == 401
    password = await client.post(
        "/api/auth/login", json={"email": "new@example.com", "password": "password123"},
    )
    assert password.status_code == 401


async def test_magic_link_is_single_use_with_a_short_replay(
    client: httpx.AsyncClient,
) -> None:
    started = await client.post(
        "/api/auth/email/start", json={"email": "link@example.com", "name": "Lee"},
    )
    token = started.json()["dev_token"]
    first = await client.post("/api/auth/email/verify-link", json={"token": token})
    assert first.status_code == 200
    second = await client.post("/api/auth/email/verify-link", json={"token": token})
    assert second.status_code == 200
    assert second.json()["token"] == first.json()["token"]


async def test_existing_password_account_can_use_a_code(client: httpx.AsyncClient) -> None:
    created = await client.post(
        "/api/auth/register",
        json={"name": "Amy", "email": "amy@example.com", "password": "password123"},
    )
    assert created.status_code == 201
    started = await client.post("/api/auth/email/start", json={"email": "amy@example.com"})
    assert started.json()["sent"] is True
    verified = await client.post(
        "/api/auth/email/verify",
        json={"email": "amy@example.com", "code": started.json()["dev_code"]},
    )
    assert verified.status_code == 200
    assert verified.json()["user"]["id"] == created.json()["user"]["id"]


async def test_expired_and_exhausted_codes_are_rejected(
    client: httpx.AsyncClient, database: Any
) -> None:
    started = await client.post(
        "/api/auth/email/start", json={"email": "old@example.com", "name": "Ol"},
    )
    code = started.json()["dev_code"]
    await database.login_challenges.update_one(
        {"email": "old@example.com"}, {"$set": {"expires_at": now() - timedelta(minutes=1)}},
    )
    expired = await client.post(
        "/api/auth/email/verify", json={"email": "old@example.com", "code": code},
    )
    assert expired.status_code == 401

    fresh = await client.post(
        "/api/auth/email/start", json={"email": "old@example.com", "name": "Ol"},
    )
    fresh_code = fresh.json()["dev_code"]
    wrong = _wrong(fresh_code)
    for _ in range(5):
        assert (await client.post(
            "/api/auth/email/verify", json={"email": "old@example.com", "code": wrong},
        )).status_code == 401
    blocked = await client.post(
        "/api/auth/email/verify", json={"email": "old@example.com", "code": fresh_code},
    )
    assert blocked.status_code == 401


async def test_disabled_account_cannot_request_a_code(
    client: httpx.AsyncClient, database: Any
) -> None:
    await client.post(
        "/api/auth/register",
        json={"name": "Amy", "email": "amy@example.com", "password": "password123"},
    )
    await database.users.update_one({"email": "amy@example.com"}, {"$set": {"is_active": False}})
    r = await client.post("/api/auth/email/start", json={"email": "amy@example.com"})
    assert r.status_code == 403


async def test_production_without_resend_does_not_reveal_a_code(
    client: httpx.AsyncClient, monkeypatch: Any
) -> None:
    settings = get_settings()
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "resend_api_key", "")
    r = await client.post(
        "/api/auth/email/start", json={"email": "live@example.com", "name": "Liv"},
    )
    assert r.status_code == 503
    assert "dev_code" not in r.text


async def test_configured_resend_sends_mail_and_hides_the_code(
    client: httpx.AsyncClient, monkeypatch: Any
) -> None:
    sent: dict[str, str] = {}

    async def fake_send(**kwargs: str) -> None:
        sent.update(kwargs)

    monkeypatch.setattr("app.routers.auth.send_login_email", fake_send)
    settings = get_settings()
    monkeypatch.setattr(settings, "resend_api_key", "re_test")
    monkeypatch.setattr(settings, "email_from", "UniCart <login@example.com>")
    monkeypatch.setattr(settings, "public_web_url", "https://campuscart.example")
    r = await client.post(
        "/api/auth/email/start", json={"email": "live@example.com", "name": "Liv"},
    )
    assert r.status_code == 200
    assert r.json() == {"sent": True}
    assert sent["to"] == "live@example.com"
    assert sent["sender"] == "UniCart <login@example.com>"
    assert "https://campuscart.example/login/verify?token=" in sent["link"]
    assert len(sent["code"]) == 6
