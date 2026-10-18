from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ..deps import CurrentUser, DbDep, OptionalUser
from ..schemas import ListingType, PrintJobIn, ProductIn, ProductPatch
from ..services import printing
from ..util import contains_regex, new_id, now, out
from .stores import can_manage, get_store_or_404

router = APIRouter(prefix="/api", tags=["products"])


def product_view(p: dict[str, Any]) -> dict[str, Any]:
    d = out(p)
    variants = d.get("variants") or []
    stocks = [v.get("stock") for v in variants] if variants else [d.get("stock")]
    unlimited = any(s is None for s in stocks)
    d["in_stock"] = bool(d.get("available")) and (unlimited or any((s or 0) > 0 for s in stocks))
    if variants:
        d["price_from_minor"] = min(v["price_minor"] for v in variants)
    else:
        d["price_from_minor"] = d["price_minor"]
    d["featured"] = bool(d.get("featured"))
    d["addons"] = d.get("addons") or []
    spec = d.get("print_spec")
    if spec:
        d["price_from_minor"] = min(spec["bw_per_page_minor"], spec["color_per_page_minor"])
    return d


def _with_ids(items: list[Any]) -> list[dict[str, Any]]:
    result = []
    seen: set[str] = set()
    for raw in items:
        item = raw.model_dump() if hasattr(raw, "model_dump") else dict(raw)
        item["id"] = item.get("id") or new_id()
        if item["id"] in seen:
            raise HTTPException(422, "Duplicate option id")
        seen.add(item["id"])
        result.append(item)
    return result


def _prepare_variants(variants: list[Any]) -> list[dict[str, Any]]:
    return _with_ids(variants)


FEATURED_PER_STORE = 3


async def _cap_featured(db: Any, store_id: str, product_id: str | None, featured: bool) -> None:
    if not featured:
        return
    query: dict[str, Any] = {"store_id": store_id, "featured": True}
    if product_id:
        query["_id"] = {"$ne": product_id}
    if await db.products.count_documents(query) >= FEATURED_PER_STORE:
        raise HTTPException(422, "A stall can feature 3 listings. Take one off the home page first.")


def _prepare_spec(spec: Any) -> dict[str, Any] | None:
    if spec is None:
        return None
    data = spec.model_dump() if hasattr(spec, "model_dump") else dict(spec)
    data["papers"] = _with_ids(data["papers"])
    data["bindings"] = _with_ids(data["bindings"])
    return data


def _check_listing(kind: str, addons: list[Any], spec: Any) -> None:
    if kind == "printing" and addons:
        raise HTTPException(422, "Print listings use a rate card, not food extras")
    if spec is not None and kind != "printing":
        raise HTTPException(422, "Only printing listings have a rate card")


async def _owned_product(db: Any, product_id: str, user: dict[str, Any]) -> dict[str, Any]:
    p = await db.products.find_one({"_id": product_id})
    if not p:
        raise HTTPException(404, "Product not found")
    if p["owner_id"] != user["_id"]:
        raise HTTPException(403, "Not your listing")
    return p  # type: ignore[no-any-return]


@router.post("/stores/{store_id}/products", status_code=201)
async def create_product(
    store_id: str, body: ProductIn, user: CurrentUser, db: DbDep
) -> dict[str, Any]:
    store = await get_store_or_404(db, store_id)
    if store["owner_id"] != user["_id"]:
        raise HTTPException(403, "Not your store")
    _check_listing(body.kind, body.addons, body.print_spec)
    data = body.model_dump()
    data["variants"] = _prepare_variants(body.variants)
    data["addons"] = _with_ids(body.addons)
    data["print_spec"] = _prepare_spec(body.print_spec)
    if body.kind == "printing":
        data["stock"] = None
    await _cap_featured(db, store_id, None, bool(data.get("featured")))
    p = {
        "_id": new_id(), "store_id": store_id, "owner_id": user["_id"], **data,
        "published": False,  # listings are always created as drafts
        "moderation_status": "active", "sold_count": 0,
        "created_at": now(), "updated_at": now(),
    }
    await db.products.insert_one(p)
    return product_view(p)


@router.get("/products")
async def search_products(
    db: DbDep,
    q: str | None = None,
    category: str | None = None,
    store_id: str | None = None,
    listing_type: ListingType | None = None,
    min_price: int | None = Query(None, ge=0),
    max_price: int | None = Query(None, ge=0),
    in_stock: bool | None = None,
    sort: str = Query("popular", pattern="^(popular|price_asc|price_desc|new)$"),
    limit: int = Query(30, ge=1, le=100),
    skip: int = Query(0, ge=0, le=10_000),
) -> list[dict[str, Any]]:
    active_stores = [s["_id"] async for s in db.stores.find({"status": "active"}, {"_id": 1})]
    flt: dict[str, Any] = {
        "published": True, "moderation_status": "active", "store_id": {"$in": active_stores},
    }
    if store_id:
        flt["store_id"] = store_id if store_id in active_stores else "-"
    if q:
        flt["$or"] = [{"title": contains_regex(q)}, {"description": contains_regex(q)}]
    if category:
        flt["category"] = category
    if listing_type:
        flt["listing_type"] = listing_type
    price: dict[str, Any] = {}
    if min_price is not None:
        price["$gte"] = min_price
    if max_price is not None:
        price["$lte"] = max_price
    if price:
        flt["price_minor"] = price
    order = {
        "popular": [("sold_count", -1), ("created_at", -1)],
        "price_asc": [("price_minor", 1)],
        "price_desc": [("price_minor", -1)],
        "new": [("created_at", -1)],
    }[sort]
    items = [product_view(p) async for p in db.products.find(flt).sort(order).skip(skip).limit(limit)]
    if in_stock is not None:
        items = [p for p in items if p["in_stock"] == in_stock]
    return items


@router.get("/stores/{store_id}/products")
async def store_products(
    store_id: str, db: DbDep, user: OptionalUser = None, include_drafts: bool = False
) -> list[dict[str, Any]]:
    store = await get_store_or_404(db, store_id)
    manage = can_manage(user, store)
    if store["status"] != "active" and not manage:
        raise HTTPException(404, "Store not found")
    flt: dict[str, Any] = {"store_id": store_id}
    if not (manage and include_drafts):
        flt.update({"published": True, "moderation_status": "active"})
    return [product_view(p) async for p in db.products.find(flt).sort("created_at", -1)]


@router.get("/products/{product_id}")
async def get_product(product_id: str, db: DbDep, user: OptionalUser = None) -> dict[str, Any]:
    p = await db.products.find_one({"_id": product_id})
    if not p:
        raise HTTPException(404, "Product not found")
    store = await get_store_or_404(db, p["store_id"])
    visible = p["published"] and p["moderation_status"] == "active" and store["status"] == "active"
    if not visible and not can_manage(user, store):
        raise HTTPException(404, "Product not found")
    return product_view(p)


@router.post("/products/{product_id}/print-preview")
async def print_preview(product_id: str, body: PrintJobIn, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    """Price a file with this listing's rate card. The same function prices the order."""
    del user
    p = await db.products.find_one({"_id": product_id, "published": True, "moderation_status": "active"})
    if not p or not p.get("print_spec"):
        raise HTTPException(404, "Print listing not found")
    store = await get_store_or_404(db, p["store_id"])
    if store["status"] != "active":
        raise HTTPException(404, "Print listing not found")
    inspected = printing.inspect_upload(body.file_url)
    return printing.price_job(p["print_spec"], body.model_dump(), inspected["pages"])


@router.patch("/products/{product_id}")
async def update_product(
    product_id: str, body: ProductPatch, user: CurrentUser, db: DbDep
) -> dict[str, Any]:
    changes = body.model_dump(exclude_unset=True)
    current = await _owned_product(db, product_id, user)
    if "variants" in changes and body.variants is not None:
        changes["variants"] = _prepare_variants(body.variants)
    if "addons" in changes and body.addons is not None:
        changes["addons"] = _with_ids(body.addons)
    if "print_spec" in changes:
        changes["print_spec"] = _prepare_spec(body.print_spec)
    kind = changes.get("kind") or current["kind"]
    addons = changes["addons"] if "addons" in changes else current.get("addons") or []
    spec = changes["print_spec"] if "print_spec" in changes else current.get("print_spec")
    _check_listing(kind, addons, spec)
    if "featured" in changes:
        await _cap_featured(db, current["store_id"], product_id, bool(changes["featured"]))
    for required in ("title", "price_minor", "kind", "listing_type", "category", "available",
                     "description", "variants", "image_urls", "prep_time_min"):
        if required in changes and changes[required] is None:
            changes.pop(required)
    changes["updated_at"] = now()
    await db.products.update_one({"_id": product_id}, {"$set": changes})
    return product_view(await db.products.find_one({"_id": product_id}))  # type: ignore[arg-type]


async def _set_published(db: Any, product_id: str, user: dict[str, Any], value: bool) -> dict[str, Any]:
    p = await _owned_product(db, product_id, user)
    if value and p["moderation_status"] != "active":
        raise HTTPException(409, "Listing was removed by moderators")
    await db.products.update_one({"_id": product_id}, {"$set": {"published": value}})
    return product_view(await db.products.find_one({"_id": product_id}))  # type: ignore[arg-type]


@router.post("/products/{product_id}/publish")
async def publish(product_id: str, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    return await _set_published(db, product_id, user, True)


@router.post("/products/{product_id}/unpublish")
async def unpublish(product_id: str, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    return await _set_published(db, product_id, user, False)
