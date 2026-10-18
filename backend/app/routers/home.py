from typing import Any

from fastapi import APIRouter

from ..deps import DbDep
from ..util import out
from .products import product_view

router = APIRouter(prefix="/api", tags=["home"])

CATEGORIES = ["food", "printing", "handmade", "goods", "services", "lending"]


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


RAILS = ("food", "printing", "lending")


async def _live(db: Any, flt: dict[str, Any], sort: list[tuple[str, int]], limit: int) -> list[dict[str, Any]]:
    return [product_view(p) async for p in db.products.find(flt).sort(sort).limit(limit)]


@router.get("/home")
async def home(db: DbDep) -> dict[str, Any]:
    stores = [
        out(s)
        async for s in db.stores.find({"status": "active"})
        .sort([("rating_avg", -1), ("rating_count", -1), ("created_at", -1)]).limit(6)
    ]
    active = [s["_id"] async for s in db.stores.find({"status": "active"}, {"_id": 1})]
    visible = {"published": True, "moderation_status": "active", "store_id": {"$in": active}}
    featured = await _live(db, {**visible, "featured": True}, [("created_at", -1)], 8)
    featured_ids = [p["id"] for p in featured]
    latest = await _live(
        db, {**visible, "_id": {"$nin": featured_ids}}, [("created_at", -1)], 8,
    )
    popular = await _live(db, visible, [("sold_count", -1), ("created_at", -1)], 8)
    categories = [
        {"slug": c, "stores": await db.stores.count_documents({"status": "active", "category": c})}
        for c in CATEGORIES
    ]
    rails = []
    for slug in RAILS:
        ids = [s["_id"] async for s in db.stores.find({"status": "active", "category": slug}, {"_id": 1})]
        products = await _live(db, {**visible, "store_id": {"$in": ids}}, [("sold_count", -1), ("created_at", -1)], 4)
        if products:
            rails.append({"slug": slug, "products": products})
    return {
        "categories": categories,
        "featured_stores": stores,
        "featured_products": featured,
        "latest_products": latest,
        "popular_products": popular,
        "category_rails": rails,
    }
