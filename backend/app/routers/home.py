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


@router.get("/home")
async def home(db: DbDep) -> dict[str, Any]:
    stores = [
        out(s)
        async for s in db.stores.find({"status": "active"})
        .sort([("rating_avg", -1), ("rating_count", -1), ("created_at", -1)]).limit(6)
    ]
    active = [s["_id"] async for s in db.stores.find({"status": "active"}, {"_id": 1})]
    popular = [
        product_view(p)
        async for p in db.products.find(
            {"published": True, "moderation_status": "active", "store_id": {"$in": active}}
        ).sort([("sold_count", -1), ("created_at", -1)]).limit(8)
    ]
    categories = [
        {"slug": c, "stores": await db.stores.count_documents({"status": "active", "category": c})}
        for c in CATEGORIES
    ]
    return {"categories": categories, "featured_stores": stores, "popular_products": popular}
