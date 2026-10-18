import hmac
import secrets
from datetime import datetime, timedelta
from typing import Any, Literal
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from ..config import Settings, get_settings
from ..deps import CurrentUser, DbDep
from ..ratelimit import enforce
from ..schemas import EmailStartIn, EmailVerifyIn, LoginIn, MagicLinkIn, RegisterIn
from ..security import create_access_token, hash_api_token, hash_password, verify_password
from ..services.email import send_login_email
from ..util import new_id, now

router = APIRouter(prefix="/api/auth", tags=["auth"])

_REPLAY_SECONDS = 60


def public_user(u: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": u["_id"], "name": u["name"], "email": u["email"],
        "roles": u["roles"], "karma_balance": u.get("karma_balance", 0),
        "wallet_balance_minor": u.get("wallet_balance_minor", 0),
    }


def _limit(request: Request) -> None:
    s = get_settings()
    enforce(request, "auth", s.auth_rate_limit_attempts, s.auth_rate_limit_window_s)


def _delivery(s: Settings) -> Literal["dev", "resend"]:
    if s.resend_api_key.strip():
        if not s.email_from.strip():
            raise HTTPException(503, "Email sign-in is not configured")
        if s.environment == "production" and not s.public_web_url.startswith("https://"):
            raise HTTPException(503, "Email sign-in is not configured")
        return "resend"
    if s.environment == "production":
        raise HTTPException(503, "Email sign-in is not configured")
    return "dev"


def _blank_user(email: str, name: str) -> dict[str, Any]:
    return {
        "_id": new_id(), "name": name, "email": email,
        "roles": ["buyer"],
        "is_active": True, "saved_stores": [], "karma_balance": 0,
        "wallet_balance_minor": 0, "created_at": now(),
    }


async def _ensure_user(db: Any, challenge: dict[str, Any]) -> dict[str, Any]:
    email = str(challenge["email"])
    user = await db.users.find_one({"email": email})
    if user:
        if not user.get("is_active", True):
            raise HTTPException(403, "This account is disabled")
        return user
    name = str(challenge.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Add your name to create an account")
    user = _blank_user(email, name)
    try:
        await db.users.insert_one(user)
    except DuplicateKeyError:
        user = await db.users.find_one({"email": email})
        if not user:
            raise
    return user


async def _replay(db: Any, challenge_id: str) -> dict[str, Any] | None:
    row = await db.login_challenges.find_one({"_id": challenge_id, "used_at": {"$ne": None}})
    token = row.get("access_token") if row else None
    used = row.get("used_at") if row else None
    if not row or not isinstance(token, str) or not isinstance(used, datetime):
        return None
    if now() - used > timedelta(seconds=_REPLAY_SECONDS):
        return None
    user = await db.users.find_one({"email": row["email"]})
    if not user or not user.get("is_active", True):
        return None
    return {"token": token, "user": public_user(user)}


async def _consume_and_issue(db: Any, row: dict[str, Any]) -> dict[str, Any]:
    consumed = await db.login_challenges.find_one_and_update(
        {"_id": row["_id"], "used_at": None},
        {"$set": {"used_at": now()}},
        return_document=ReturnDocument.AFTER,
    )
    if consumed is None:
        replay = await _replay(db, str(row["_id"]))
        if replay:
            return replay
        raise HTTPException(401, "That code is invalid or expired")
    user = await _ensure_user(db, consumed)
    token = create_access_token(str(user["_id"]))
    await db.login_challenges.update_one(
        {"_id": consumed["_id"]}, {"$set": {"access_token": token}},
    )
    return {"token": token, "user": public_user(user)}


@router.post("/register", status_code=201)
async def register(body: RegisterIn, request: Request, db: DbDep) -> dict[str, Any]:
    _limit(request)
    user = _blank_user(body.email, body.name)
    user["password_hash"] = hash_password(body.password)
    try:
        await db.users.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(409, "Email already registered") from None
    return {"token": create_access_token(str(user["_id"])), "user": public_user(user)}


@router.post("/login")
async def login(body: LoginIn, request: Request, db: DbDep) -> dict[str, Any]:
    _limit(request)
    user = await db.users.find_one({"email": body.email})
    hashed = user.get("password_hash") if user else None
    if (
        not user
        or not user.get("is_active", True)
        or not isinstance(hashed, str)
        or not verify_password(body.password, hashed)
    ):
        raise HTTPException(401, "Invalid email or password")
    return {"token": create_access_token(str(user["_id"])), "user": public_user(user)}


@router.post("/email/start")
async def email_start(body: EmailStartIn, request: Request, db: DbDep) -> dict[str, Any]:
    """Send a 6-digit code and a one-time link. New addresses must include a name."""
    s = get_settings()
    _limit(request)
    user = await db.users.find_one({"email": body.email}, {"is_active": 1})
    if user and not user.get("is_active", True):
        raise HTTPException(403, "This account is disabled")
    if not user and not body.name:
        return {"needs_name": True}
    mode = _delivery(s)
    code = f"{secrets.randbelow(1_000_000):06d}"
    token = secrets.token_urlsafe(32)
    await db.login_challenges.delete_many({"email": body.email, "used_at": None})
    challenge_id = new_id()
    await db.login_challenges.insert_one({
        "_id": challenge_id,
        "email": body.email,
        "name": body.name if not user else None,
        "code_hash": hash_api_token(code),
        "token_hash": hash_api_token(token),
        "expires_at": now() + timedelta(minutes=s.otp_ttl_minutes),
        "attempts": 0,
        "used_at": None,
        "created_at": now(),
    })
    if mode == "dev":
        return {"sent": True, "dev_code": code, "dev_token": token}
    link = f"{s.public_web_url.rstrip('/')}/login/verify?token={quote(token, safe='')}"
    try:
        await send_login_email(
            api_key=s.resend_api_key.strip(),
            sender=s.email_from.strip(),
            to=body.email,
            code=code,
            link=link,
        )
    except HTTPException:
        await db.login_challenges.delete_one({"_id": challenge_id})
        raise
    return {"sent": True}


@router.post("/email/verify")
async def email_verify(body: EmailVerifyIn, request: Request, db: DbDep) -> dict[str, Any]:
    s = get_settings()
    _limit(request)
    row = await db.login_challenges.find_one_and_update(
        {
            "email": body.email,
            "used_at": None,
            "expires_at": {"$gt": now()},
            "attempts": {"$lt": s.otp_max_attempts},
        },
        {"$inc": {"attempts": 1}},
        sort=[("created_at", -1)],
        return_document=ReturnDocument.AFTER,
    )
    code_hash = hash_api_token(body.code)
    if row is None or not hmac.compare_digest(str(row["code_hash"]), code_hash):
        raise HTTPException(401, "That code is invalid or expired")
    return await _consume_and_issue(db, row)


@router.post("/email/verify-link")
async def email_verify_link(body: MagicLinkIn, request: Request, db: DbDep) -> dict[str, Any]:
    _limit(request)
    row = await db.login_challenges.find_one({
        "token_hash": hash_api_token(body.token),
        "expires_at": {"$gt": now()},
    })
    if row is None:
        raise HTTPException(401, "That sign-in link is invalid or expired")
    if row.get("used_at"):
        replay = await _replay(db, str(row["_id"]))
        if replay:
            return replay
        raise HTTPException(401, "That sign-in link is invalid or expired")
    return await _consume_and_issue(db, row)


@router.get("/me")
async def me(user: CurrentUser) -> dict[str, Any]:
    return public_user(user)
