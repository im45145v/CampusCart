from typing import Any

from fastapi import APIRouter, HTTPException

from ..deps import AdminUser, CurrentUser, DbDep, OptionalUser
from ..schemas import VoucherIn, VoucherPatch, VoucherPreviewIn
from ..services import orders as order_svc
from ..services import subscriptions, vouchers
from .stores import can_manage, get_store_or_404

router = APIRouter(prefix="/api", tags=["vouchers"])


@router.get("/stores/{store_id}/vouchers")
async def list_vouchers(
    store_id: str, db: DbDep, user: OptionalUser = None, include_paused: bool = False
) -> list[dict[str, Any]]:
    store = await get_store_or_404(db, store_id)
    manager = can_manage(user, store)
    if store["status"] != "active" and not manager:
        raise HTTPException(404, "Store not found")
    if include_paused:
        if not user or store["owner_id"] != user["_id"]:
            raise HTTPException(403, "Not your store")
        cur = db.vouchers.find({"store_id": store_id}).sort("created_at", -1)
        return [vouchers.present(doc, True) async for doc in cur]
    found: list[dict[str, Any]] = []
    query = {"active": True, "$or": [{"store_id": store_id}, {"store_id": None}]}
    async for doc in db.vouchers.find(query).sort("created_at", -1):
        if vouchers.is_current(doc):
            found.append(vouchers.present(doc, False))
    return found


@router.post("/stores/{store_id}/vouchers", status_code=201)
async def create_store_voucher(
    store_id: str, body: VoucherIn, user: CurrentUser, db: DbDep
) -> dict[str, Any]:
    store = await get_store_or_404(db, store_id)
    if store["owner_id"] != user["_id"]:
        raise HTTPException(403, "Not your store")
    return vouchers.present(await vouchers.create_voucher(db, user["_id"], store_id, body), True)


@router.patch("/vouchers/{voucher_id}")
async def pause_voucher(
    voucher_id: str, body: VoucherPatch, user: CurrentUser, db: DbDep
) -> dict[str, Any]:
    voucher = await db.vouchers.find_one({"_id": voucher_id})
    if not voucher:
        raise HTTPException(404, "Code not found")
    admin = "admin" in user.get("roles", [])
    if voucher.get("store_id") is None and not admin:
        raise HTTPException(403, "Campus codes are managed by the desk")
    if voucher.get("owner_id") != user["_id"] and not admin:
        raise HTTPException(403, "Not your code")
    return vouchers.present(await vouchers.set_active(db, voucher_id, body.active, user["_id"]), True)


@router.post("/vouchers/preview")
async def preview(body: VoucherPreviewIn, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    store = await db.stores.find_one({"_id": body.store_id, "status": "active"})
    if not store:
        raise HTTPException(404, "Store not found")
    if store["owner_id"] == user["_id"]:
        raise HTTPException(400, "You cannot order from your own store")
    lines, needs_quote, _prep = await order_svc.build_order_lines(db, store, body.items)
    catalogue = sum(line["line_total_minor"] for line in lines if not line.get("print"))
    estimated = sum(line["line_total_minor"] for line in lines)
    membership = 0
    if not needs_quote and catalogue > 0:
        pct, _sub = await subscriptions.best_discount(db, user["_id"], store["_id"])
        membership = catalogue * pct // 100
    offer = await vouchers.evaluate(
        db, user, store["_id"], lines, needs_quote, body.payment_method, body.code, membership,
    )
    assert offer is not None
    return vouchers.quote_view(
        offer["code"], offer["title"], vouchers.summary(offer["voucher"]),
        estimated, membership, int(offer["discount_minor"]),
    )


@router.get("/admin/vouchers")
async def admin_vouchers(_: AdminUser, db: DbDep) -> list[dict[str, Any]]:
    cur = db.vouchers.find({"store_id": None}).sort("created_at", -1).limit(50)
    return [vouchers.present(doc, True) async for doc in cur]


@router.post("/admin/vouchers", status_code=201)
async def admin_create(body: VoucherIn, admin: AdminUser, db: DbDep) -> dict[str, Any]:
    return vouchers.present(await vouchers.create_voucher(db, admin["_id"], None, body), True)
