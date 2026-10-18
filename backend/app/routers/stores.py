from typing import Any

from fastapi import APIRouter, HTTPException, Query
from pydantic import ValidationError

from ..deps import CurrentUser, DbDep, OptionalUser
from ..schemas import OrderSettings, StoreCategory, StoreIn, StorePatch
from ..services.orders import order_options
from ..util import contains_regex, new_id, now, out

router = APIRouter(prefix="/api", tags=["stores"])

MAX_STORES_PER_USER = 5


async def get_store_or_404(db: Any, store_id: str) -> dict[str, Any]:
    s = await db.stores.find_one({"_id": store_id})
    if not s:
        raise HTTPException(404, "Store not found")
    return s  # type: ignore[no-any-return]


def can_manage(user: dict[str, Any] | None, store: dict[str, Any]) -> bool:
    if not user:
        return False
    return bool(store["owner_id"] == user["_id"] or "admin" in user.get("roles", []))


@router.post("/stores", status_code=201)
async def create_store(body: StoreIn, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    if await db.stores.count_documents({"owner_id": user["_id"]}) >= MAX_STORES_PER_USER:
        raise HTTPException(400, "Store limit reached")
    store = {
        "_id": new_id(), "owner_id": user["_id"], **body.model_dump(),
        "status": "pending", "rating_avg": 0.0, "rating_count": 0,
        "rating_hist": {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}, "created_at": now(),
    }
    await db.stores.insert_one(store)
    await db.users.update_one({"_id": user["_id"]}, {"$addToSet": {"roles": "seller"}})
    return out(store)


@router.get("/stores")
async def list_stores(
    db: DbDep,
    q: str | None = None,
    category: StoreCategory | None = None,
    open_now: bool | None = None,
    sort: str = Query("rating", pattern="^(rating|new)$"),
    limit: int = Query(30, ge=1, le=100),
    skip: int = Query(0, ge=0, le=10_000),
) -> list[dict[str, Any]]:
    flt: dict[str, Any] = {"status": "active"}
    if q:
        flt["$or"] = [{"name": contains_regex(q)}, {"description": contains_regex(q)}]
    if category:
        flt["category"] = category
    if open_now is not None:
        flt["is_open"] = open_now
    order = [("rating_avg", -1), ("rating_count", -1)] if sort == "rating" else [("created_at", -1)]
    cur = db.stores.find(flt).sort(order).skip(skip).limit(limit)
    return [out(s) async for s in cur]


@router.get("/stores/mine")
async def my_stores(user: CurrentUser, db: DbDep) -> list[dict[str, Any]]:
    return [out(s) async for s in db.stores.find({"owner_id": user["_id"]})]


@router.get("/stores/{store_id}")
async def get_store(store_id: str, db: DbDep, user: OptionalUser = None) -> dict[str, Any]:
    s = await get_store_or_404(db, store_id)
    if s["status"] != "active" and not can_manage(user, s):
        raise HTTPException(404, "Store not found")
    return out(s)


@router.get("/stores/{store_id}/order-options")
async def store_order_options(store_id: str, db: DbDep) -> dict[str, Any]:
    s = await get_store_or_404(db, store_id)
    if s["status"] != "active":
        raise HTTPException(404, "Store not found")
    return await order_options(db, s)


@router.patch("/stores/{store_id}")
async def update_store(
    store_id: str, body: StorePatch, user: CurrentUser, db: DbDep
) -> dict[str, Any]:
    s = await get_store_or_404(db, store_id)
    if s["owner_id"] != user["_id"]:
        raise HTTPException(403, "Not your store")
    nullable = {"banner_url", "logo_url"}  # explicit null clears the image
    changes = {
        k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None or k in nullable
    }
    for key in ("theme", "order_settings"):  # partial nested patches keep the stored values
        if key in changes:
            changes[key] = {**(s.get(key) or {}), **changes[key]}
            if key == "order_settings":
                try:
                    OrderSettings.model_validate(changes[key])
                except ValidationError as e:
                    raise HTTPException(422, e.errors()[0]["msg"]) from None
    if changes:
        await db.stores.update_one({"_id": store_id}, {"$set": changes})
    return out(await get_store_or_404(db, store_id))


@router.post("/stores/{store_id}/resubmit")
async def resubmit_store(store_id: str, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    """Send a rejected application back to the admin queue."""
    s = await get_store_or_404(db, store_id)
    if s["owner_id"] != user["_id"]:
        raise HTTPException(403, "Not your store")
    if s["status"] != "rejected":
        raise HTTPException(409, "Only a rejected store can be submitted again")
    await db.stores.update_one(
        {"_id": store_id, "status": "rejected"},
        {"$set": {"status": "pending", "review_reason": None}},
    )
    return out(await get_store_or_404(db, store_id))
