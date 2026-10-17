from typing import Any

from fastapi import APIRouter, HTTPException
from pymongo.errors import DuplicateKeyError

from ..deps import CurrentUser, DbDep
from ..schemas import ReviewIn
from ..util import new_id, now, out

router = APIRouter(prefix="/api", tags=["reviews"])


@router.post("/orders/{order_id}/review", status_code=201)
async def create_review(
    order_id: str, body: ReviewIn, user: CurrentUser, db: DbDep
) -> dict[str, Any]:
    order = await db.orders.find_one({"_id": order_id, "buyer_id": user["_id"]})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["status"] != "completed":
        raise HTTPException(409, "Only completed orders can be reviewed")
    review = {
        "_id": new_id(), "order_id": order_id, "store_id": order["store_id"],
        "buyer_id": user["_id"], "buyer_name": user["name"], "rating": body.rating,
        "comment": body.comment, "created_at": now(),
    }
    try:
        await db.reviews.insert_one(review)  # unique index on order_id blocks duplicates
    except DuplicateKeyError:
        raise HTTPException(409, "This purchase was already reviewed") from None
    agg = await db.reviews.aggregate(
        [{"$match": {"store_id": order["store_id"]}},
         {"$group": {"_id": None, "avg": {"$avg": "$rating"}, "n": {"$sum": 1}}}]
    ).to_list(1)
    if agg:
        await db.stores.update_one(
            {"_id": order["store_id"]},
            {"$set": {"rating_avg": round(agg[0]["avg"], 2), "rating_count": agg[0]["n"]}},
        )
    return out(review)


@router.get("/stores/{store_id}/reviews")
async def store_reviews(store_id: str, db: DbDep) -> list[dict[str, Any]]:
    cur = db.reviews.find({"store_id": store_id}, {"buyer_id": 0}).sort("created_at", -1).limit(50)
    return [out(r) async for r in cur]
