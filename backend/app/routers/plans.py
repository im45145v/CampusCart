from typing import Any

from fastapi import APIRouter, HTTPException

from ..deps import CurrentUser, DbDep, OptionalUser
from ..schemas import PlanIn, PlanPatch
from ..services import subscriptions as svc
from ..util import out
from .stores import can_manage, get_store_or_404

router = APIRouter(prefix="/api", tags=["plans"])


@router.get("/stores/{store_id}/plans")
async def list_plans(store_id: str, db: DbDep, user: OptionalUser = None) -> list[dict[str, Any]]:
    store = await get_store_or_404(db, store_id)
    if store["status"] != "active" and not can_manage(user, store):
        raise HTTPException(404, "Store not found")
    flt: dict[str, Any] = {"store_id": store_id}
    if not can_manage(user, store):
        flt["active"] = True
    return [out(p) async for p in db.plans.find(flt).sort("created_at", -1)]


@router.post("/stores/{store_id}/plans", status_code=201)
async def create_plan(store_id: str, body: PlanIn, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    store = await get_store_or_404(db, store_id)
    if store["owner_id"] != user["_id"]:
        raise HTTPException(403, "Not your store")
    return out(await svc.create_plan(db, store, body))


@router.patch("/plans/{plan_id}")
async def patch_plan(plan_id: str, body: PlanPatch, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    plan = await db.plans.find_one({"_id": plan_id, "seller_id": user["_id"]})
    if not plan:
        raise HTTPException(404, "Plan not found")
    changes = body.model_dump(exclude_unset=True)
    if changes:
        await db.plans.update_one({"_id": plan_id}, {"$set": changes})
    return out(await db.plans.find_one({"_id": plan_id}))


@router.get("/stores/{store_id}/subscribers")
async def subscribers(store_id: str, user: CurrentUser, db: DbDep) -> list[dict[str, Any]]:
    store = await get_store_or_404(db, store_id)
    if store["owner_id"] != user["_id"]:
        raise HTTPException(403, "Not your store")
    cur = db.subscriptions.find({"store_id": store_id}).sort("created_at", -1).limit(100)
    return [out(s) async for s in cur]


@router.get("/me/subscriptions")
async def my_subscriptions(user: CurrentUser, db: DbDep) -> list[dict[str, Any]]:
    cur = db.subscriptions.find({"buyer_id": user["_id"]}).sort("created_at", -1).limit(50)
    return [out(s) async for s in cur]


@router.post("/plans/{plan_id}/subscribe", status_code=201)
async def subscribe(plan_id: str, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    plan = await db.plans.find_one({"_id": plan_id})
    if not plan:
        raise HTTPException(404, "Plan not found")
    return out(await svc.subscribe(db, user, plan))


@router.post("/subscriptions/{sub_id}/renew")
async def renew(sub_id: str, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    sub = await db.subscriptions.find_one({"_id": sub_id, "buyer_id": user["_id"]})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    return out(await svc.renew(db, user["_id"], sub))


@router.post("/subscriptions/{sub_id}/cancel")
async def cancel(sub_id: str, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    sub = await db.subscriptions.find_one({"_id": sub_id, "buyer_id": user["_id"]})
    if not sub:
        raise HTTPException(404, "Subscription not found")
    return out(await svc.cancel(db, user["_id"], sub))
