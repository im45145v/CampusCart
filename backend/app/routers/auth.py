from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pymongo.errors import DuplicateKeyError

from ..config import get_settings
from ..deps import CurrentUser, DbDep
from ..ratelimit import enforce
from ..schemas import LoginIn, RegisterIn
from ..security import create_access_token, hash_password, verify_password
from ..util import new_id, now

router = APIRouter(prefix="/api/auth", tags=["auth"])


def public_user(u: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": u["_id"], "name": u["name"], "email": u["email"],
        "roles": u["roles"], "karma_balance": u.get("karma_balance", 0),
        "wallet_balance_minor": u.get("wallet_balance_minor", 0),
    }


@router.post("/register", status_code=201)
async def register(body: RegisterIn, request: Request, db: DbDep) -> dict[str, Any]:
    s = get_settings()
    enforce(request, "auth", s.auth_rate_limit_attempts, s.auth_rate_limit_window_s)
    user = {
        "_id": new_id(), "name": body.name, "email": body.email,
        "password_hash": hash_password(body.password),
        "roles": ["buyer"],  # admin is never self-assignable; seller is granted on store creation
        "is_active": True, "saved_stores": [], "karma_balance": 0,
        "wallet_balance_minor": 0, "created_at": now(),
    }
    try:
        await db.users.insert_one(user)
    except DuplicateKeyError:
        raise HTTPException(409, "Email already registered") from None
    return {"token": create_access_token(str(user["_id"])), "user": public_user(user)}


@router.post("/login")
async def login(body: LoginIn, request: Request, db: DbDep) -> dict[str, Any]:
    s = get_settings()
    enforce(request, "auth", s.auth_rate_limit_attempts, s.auth_rate_limit_window_s)
    user = await db.users.find_one({"email": body.email})
    if (
        not user
        or not user.get("is_active", True)
        or not verify_password(body.password, user["password_hash"])
    ):
        raise HTTPException(401, "Invalid email or password")
    return {"token": create_access_token(str(user["_id"])), "user": public_user(user)}


@router.get("/me")
async def me(user: CurrentUser) -> dict[str, Any]:
    return public_user(user)
