"""Seller membership plans. Buyers pay the first period from the campus wallet.

There is no card charge and no silent auto-renew. A plan only discounts
catalogue-priced orders at that store while the period is still open.
"""

from datetime import timedelta
from typing import Any

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from ..db import Database
from ..schemas import PlanIn
from ..util import new_id, now
from . import wallet


def period_delta(period: str) -> timedelta:
    return timedelta(days=7 if period == "week" else 30)


def active_key(buyer_id: str, store_id: str) -> str:
    return f"{buyer_id}:{store_id}"


async def best_discount(db: Database, buyer_id: str, store_id: str) -> tuple[int, str | None]:
    best_pct = 0
    best_id: str | None = None
    async for sub in db.subscriptions.find({
        "buyer_id": buyer_id, "store_id": store_id, "status": "active",
        "period_end": {"$gt": now()},
    }):
        pct = int(sub.get("discount_percent") or 0)
        if pct > best_pct:
            best_pct = pct
            best_id = str(sub["_id"])
    return best_pct, best_id


async def create_plan(db: Database, store: dict[str, Any], body: PlanIn) -> dict[str, Any]:
    if await db.plans.count_documents({"store_id": store["_id"]}) >= 6:
        raise HTTPException(400, "A store can keep up to 6 plans")
    plan = {
        "_id": new_id(), "store_id": store["_id"], "seller_id": store["owner_id"],
        "store_name": store["name"], **body.model_dump(), "created_at": now(),
    }
    await db.plans.insert_one(plan)
    return plan


async def subscribe(db: Database, buyer: dict[str, Any], plan: dict[str, Any]) -> dict[str, Any]:
    if plan["seller_id"] == buyer["_id"]:
        raise HTTPException(400, "You cannot subscribe to your own store")
    if not plan.get("active", True):
        raise HTTPException(409, "This plan is not open")
    end = now() + period_delta(plan["period"])
    sub = {
        "_id": new_id(), "plan_id": plan["_id"], "store_id": plan["store_id"],
        "seller_id": plan["seller_id"], "buyer_id": buyer["_id"], "buyer_name": buyer["name"],
        "store_name": plan.get("store_name", ""), "title": plan["title"],
        "price_minor": plan["price_minor"], "period": plan["period"],
        "discount_percent": plan["discount_percent"], "status": "active",
        "period_end": end, "active_key": active_key(buyer["_id"], plan["store_id"]),
        "created_at": now(),
    }
    await wallet.debit(
        db, buyer["_id"], int(plan["price_minor"]), "subscription",
        note=plan["title"], related_id=sub["_id"],
    )
    try:
        await db.subscriptions.insert_one(sub)
    except DuplicateKeyError:
        await wallet.credit(
            db, buyer["_id"], int(plan["price_minor"]), "subscription_refund",
            note=plan["title"], related_id=sub["_id"],
        )
        raise HTTPException(409, "You already have an active plan at this store") from None
    return sub


async def renew(db: Database, buyer_id: str, sub: dict[str, Any]) -> dict[str, Any]:
    if sub["buyer_id"] != buyer_id:
        raise HTTPException(404, "Subscription not found")
    if sub["status"] != "active":
        raise HTTPException(409, "Renew a plan from the store page after it ends")
    plan = await db.plans.find_one({"_id": sub["plan_id"]})
    price = int(plan["price_minor"]) if plan else int(sub["price_minor"])
    title = plan["title"] if plan else sub["title"]
    base = sub["period_end"] if sub["period_end"] > now() else now()
    end = base + period_delta(sub["period"])
    await wallet.debit(
        db, buyer_id, price, "subscription_renew", note=title, related_id=sub["_id"],
    )
    await db.subscriptions.update_one(
        {"_id": sub["_id"]},
        {"$set": {"period_end": end, "price_minor": price, "title": title}},
    )
    updated = await db.subscriptions.find_one({"_id": sub["_id"]})
    assert updated is not None
    return updated


async def cancel(db: Database, buyer_id: str, sub: dict[str, Any]) -> dict[str, Any]:
    if sub["buyer_id"] != buyer_id:
        raise HTTPException(404, "Subscription not found")
    res = await db.subscriptions.update_one(
        {"_id": sub["_id"], "status": "active"},
        {"$set": {"status": "cancelled", "cancelled_at": now()}, "$unset": {"active_key": ""}},
    )
    if res.modified_count != 1:
        raise HTTPException(409, "This plan is already cancelled")
    updated = await db.subscriptions.find_one({"_id": sub["_id"]})
    assert updated is not None
    return updated
