from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ..deps import DbDep, EdgeSeller
from ..services import stats
from ..util import contains_regex, out
from .products import product_view

# Narrow read-only tools for the UNO Q assistant, authenticated by scoped API tokens.
router = APIRouter(prefix="/api/edge", tags=["edge"])


def _brief(o: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": o["id"], "status": o["status"], "created_at": o["created_at"],
        "buyer_name": o.get("buyer_name"), "total_minor": o["total_minor"],
        "fulfillment": o["fulfillment"], "payment_status": o["payment_status"],
        "items": [
            {"title": i["title"], "variant": i.get("variant_name"), "quantity": i["quantity"]}
            for i in o["items"]
        ],
    }


@router.get("/pending-orders")
async def pending_orders(seller: EdgeSeller, db: DbDep) -> list[dict[str, Any]]:
    return [_brief(o) for o in await stats.pending_orders(db, seller["_id"])]


@router.get("/orders/{order_id}/summary")
async def order_summary(order_id: str, seller: EdgeSeller, db: DbDep) -> dict[str, Any]:
    o = await db.orders.find_one({"_id": order_id, "seller_id": seller["_id"]})
    if not o:
        raise HTTPException(404, "Order not found")
    d = _brief(out(o))
    d["note"] = o.get("note", "")
    return d


@router.get("/low-stock")
async def low_stock(
    seller: EdgeSeller, db: DbDep, threshold: int = Query(5, ge=0, le=1000)
) -> list[dict[str, Any]]:
    return await stats.low_stock(db, seller["_id"], threshold)


@router.get("/today-sales")
async def today_sales(seller: EdgeSeller, db: DbDep) -> dict[str, Any]:
    return await stats.sales_since(db, seller["_id"], None)


@router.get("/products/availability")
async def product_availability(
    seller: EdgeSeller, db: DbDep, q: str = Query(min_length=1, max_length=80)
) -> list[dict[str, Any]]:
    cur = db.products.find({"owner_id": seller["_id"], "title": contains_regex(q)}).limit(10)
    result = []
    async for doc in cur:
        p = product_view(doc)
        result.append({"product_id": p["id"], "title": p["title"], "in_stock": p["in_stock"],
                       "stock": p.get("stock"), "published": p["published"]})
    return result
