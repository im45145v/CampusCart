import math
from collections import OrderedDict
from datetime import datetime, time, timedelta
from typing import Any

from fastapi import HTTPException

from ..db import Database
from ..schemas import AddonPick, OrderIn, OrderSettings
from ..util import new_id, now
from . import notifications, printing, subscriptions, vouchers, wallet
from .live import push_order

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
        elif f.type == "date" and v:
            try:
                datetime.strptime(v, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(422, f"{f.label} must be a date") from None
        if f.required and not v:
            raise HTTPException(422, f"{f.label} is required")
        if v:
            result.append({"id": f.id, "label": f.label, "value": v})
    return result


def _priced_addons(product: dict[str, Any], picks: list[AddonPick]) -> tuple[list[dict[str, Any]], int]:
    catalog = {a["id"]: a for a in product.get("addons") or []}
    if picks and not catalog:
        raise HTTPException(422, "This item has no extras")
    chosen: list[dict[str, Any]] = []
    per_unit = 0
    for pick in picks:
        addon = catalog.get(pick.id)
        if not addon:
            raise HTTPException(422, "Unknown extra")
        if pick.quantity > int(addon.get("max_qty") or 1):
            raise HTTPException(422, f"At most {addon['max_qty']} × {addon['name']}")
        chosen.append({
            "id": addon["id"], "name": addon["name"],
            "price_minor": addon["price_minor"], "quantity": pick.quantity,
        })
        per_unit += int(addon["price_minor"]) * pick.quantity
    return chosen, per_unit


def _order_files(extra: list[str], lines: list[dict[str, Any]]) -> list[str]:
    urls: list[str] = []
    for line in lines:
        printed = line.get("print") or {}
        if printed.get("file_url"):
            urls.append(printed["file_url"])
    for url in extra:
        if url not in urls:
            urls.append(url)
    return urls[:5]


def borrow_units(
    product: dict[str, Any],
    collect_on: Any,
    return_on: Any,
    slot_label: str | None,
    return_time: str | None,
) -> int:
    """Days or hours between collect and return, capped by the listing."""
    unit = product.get("rate_unit")
    if unit not in ("day", "hour"):
        return 1
    title = str(product.get("title") or "This item")
    if collect_on is None or return_on is None:
        raise HTTPException(422, f"Choose the day you collect {title} and the day you bring it back")
    cap = int(product["max_units"]) if product.get("max_units") else None
    if unit == "day":
        span = (return_on - collect_on).days
        if span < 0:
            raise HTTPException(422, f"Bring {title} back on or after the day you collect it")
        units = max(1, span)
        if cap and units > cap:
            raise HTTPException(422, f"{title} can be borrowed for at most {cap} days")
        return units
    if not slot_label or not return_time:
        raise HTTPException(422, f"Choose a handover time and the time you will bring {title} back")
    start = datetime.combine(collect_on, time.fromisoformat(slot_label[:5]))
    end = datetime.combine(return_on, time.fromisoformat(return_time))
    if end <= start:
        raise HTTPException(422, f"Bring {title} back after you collect it")
    units = max(1, math.ceil((end - start).total_seconds() / 3600))
    if cap and units > cap:
        raise HTTPException(422, f"{title} can be borrowed for at most {cap} hours")
    return units


async def build_order_lines(
    db: Database, store: dict[str, Any], items: list[Any],
    *, collect_on: Any = None, return_on: Any = None, return_time: str | None = None, slot_label: str | None = None,
) -> tuple[list[dict[str, Any]], bool, int]:
    cfg = store_settings(store)
    merged: OrderedDict[tuple[Any, ...], int] = OrderedDict()
    singles: list[Any] = []
    for it in items:
        if it.print_job:
            if it.quantity != 1 or it.addons:
                raise HTTPException(422, "Set copies on the print job. Print jobs do not take food extras.")
            singles.append(it)
            continue
        if len({a.id for a in it.addons}) != len(it.addons):
            raise HTTPException(422, "Choose each extra once")
        signature = tuple(sorted((a.id, a.quantity) for a in it.addons))
        key = (it.product_id, it.variant_id, signature)
        merged[key] = merged.get(key, 0) + it.quantity

    lines: list[dict[str, Any]] = []
    needs_quote = False
    prep_min = 0

    async def load_product(pid: str) -> dict[str, Any]:
        p = await db.products.find_one(
            {"_id": pid, "store_id": store["_id"], "published": True, "moderation_status": "active"}
        )
        if not p or not p.get("available"):
            raise HTTPException(409, f"Item {pid} is not available")
        return p

    def base_price(p: dict[str, Any], vid: str | None) -> tuple[int, str | None, Any]:
        variants = p.get("variants") or []
        if variants:
            v = next((x for x in variants if x["id"] == vid), None)
            if not v:
                raise HTTPException(422, "Variant required or invalid")
            return v["price_minor"], v["name"], v.get("stock")
        if vid:
            raise HTTPException(422, "Invalid variant")
        return p["price_minor"], None, p.get("stock")

    for (pid, vid, signature), qty in merged.items():
        if qty > cfg.max_qty_per_item:
            raise HTTPException(422, f"This store allows at most {cfg.max_qty_per_item} of each item")
        p = await load_product(pid)
        prep_min = max(prep_min, int(p.get("prep_time_min") or 0))
        if p["kind"] == "printing" and p.get("print_spec"):
            raise HTTPException(422, "Upload a file and choose the print settings")
        if p["kind"] == "printing":
            needs_quote = True
        price, name, stock = base_price(p, vid)
        units = borrow_units(p, collect_on, return_on, slot_label, return_time)
        chosen, addons_minor = _priced_addons(p, [AddonPick(id=i, quantity=q) for i, q in signature])
        lines.append({
            "product_id": pid, "variant_id": vid, "title": p["title"], "variant_name": name,
            "unit_price_minor": price, "quantity": qty, "addons": chosen, "addons_minor": addons_minor,
            "billed_units": units, "rate_unit": p.get("rate_unit"),
            "line_total_minor": (price * units + addons_minor) * qty, "tracked": stock is not None, "print": None,
            "listing_type": p.get("listing_type") or "new",
            "category": p.get("category") or "", "kind": p.get("kind") or "product",
        })

    for it in singles:
        p = await load_product(it.product_id)
        prep_min = max(prep_min, int(p.get("prep_time_min") or 0))
        price, name, stock = base_price(p, it.variant_id)
        spec = p.get("print_spec")
        job_in = it.print_job
        if p["kind"] != "printing" or not spec or job_in is None:
            raise HTTPException(422, "That item is not a priced print job")
        inspected = printing.inspect_upload(job_in.file_url)
        job = printing.price_job(spec, job_in.model_dump(), inspected["pages"])
        lines.append({
            "product_id": it.product_id, "variant_id": it.variant_id, "title": p["title"],
            "variant_name": name, "unit_price_minor": job["total_minor"], "quantity": 1,
            "addons": [], "addons_minor": 0, "line_total_minor": job["total_minor"],
            "tracked": stock is not None, "print": job,
            "listing_type": p.get("listing_type") or "new",
            "category": p.get("category") or "", "kind": p.get("kind") or "printing",
        })
    return lines, needs_quote, prep_min


def _seller_alert(order: dict[str, Any], buyer_name: str, store_name: str) -> tuple[str, str, str]:
    """Title, body, and link the seller sees. A print job names the packet and the spec."""
    jobs = [item["print"] for item in order.get("items") or [] if item.get("print")]
    if not jobs:
        borrowed = _borrow_alert(order, buyer_name)
        if borrowed:
            return borrowed
        return "New order", f"{buyer_name} ordered from {store_name}", f"/orders/{order['_id']}"
    packet = next(
        (
            str(answer.get("value") or "").strip()
            for answer in order.get("answers") or []
            if answer.get("id") == "packet" or "packet" in str(answer.get("label") or "").lower()
        ),
        "",
    )
    specs: list[str] = []
    for job in jobs:
        colour = "colour" if job.get("color") == "color" else "black and white"
        urgent = ", urgent" if job.get("urgent") else ""
        specs.append(
            f"{int(job.get('copies') or 0)} copies, {int(job.get('pages') or 0)} pages, "
            f"{colour}, {job.get('paper') or 'paper'}{urgent}"
        )
    body = f"Packet: {packet}. " if packet else ""
    return "Print job", body + " ".join(specs), "/seller?tab=Orders"


def _borrow_alert(order: dict[str, Any], buyer_name: str) -> tuple[str, str, str] | None:
    """A lend line is a person handing over their own thing, not a sale."""
    titles = [str(item.get("title") or "item") for item in order.get("items") or [] if item.get("listing_type") == "lend"]
    if not titles:
        return None
    due = next(
        (
            str(answer.get("value") or "").strip()
            for answer in order.get("answers") or []
            if answer.get("id") == "return_by"
        ),
        "",
    )
    due_bit = f" Back by {due}." if due else ""
    return "Borrow request", f"{buyer_name} wants {', '.join(titles)}.{due_bit}", "/seller?tab=Orders"


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
    collect_on = body.pickup_slot.date if body.pickup_slot else body.collect_on
    if body.return_on and not any(a["id"] == "return_by" for a in answers):
        due = body.return_on.isoformat()
        if body.return_time:
            due = f"{due} {body.return_time}"
        answers.append({"id": "return_by", "label": "Bring it back on", "value": due})
    lines, needs_quote, prep_min = await build_order_lines(
        db, store, body.items,
        collect_on=collect_on, return_on=body.return_on, return_time=body.return_time,
        slot_label=body.pickup_slot.label if body.pickup_slot else None,
    )

    catalogue = sum(x["line_total_minor"] for x in lines if not x.get("print"))
    printed = sum(x["line_total_minor"] for x in lines if x.get("print"))
    estimated = catalogue + printed
    if not needs_quote and estimated < cfg.min_order_minor:
        raise HTTPException(422, f"Minimum order for this store is {cfg.min_order_minor / 100:.2f}")
    discount_minor = 0
    subscription_id = None
    if not needs_quote and catalogue > 0:
        pct, subscription_id = await subscriptions.best_discount(db, buyer["_id"], store["_id"])
        discount_minor = catalogue * pct // 100
    offer = await vouchers.evaluate(
        db, buyer, store["_id"], lines, needs_quote, body.payment_method, body.voucher_code, discount_minor,
    )
    voucher_discount = int(offer["discount_minor"]) if offer else 0
    payable = 0 if needs_quote else estimated - discount_minor - voucher_discount
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
            raise HTTPException(409, f"Not enough left of {line['title']}. Someone else took the last ones.")

    status = "quote_requested" if needs_quote else "placed"
    order = {
        "_id": new_id(), "buyer_id": buyer["_id"], "buyer_name": buyer["name"],
        "seller_id": store["owner_id"], "store_id": store["_id"], "store_name": store["name"],
        "items": lines,
        "total_minor": payable,
        "estimated_minor": estimated, "discount_minor": discount_minor,
        "subscription_id": subscription_id,
        "voucher_code": offer["code"] if offer else None,
        "voucher_title": offer["title"] if offer else None,
        "voucher_discount_minor": voucher_discount,
        "fulfillment": body.fulfillment, "payment_method": body.payment_method,
        "pickup_slot": slot, "answers": answers, "est_wait_min": wait_min,
        "payment_status": "unpaid", "wallet_charged_minor": 0,
        "wallet_refunded": False, "seller_credited": False,
        "note": body.note, "request_details": body.request_details,
        "file_urls": _order_files(body.file_urls, lines), "status": status, "stock_reserved": bool(reserved),
        "history": [{"status": status, "by": buyer["_id"], "at": now(), "reason": ""}],
        "created_at": now(), "updated_at": now(),
    }
    charged_amount = 0
    held = False
    try:
        if offer:
            await vouchers.hold(
                db, offer["voucher"], buyer["_id"], order["_id"], store["_id"], voucher_discount,
            )
            held = True
        if body.payment_method == "campus_wallet" and not needs_quote:
            if payable > 0:
                await wallet.debit(
                    db, buyer["_id"], payable, "order_payment",
                    note=store["name"], related_id=order["_id"],
                )
                charged_amount = payable
            order["wallet_charged_minor"] = payable
            order["payment_status"] = "wallet_paid"
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
        if held:
            await vouchers.release(db, order["_id"])
        if charged_amount:
            await wallet.credit(
                db, buyer["_id"], charged_amount, "order_refund",
                note=store["name"], related_id=order["_id"],
            )
        raise
    await push_order(order)
    title, message, href = _seller_alert(order, buyer["name"], store["name"])
    await notifications.notify(
        db, store["owner_id"], "order", title, message, href, order["_id"],
    )
    return order


async def change_status(
    db: Database, order: dict[str, Any], actor: dict[str, Any], role: str, target: str, reason: str
) -> dict[str, Any]:
    current = order["status"]
    check_transition(role, current, target)
    charged_now = 0
    if (
        target == "accepted"
        and order.get("payment_method") == "campus_wallet"
        and int(order.get("wallet_charged_minor") or 0) == 0
    ):
        charged_now = int(order.get("total_minor") or 0)
        if charged_now > 0:
            await wallet.debit(
                db, order["buyer_id"], charged_now, "order_payment",
                note=order.get("store_name", ""), related_id=order["_id"],
            )
    sets: dict[str, Any] = {"status": target, "updated_at": now()}
    if charged_now:
        sets["wallet_charged_minor"] = charged_now
        sets["payment_status"] = "wallet_paid"
    res = await db.orders.update_one(
        {"_id": order["_id"], "status": current},
        {"$set": sets,
         "$push": {"history": {"status": target, "by": actor["_id"], "at": now(), "reason": reason}}},
    )
    if res.modified_count != 1:
        if charged_now:
            await wallet.credit(
                db, order["buyer_id"], charged_now, "order_refund",
                note=order.get("store_name", ""), related_id=order["_id"],
            )
        raise HTTPException(409, "Order was modified concurrently, reload and retry")
    if target in {"cancelled", "rejected"}:
        await release_stock(db, order)
        await _refund_wallet(db, order, charged_now)
        await vouchers.release(db, order["_id"])
    if target == "completed":
        for line in order["items"]:
            await db.products.update_one(
                {"_id": line["product_id"]}, {"$inc": {"sold_count": line["quantity"]}}
            )
        # A borrow holds the piece until the owner marks it returned. A sale stays sold.
        if order.get("stock_reserved") and any(
            line.get("listing_type") == "lend" and line.get("tracked") for line in order["items"]
        ):
            cleared = await db.orders.update_one(
                {"_id": order["_id"], "stock_reserved": True},
                {"$set": {"stock_reserved": False}},
            )
            if cleared.modified_count == 1:
                for line in order["items"]:
                    if line.get("listing_type") == "lend" and line.get("tracked"):
                        await _restore(db, line)
        await _credit_seller(db, order, charged_now)
    updated = await db.orders.find_one({"_id": order["_id"]})
    assert updated is not None
    await push_order(updated)
    if actor["_id"] == updated["buyer_id"]:
        await notifications.notify(
            db, updated["seller_id"], "order", "Order update",
            f"{updated['buyer_name']} set an order to {target}",
            f"/orders/{updated['_id']}", updated["_id"],
        )
    else:
        await notifications.notify(
            db, updated["buyer_id"], "order", "Order update",
            f"{updated.get('store_name', 'The store')} set your order to {target}",
            f"/orders/{updated['_id']}", updated["_id"],
        )
    return updated  # type: ignore[no-any-return]


async def _refund_wallet(db: Database, order: dict[str, Any], charged_now: int) -> None:
    amount = int(order.get("wallet_charged_minor") or 0) or charged_now
    if amount <= 0 or order.get("wallet_refunded"):
        return
    res = await db.orders.update_one(
        {"_id": order["_id"], "wallet_refunded": {"$ne": True}},
        {"$set": {"wallet_refunded": True}},
    )
    if res.modified_count == 1:
        await wallet.credit(
            db, order["buyer_id"], amount, "order_refund",
            note=order.get("store_name", ""), related_id=order["_id"],
        )


async def _credit_seller(db: Database, order: dict[str, Any], charged_now: int) -> None:
    amount = int(order.get("wallet_charged_minor") or 0) or charged_now
    if amount <= 0 or order.get("wallet_refunded"):
        return
    res = await db.orders.update_one(
        {"_id": order["_id"], "seller_credited": {"$ne": True}, "wallet_refunded": {"$ne": True}},
        {"$set": {"seller_credited": True}},
    )
    if res.modified_count == 1:
        await wallet.credit(
            db, order["seller_id"], amount, "order_earning",
            note=order.get("store_name", ""), related_id=order["_id"],
        )
