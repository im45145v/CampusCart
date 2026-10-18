from datetime import timedelta
from typing import Any

from ..db import Database
from ..util import now, out

ACTIVE_STATUSES = ["placed", "quote_requested", "accepted", "preparing", "ready"]
PREP_PRIORITY = {"preparing": 0, "accepted": 1, "placed": 2, "quote_requested": 3, "ready": 4}


async def pending_orders(db: Database, seller_id: str, limit: int = 20) -> list[dict[str, Any]]:
    cur = db.orders.find({"seller_id": seller_id, "status": {"$in": ACTIVE_STATUSES}})
    orders = [out(o) async for o in cur]
    orders.sort(key=lambda o: (PREP_PRIORITY.get(o["status"], 9), o["created_at"]))
    return orders[:limit]


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


async def seller_charts(db: Database, seller_id: str) -> dict[str, Any]:
    """14 calendar days of completed revenue, plus a live status mix. Computed in Python so it stays correct on the test database."""
    start = (now() - timedelta(days=13)).replace(hour=0, minute=0, second=0, microsecond=0)
    days: dict[str, dict[str, Any]] = {}
    for i in range(14):
        key = (start + timedelta(days=i)).date().isoformat()
        days[key] = {"date": key, "revenue_minor": 0, "orders": 0}
    by_status: dict[str, int] = {}
    async for o in db.orders.find({"seller_id": seller_id}):
        by_status[o["status"]] = by_status.get(o["status"], 0) + 1
        if o["status"] != "completed":
            continue
        ts = o.get("updated_at") or o.get("created_at")
        key = ts.date().isoformat() if hasattr(ts, "date") else str(ts)[:10]
        if key in days:
            days[key]["revenue_minor"] += int(o.get("total_minor") or 0)
            days[key]["orders"] += 1
    return {"days": list(days.values()), "by_status": by_status}
