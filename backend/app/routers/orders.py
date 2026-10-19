from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ..deps import CurrentUser, DbDep, SellerUser
from ..schemas import OrderIn, QuoteIn, StatusIn
from ..services import notifications
from ..services import orders as svc
from ..services.live import push_order
from ..util import now, out

router = APIRouter(prefix="/api", tags=["orders"])


async def _load(db: Any, order_id: str, user: dict[str, Any]) -> tuple[dict[str, Any], str]:
    o = await db.orders.find_one({"_id": order_id})
    if o:
        if o["buyer_id"] == user["_id"]:
            return o, "buyer"
        if o["seller_id"] == user["_id"]:
            return o, "seller"
        if "admin" in user.get("roles", []):
            return o, "admin"
    raise HTTPException(404, "Order not found")  # do not reveal existence to outsiders


@router.post("/orders", status_code=201)
async def place_order(body: OrderIn, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    return out(await svc.create_order(db, user, body))


@router.get("/orders")
async def my_orders(
    user: CurrentUser, db: DbDep, limit: int = Query(50, ge=1, le=100)
) -> list[dict[str, Any]]:
    cur = db.orders.find({"buyer_id": user["_id"]}).sort("created_at", -1).limit(limit)
    return [out(o) async for o in cur]


@router.get("/seller/orders")
async def seller_orders(
    user: SellerUser, db: DbDep, status: str | None = None, limit: int = Query(50, ge=1, le=100)
) -> list[dict[str, Any]]:
    flt: dict[str, Any] = {"seller_id": user["_id"], "payment_status": {"$ne": "awaiting_upi"}}
    if status:
        flt["status"] = status
    cur = db.orders.find(flt).sort("created_at", -1).limit(limit)
    return [out(o) async for o in cur]


@router.get("/orders/{order_id}")
async def get_order(order_id: str, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    o, _ = await _load(db, order_id, user)
    return out(o)


@router.post("/orders/{order_id}/status")
async def update_status(
    order_id: str, body: StatusIn, user: CurrentUser, db: DbDep
) -> dict[str, Any]:
    o, role = await _load(db, order_id, user)
    if role == "admin":
        raise HTTPException(403, "Administrators cannot change order status")
    return out(await svc.change_status(db, o, user, role, body.status, body.reason))


@router.post("/orders/{order_id}/quote")
async def quote(order_id: str, body: QuoteIn, user: SellerUser, db: DbDep) -> dict[str, Any]:
    o, role = await _load(db, order_id, user)
    if role != "seller":
        raise HTTPException(403, "Only the seller can quote")
    if o["status"] not in ("quote_requested", "quoted"):
        raise HTTPException(409, "Order does not need a quote")
    res = await db.orders.update_one(
        {"_id": order_id, "status": o["status"]},
        {"$set": {"status": "quoted", "total_minor": body.total_minor,
                  "quote_note": body.note, "updated_at": now()},
         "$push": {"history": {"status": "quoted", "by": user["_id"], "at": now(),
                               "reason": body.note}}},
    )
    if res.modified_count != 1:
        raise HTTPException(409, "Order was modified concurrently")
    updated = await db.orders.find_one({"_id": order_id})
    assert updated is not None
    await push_order(updated)
    await notifications.notify(
        db, updated["buyer_id"], "order", "Quote ready",
        f"{updated.get('store_name', 'The store')} quoted {body.total_minor / 100:.2f}",
        f"/orders/{order_id}", order_id,
    )
    return out(updated)


@router.post("/orders/{order_id}/confirm-payment")
async def confirm_payment(order_id: str, user: SellerUser, db: DbDep) -> dict[str, Any]:
    """Seller manually confirms they received payment. UniCart does not verify payments."""
    o, role = await _load(db, order_id, user)
    if role != "seller":
        raise HTTPException(403, "Only the seller can confirm payment")
    if o["status"] in ("rejected", "cancelled"):
        raise HTTPException(409, "Order is closed")
    if o.get("payment_status") == "awaiting_upi":
        raise HTTPException(409, "This order is waiting for the UPI payment")
    if o.get("payment_status") == "wallet_paid":
        raise HTTPException(409, "This order was already paid from the campus wallet")
    await db.orders.update_one(
        {"_id": order_id, "payment_status": {"$ne": "wallet_paid"}},
        {"$set": {"payment_status": "confirmed_by_seller", "updated_at": now()}},
    )
    updated = await db.orders.find_one({"_id": order_id})
    assert updated is not None
    await push_order(updated)
    await notifications.notify(
        db, updated["buyer_id"], "order", "Payment noted",
        f"{updated.get('store_name', 'The seller')} confirmed they received payment. This is not a bank check.",
        f"/orders/{order_id}", order_id,
    )
    return out(updated)
