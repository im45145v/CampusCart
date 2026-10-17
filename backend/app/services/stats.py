from datetime import timedelta
from typing import Any

from ..db import Database
from ..util import now, out

ACTIVE_STATUSES = ["placed", "quote_requested", "accepted", "preparing", "ready"]
PREP_PRIORITY = {"preparing": 0, "accepted": 1, "placed": 2, "quote_requested": 3, "ready": 4}


async def pending_orders(db: Database, seller_id: str, limit: int = 20) -> list[dict[str, Any]]:
    cur = db.orders.find({"seller_id": seller_id, "status": {"$in": ACTIVE_STATUSES}}).sort(
        "created_at", 1
    ).limit(limit)
    orders = [out(o) async for o in cur]
    orders.sort(key=lambda o: (PREP_PRIORITY.get(o["status"], 9), o["created_at"]))
    return orders


async def low_stock(db: Database, seller_id: str, threshold: int = 5) -> list[dict[str, Any]]:
    result = []
    async for p in db.products.find({"owner_id": seller_id}):
        if p.get("variants"):
            for v in p["variants"]:
                if v.get("stock") is not None and v["stock"] <= threshold:
                    result.append({"product_id": p["_id"], "title": p["title"],
                                   "variant": v["name"], "stock": v["stock"]})
        elif p.get("stock") is not None and p["stock"] <= threshold:
            result.append({"product_id": p["_id"], "title": p["title"],
                           "variant": None, "stock": p["stock"]})
    return result


async def sales_since(db: Database, seller_id: str, days: int | None) -> dict[str, Any]:
    """Completed-order revenue. `days=None` means calendar day (UTC) of today."""
    t = now()
    start = t.replace(hour=0, minute=0, second=0, microsecond=0)
    if days:
        start = t - timedelta(days=days)
    count = total = 0
    async for o in db.orders.find(
        {"seller_id": seller_id, "status": "completed", "updated_at": {"$gte": start}}
    ):
        count += 1
        total += o["total_minor"]
    return {"orders_completed": count, "revenue_minor": total, "since": start.isoformat()}
