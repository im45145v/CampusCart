from collections import OrderedDict
from typing import Any

from fastapi import HTTPException

from ..db import Database
from ..schemas import OrderIn
from ..util import new_id, now

TERMINAL = {"completed", "rejected", "cancelled"}

# Allowed transitions per actor role. Anything else is rejected by the server.
TRANSITIONS: dict[str, dict[str, set[str]]] = {
    "buyer": {
        "placed": {"cancelled"},
        "quote_requested": {"cancelled"},
        "quoted": {"accepted", "cancelled"},  # buyer approves the seller's manual quote
        "accepted": {"cancelled"},
    },
    "seller": {
        "placed": {"accepted", "rejected"},
        "quote_requested": {"rejected"},
        "quoted": {"rejected"},
        "accepted": {"preparing", "cancelled"},
        "preparing": {"ready", "cancelled"},
        "ready": {"completed", "cancelled"},
    },
}


def check_transition(role: str, current: str, target: str) -> None:
    if target not in TRANSITIONS.get(role, {}).get(current, set()):
        raise HTTPException(409, f"{role} cannot move order from {current} to {target}")


async def _reserve(db: Database, line: dict[str, Any]) -> bool:
    """Atomically take stock; the $gte guard in the filter prevents overselling."""
    qty = line["quantity"]
    if line.get("variant_id"):
        res = await db.products.update_one(
            {"_id": line["product_id"],
             "variants": {"$elemMatch": {"id": line["variant_id"], "stock": {"$gte": qty}}}},
            {"$inc": {"variants.$.stock": -qty}},
        )
    else:
        res = await db.products.update_one(
            {"_id": line["product_id"], "stock": {"$gte": qty}}, {"$inc": {"stock": -qty}}
        )
    return bool(res.modified_count == 1)


async def _restore(db: Database, line: dict[str, Any]) -> None:
    qty = line["quantity"]
    if line.get("variant_id"):
        await db.products.update_one(
            {"_id": line["product_id"], "variants.id": line["variant_id"]},
            {"$inc": {"variants.$.stock": qty}},
        )
    else:
        await db.products.update_one({"_id": line["product_id"]}, {"$inc": {"stock": qty}})


async def release_stock(db: Database, order: dict[str, Any]) -> None:
    """Return reserved stock exactly once (guarded by the stock_reserved flag)."""
    res = await db.orders.update_one(
        {"_id": order["_id"], "stock_reserved": True}, {"$set": {"stock_reserved": False}}
    )
    if res.modified_count == 1:
        for line in order["items"]:
            if line["tracked"]:
                await _restore(db, line)


async def create_order(db: Database, buyer: dict[str, Any], body: OrderIn) -> dict[str, Any]:
    store = await db.stores.find_one({"_id": body.store_id, "status": "active"})
    if not store:
        raise HTTPException(404, "Store not found")
    if store["owner_id"] == buyer["_id"]:
        raise HTTPException(400, "You cannot order from your own store")
    if not store.get("is_open", True):
        raise HTTPException(409, "Store is currently closed")

    merged: OrderedDict[tuple[str, str | None], int] = OrderedDict()
    for it in body.items:
        key = (it.product_id, it.variant_id)
        merged[key] = merged.get(key, 0) + it.quantity

    lines: list[dict[str, Any]] = []
    needs_quote = False
    for (pid, vid), qty in merged.items():
        if qty > 99:
            raise HTTPException(422, "Quantity too large")
        p = await db.products.find_one(
            {"_id": pid, "store_id": store["_id"], "published": True, "moderation_status": "active"}
        )
        if not p or not p.get("available"):
            raise HTTPException(409, f"Item {pid} is not available")
        variants = p.get("variants") or []
        if variants:
            v = next((x for x in variants if x["id"] == vid), None)
            if not v:
                raise HTTPException(422, "Variant required or invalid")
            price, name, stock = v["price_minor"], v["name"], v.get("stock")
        else:
            if vid:
                raise HTTPException(422, "Invalid variant")
            price, name, stock = p["price_minor"], None, p.get("stock")
        if p["kind"] == "printing":
            needs_quote = True
        lines.append({
            "product_id": pid, "variant_id": vid, "title": p["title"], "variant_name": name,
            "unit_price_minor": price, "quantity": qty, "line_total_minor": price * qty,
            "tracked": stock is not None,
        })

    reserved: list[dict[str, Any]] = []
    for line in lines:
        if not line["tracked"]:
            continue
        if await _reserve(db, line):
            reserved.append(line)
        else:
            for r in reserved:
                await _restore(db, r)
            raise HTTPException(409, f"Not enough stock for {line['title']}")

    status = "quote_requested" if needs_quote else "placed"
    order = {
        "_id": new_id(), "buyer_id": buyer["_id"], "buyer_name": buyer["name"],
        "seller_id": store["owner_id"], "store_id": store["_id"], "store_name": store["name"],
        "items": lines,
        "total_minor": 0 if needs_quote else sum(x["line_total_minor"] for x in lines),
        "estimated_minor": sum(x["line_total_minor"] for x in lines),
        "fulfillment": body.fulfillment, "payment_method": body.payment_method,
        "payment_status": "unpaid", "note": body.note, "request_details": body.request_details,
        "file_urls": body.file_urls, "status": status, "stock_reserved": bool(reserved),
        "history": [{"status": status, "by": buyer["_id"], "at": now(), "reason": ""}],
        "created_at": now(), "updated_at": now(),
    }
    try:
        await db.orders.insert_one(order)
    except Exception:
        for r in reserved:
            await _restore(db, r)
        raise
    return order


async def change_status(
    db: Database, order: dict[str, Any], actor: dict[str, Any], role: str, target: str, reason: str
) -> dict[str, Any]:
    current = order["status"]
    check_transition(role, current, target)
    res = await db.orders.update_one(
        {"_id": order["_id"], "status": current},
        {"$set": {"status": target, "updated_at": now()},
         "$push": {"history": {"status": target, "by": actor["_id"], "at": now(), "reason": reason}}},
    )
    if res.modified_count != 1:
        raise HTTPException(409, "Order was modified concurrently, reload and retry")
    if target in {"cancelled", "rejected"}:
        await release_stock(db, order)
    if target == "completed":
        for line in order["items"]:
            await db.products.update_one(
                {"_id": line["product_id"]}, {"$inc": {"sold_count": line["quantity"]}}
            )
    updated = await db.orders.find_one({"_id": order["_id"]})
    assert updated is not None
    return updated  # type: ignore[no-any-return]
