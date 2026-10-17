from collections import OrderedDict
from datetime import timedelta
from typing import Any

from fastapi import HTTPException

from ..db import Database
from ..schemas import OrderIn, OrderSettings
from ..util import new_id, now

TERMINAL = {"completed", "rejected", "cancelled"}
QUEUE_STATUSES = ["placed", "accepted", "preparing"]
SLOT_FREE_STATUSES = ["rejected", "cancelled"]

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


def store_settings(store: dict[str, Any]) -> OrderSettings:
    return OrderSettings.model_validate(store.get("order_settings") or {})


def store_local_now(cfg: OrderSettings) -> Any:
    return now() + timedelta(minutes=cfg.utc_offset_min)


async def _slot_count(db: Database, store_id: str, date: str, label: str) -> int:
    return int(await db.orders.count_documents({
        "store_id": store_id, "pickup_slot.date": date, "pickup_slot.label": label,
        "status": {"$nin": SLOT_FREE_STATUSES},
    }))


async def queue_wait_min(db: Database, store: dict[str, Any], cfg: OrderSettings) -> int:
    if not cfg.queue_min_per_order:
        return cfg.lead_time_min
    active = await db.orders.count_documents({"store_id": store["_id"], "status": {"$in": QUEUE_STATUSES}})
    return cfg.lead_time_min + cfg.queue_min_per_order * int(active)


async def order_options(db: Database, store: dict[str, Any]) -> dict[str, Any]:
    """What a buyer may choose at checkout for this store, including live slot availability."""
    cfg = store_settings(store)
    local = store_local_now(cfg)
    days: list[dict[str, Any]] = []
    if cfg.slots_enabled:
        dates = [(local.date() + timedelta(days=i)).isoformat() for i in range(cfg.slot_days_ahead + 1)]
        used: dict[tuple[str, str], int] = {}
        async for o in db.orders.find(
            {"store_id": store["_id"], "pickup_slot.date": {"$in": dates},
             "status": {"$nin": SLOT_FREE_STATUSES}},
            {"pickup_slot": 1},
        ):
            k = (o["pickup_slot"]["date"], o["pickup_slot"]["label"])
            used[k] = used.get(k, 0) + 1
        hhmm = local.strftime("%H:%M")
        for d in dates:
            slots = []
            for label in cfg.slots:
                past = d == dates[0] and label[6:] <= hhmm
                left = None if not cfg.slot_capacity else max(cfg.slot_capacity - used.get((d, label), 0), 0)
                slots.append({"label": label, "remaining": left, "available": not past and left != 0})
            days.append({"date": d, "slots": slots})
    return {
        **cfg.model_dump(), "days": days, "is_open": store.get("is_open", True),
        "current_wait_min": await queue_wait_min(db, store, cfg),
    }


def _check_slot(cfg: OrderSettings, body: OrderIn) -> dict[str, str] | None:
    if not cfg.slots_enabled:
        if body.pickup_slot:
            raise HTTPException(422, "This store does not use time slots")
        return None
    if not body.pickup_slot:
        if cfg.slot_required:
            raise HTTPException(422, "Choose a pickup time slot")
        return None
    local = store_local_now(cfg)
    date, label = body.pickup_slot.date, body.pickup_slot.label
    if label not in cfg.slots:
        raise HTTPException(422, "Unknown time slot")
    if not local.date() <= date <= local.date() + timedelta(days=cfg.slot_days_ahead):
        raise HTTPException(422, "That day is not available for this store")
    if date == local.date() and label[6:] <= local.strftime("%H:%M"):
        raise HTTPException(409, "That time slot has already passed")
    return {"date": date.isoformat(), "label": label}


def _check_answers(cfg: OrderSettings, answers: dict[str, str]) -> list[dict[str, str]]:
    known = {f.id: f for f in cfg.custom_fields}
    if set(answers) - set(known):
        raise HTTPException(422, "Unknown order question")
    result: list[dict[str, str]] = []
    for f in cfg.custom_fields:
        v = answers.get(f.id, "").strip()
        if f.type == "checkbox":
            v = "yes" if v.lower() in ("yes", "true", "1") else ""
        elif f.type == "select" and v and v not in f.options:
            raise HTTPException(422, f"Invalid choice for {f.label}")
        if f.required and not v:
            raise HTTPException(422, f"{f.label} is required")
        if v:
            result.append({"id": f.id, "label": f.label, "value": v})
    return result


async def create_order(db: Database, buyer: dict[str, Any], body: OrderIn) -> dict[str, Any]:
    store = await db.stores.find_one({"_id": body.store_id, "status": "active"})
    if not store:
        raise HTTPException(404, "Store not found")
    if store["owner_id"] == buyer["_id"]:
        raise HTTPException(400, "You cannot order from your own store")
    if not store.get("is_open", True):
        raise HTTPException(409, "Store is currently closed")

    cfg = store_settings(store)
    if body.fulfillment not in cfg.fulfillment_options:
        raise HTTPException(422, "This store does not offer that fulfilment option")
    if body.payment_method not in cfg.payment_options:
        raise HTTPException(422, "This store does not accept that payment option")
    slot = _check_slot(cfg, body)
    answers = _check_answers(cfg, body.answers)

    merged: OrderedDict[tuple[str, str | None], int] = OrderedDict()
    for it in body.items:
        key = (it.product_id, it.variant_id)
        merged[key] = merged.get(key, 0) + it.quantity

    lines: list[dict[str, Any]] = []
    needs_quote = False
    prep_min = 0
    for (pid, vid), qty in merged.items():
        if qty > cfg.max_qty_per_item:
            raise HTTPException(422, f"This store allows at most {cfg.max_qty_per_item} of each item")
        p = await db.products.find_one(
            {"_id": pid, "store_id": store["_id"], "published": True, "moderation_status": "active"}
        )
        if not p or not p.get("available"):
            raise HTTPException(409, f"Item {pid} is not available")
        prep_min = max(prep_min, int(p.get("prep_time_min") or 0))
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

    estimated = sum(x["line_total_minor"] for x in lines)
    if not needs_quote and estimated < cfg.min_order_minor:
        raise HTTPException(422, f"Minimum order for this store is {cfg.min_order_minor / 100:.2f}")
    wait_min = await queue_wait_min(db, store, cfg) + prep_min

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
        "total_minor": 0 if needs_quote else estimated,
        "estimated_minor": estimated,
        "fulfillment": body.fulfillment, "payment_method": body.payment_method,
        "pickup_slot": slot, "answers": answers, "est_wait_min": wait_min,
        "payment_status": "unpaid", "note": body.note, "request_details": body.request_details,
        "file_urls": body.file_urls, "status": status, "stock_reserved": bool(reserved),
        "history": [{"status": status, "by": buyer["_id"], "at": now(), "reason": ""}],
        "created_at": now(), "updated_at": now(),
    }
    try:
        await db.orders.insert_one(order)
        # Re-count after insert so two simultaneous buyers cannot both take the last place.
        if slot and cfg.slot_capacity and await _slot_count(
            db, store["_id"], slot["date"], slot["label"]
        ) > cfg.slot_capacity:
            await db.orders.delete_one({"_id": order["_id"]})
            raise HTTPException(409, "That time slot just filled up, pick another")
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
