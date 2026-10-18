from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ..deps import CurrentUser, DbDep, SellerUser
from ..schemas import NotificationReadIn
from ..security import generate_api_token, hash_api_token
from ..services import stats
from ..util import new_id, now, out

router = APIRouter(prefix="/api", tags=["me"])


@router.get("/me/saved-stores")
async def saved_stores(user: CurrentUser, db: DbDep) -> list[dict[str, Any]]:
    ids = user.get("saved_stores", [])
    return [out(s) async for s in db.stores.find({"_id": {"$in": ids}, "status": "active"})]


@router.put("/me/saved-stores/{store_id}", status_code=204)
async def save_store(store_id: str, user: CurrentUser, db: DbDep) -> None:
    if not await db.stores.find_one({"_id": store_id, "status": "active"}):
        raise HTTPException(404, "Store not found")
    await db.users.update_one({"_id": user["_id"]}, {"$addToSet": {"saved_stores": store_id}})


@router.delete("/me/saved-stores/{store_id}", status_code=204)
async def unsave_store(store_id: str, user: CurrentUser, db: DbDep) -> None:
    await db.users.update_one({"_id": user["_id"]}, {"$pull": {"saved_stores": store_id}})


@router.get("/seller/summary")
async def seller_summary(user: SellerUser, db: DbDep) -> dict[str, Any]:
    by_status: dict[str, int] = {}
    async for o in db.orders.find({"seller_id": user["_id"]}, {"status": 1}):
        by_status[o["status"]] = by_status.get(o["status"], 0) + 1
    return {
        "orders_by_status": by_status,
        "today": await stats.sales_since(db, user["_id"], None),
        "last_30_days": await stats.sales_since(db, user["_id"], 30),
        "low_stock": await stats.low_stock(db, user["_id"]),
    }


@router.get("/seller/charts")
async def seller_charts(user: SellerUser, db: DbDep) -> dict[str, Any]:
    return await stats.seller_charts(db, user["_id"])


@router.post("/seller/api-tokens", status_code=201)
async def create_api_token(user: SellerUser, db: DbDep) -> dict[str, Any]:
    """Create a read-only token for the UNO Q assistant. The raw token is shown once."""
    if await db.api_tokens.count_documents({"user_id": user["_id"], "revoked": False}) >= 5:
        raise HTTPException(400, "Token limit reached; revoke one first")
    token = generate_api_token()
    rec = {"_id": new_id(), "user_id": user["_id"], "token_hash": hash_api_token(token),
           "scope": "seller:read", "revoked": False, "created_at": now()}
    await db.api_tokens.insert_one(rec)
    return {"id": rec["_id"], "token": token, "scope": rec["scope"]}


@router.get("/seller/api-tokens")
async def list_api_tokens(user: SellerUser, db: DbDep) -> list[dict[str, Any]]:
    cur = db.api_tokens.find({"user_id": user["_id"], "revoked": False}, {"token_hash": 0})
    return [out(t) async for t in cur]


@router.get("/me/notifications")
async def list_notifications(
    user: CurrentUser, db: DbDep, limit: int = Query(30, ge=1, le=50)
) -> dict[str, Any]:
    cur = db.notifications.find({"user_id": user["_id"]}).sort("created_at", -1).limit(limit)
    items = [out(n) async for n in cur]
    unread = await db.notifications.count_documents({"user_id": user["_id"], "read": False})
    return {"unread": unread, "items": items}


@router.post("/me/notifications/read")
async def read_notifications(body: NotificationReadIn, user: CurrentUser, db: DbDep) -> dict[str, int]:
    flt: dict[str, Any] = {"user_id": user["_id"], "read": False}
    if not body.mark_all:
        flt["_id"] = {"$in": body.ids}
    res = await db.notifications.update_many(flt, {"$set": {"read": True}})
    return {"updated": res.modified_count}


@router.delete("/seller/api-tokens/{token_id}", status_code=204)
async def revoke_api_token(token_id: str, user: SellerUser, db: DbDep) -> None:
    await db.api_tokens.update_one(
        {"_id": token_id, "user_id": user["_id"]}, {"$set": {"revoked": True}}
    )
