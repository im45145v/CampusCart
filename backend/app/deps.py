from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .db import Database, get_db
from .security import decode_access_token, hash_api_token

bearer = HTTPBearer(auto_error=False)

DbDep = Annotated[Database, Depends(get_db)]
User = dict[str, Any]


async def user_from_token(db: Database, token: str) -> User | None:
    uid = decode_access_token(token)
    if not uid:
        return None
    user = await db.users.find_one({"_id": uid})
    if not user or not user.get("is_active", True):
        return None
    return user


async def current_user(
    db: DbDep, creds: HTTPAuthorizationCredentials | None = Depends(bearer)
) -> User:
    if not creds:
        raise HTTPException(401, "Not authenticated")
    user = await user_from_token(db, creds.credentials)
    if not user:
        raise HTTPException(401, "Invalid or expired token")
    return user


async def optional_user(
    db: DbDep, creds: HTTPAuthorizationCredentials | None = Depends(bearer)
) -> User | None:
    if not creds:
        return None
    return await user_from_token(db, creds.credentials)


def require_role(role: str):  # type: ignore[no-untyped-def]
    async def dep(user: User = Depends(current_user)) -> User:
        if role not in user.get("roles", []):
            raise HTTPException(403, f"{role} role required")
        return user

    return dep


CurrentUser = Annotated[User, Depends(current_user)]
OptionalUser = Annotated[User | None, Depends(optional_user)]
SellerUser = Annotated[User, Depends(require_role("seller"))]
AdminUser = Annotated[User, Depends(require_role("admin"))]


async def edge_seller(request: Request, db: DbDep) -> User:
    """Authenticate a scoped read-only seller API token (used by the UNO Q service)."""
    auth = request.headers.get("authorization", "")
    token = auth[7:] if auth.lower().startswith("bearer ") else ""
    if not token.startswith("cc_"):
        raise HTTPException(401, "API token required")
    rec = await db.api_tokens.find_one({"token_hash": hash_api_token(token), "revoked": False})
    if not rec:
        raise HTTPException(401, "Invalid API token")
    user = await db.users.find_one({"_id": rec["user_id"]})
    if not user or not user.get("is_active", True) or "seller" not in user.get("roles", []):
        raise HTTPException(403, "Seller account required")
    return user


EdgeSeller = Annotated[User, Depends(edge_seller)]
