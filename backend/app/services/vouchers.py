"""Promo codes. The server decides the discount; the client never sends an amount.

A code reduces what the student pays and what the store receives. UniCart does not
reimburse the difference. Cancel or reject releases the redemption so a limited code,
including a first-order code, can be used again.
"""
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException
from pymongo.errors import DuplicateKeyError

from ..audit import record
from ..db import Database
from ..schemas import VoucherIn
from ..util import new_id, now, out

OPEN_ORDER = {"placed", "quote_requested", "quoted", "accepted", "preparing", "ready", "completed"}
AUDIENCE_LABEL = {
    "anyone": "anyone",
    "first_order": "first campus order",
    "first_store_order": "first order at this store",
    "new_account": "new account",
}


def normalize_code(code: str) -> str:
    return code.strip().upper()


def is_current(doc: dict[str, Any]) -> bool:
    if not doc.get("active", True):
        return False
    moment = now()
    starts, ends = doc.get("starts_at"), doc.get("ends_at")
    if isinstance(starts, datetime) and moment < _aware(starts):
        return False
    if isinstance(ends, datetime) and moment > _aware(ends):
        return False
    return True


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def _rupees(minor: int) -> str:
    return f"{minor / 100:.2f}"


def summary(doc: dict[str, Any]) -> str:
    if doc["kind"] == "percent":
        parts = [f"{doc['percent']}% off"]
        if doc.get("max_discount_minor"):
            parts[0] += f", up to ₹{_rupees(int(doc['max_discount_minor']))}"
    else:
        parts = [f"₹{_rupees(int(doc['amount_minor']))} off"]
    parts.append(AUDIENCE_LABEL[doc["audience"]])
    if doc["audience"] == "new_account":
        parts[-1] = f"accounts up to {doc['new_account_days']} days old"
    if int(doc.get("min_subtotal_minor") or 0):
        parts.append(f"orders from ₹{_rupees(int(doc['min_subtotal_minor']))}")
    if int(doc.get("min_items") or 1) > 1:
        parts.append(f"at least {doc['min_items']} items")
    if doc.get("categories"):
        parts.append("only " + ", ".join(doc["categories"]))
    if doc.get("kinds"):
        parts.append("only " + ", ".join(doc["kinds"]))
    parts.append("priced print jobs included" if doc.get("applies_to") == "priced" else "not priced print jobs")
    if doc.get("payment_methods"):
        parts.append("pay with " + ", ".join(doc["payment_methods"]))
    return " · ".join(parts)


def present(doc: dict[str, Any], private: bool) -> dict[str, Any]:
    view = out(doc)
    view["summary"] = summary(doc)
    if not private:
        for key in ("redeemed", "owner_id", "per_user", "max_redemptions"):
            view.pop(key, None)
    return view


def _matches(line: dict[str, Any], voucher: dict[str, Any]) -> bool:
    if voucher.get("applies_to") != "priced" and line.get("print"):
        return False
    categories = voucher.get("categories") or []
    kinds = voucher.get("kinds") or []
    if categories and (line.get("category") or "") not in categories:
        return False
    if kinds and (line.get("kind") or "") not in kinds:
        return False
    return True


def _discount_amount(voucher: dict[str, Any], base: int) -> int:
    if base <= 0:
        return 0
    if voucher["kind"] == "percent":
        amount = base * int(voucher["percent"]) // 100
        cap = voucher.get("max_discount_minor")
        if cap:
            amount = min(amount, int(cap))
    else:
        amount = min(int(voucher["amount_minor"]), base)
    return max(0, amount)


async def _require_code(db: Database, code: str, store_id: str) -> dict[str, Any]:
    cleaned = normalize_code(code)
    if not cleaned:
        raise HTTPException(422, "Enter a code")
    voucher = await db.vouchers.find_one({"code": cleaned})
    if not voucher or not voucher.get("active", True):
        raise HTTPException(422, "That code is not active")
    if voucher.get("store_id") not in (None, store_id):
        raise HTTPException(422, "That code is for a different store")
    moment = now()
    starts = voucher.get("starts_at")
    ends = voucher.get("ends_at")
    if starts and moment < _aware(starts):
        raise HTTPException(422, "That code is not open yet")
    if ends and moment > _aware(ends):
        raise HTTPException(422, "That code has expired")
    return voucher


async def _audience(db: Database, voucher: dict[str, Any], buyer: dict[str, Any], store_id: str) -> None:
    audience = voucher.get("audience") or "anyone"
    if audience == "anyone":
        return
    if audience == "new_account":
        created = buyer.get("created_at")
        if not isinstance(created, datetime):
            raise HTTPException(422, "This code is for new accounts")
        age = now() - _aware(created)
        if age > timedelta(days=int(voucher.get("new_account_days") or 14)):
            raise HTTPException(422, "This code is only for new accounts")
        return
    query: dict[str, Any] = {"buyer_id": buyer["_id"], "status": {"$in": list(OPEN_ORDER)}}
    if audience == "first_store_order":
        query["store_id"] = store_id
    if await db.orders.count_documents(query):
        message = "This code is for your first order at this store" if audience == "first_store_order" else "This code is for your first campus order"
        raise HTTPException(422, message)


def eligible_base(
    voucher: dict[str, Any], lines: list[dict[str, Any]], membership_discount: int
) -> tuple[int, int]:
    """Return (pre-discount eligible subtotal, base left after the membership share)."""
    catalogue = sum(int(line["line_total_minor"]) for line in lines if not line.get("print"))
    matching = [line for line in lines if _matches(line, voucher)]
    eligible_catalogue = sum(int(line["line_total_minor"]) for line in matching if not line.get("print"))
    eligible_print = sum(int(line["line_total_minor"]) for line in matching if line.get("print"))
    after = catalogue - membership_discount
    share = eligible_catalogue * after // catalogue if catalogue else 0
    return eligible_catalogue + eligible_print, share + eligible_print


async def evaluate(
    db: Database, buyer: dict[str, Any], store_id: str, lines: list[dict[str, Any]],
    needs_quote: bool, payment_method: str, code: str, membership_discount: int,
) -> dict[str, Any] | None:
    if not code.strip():
        return None
    if needs_quote:
        raise HTTPException(422, "Codes apply once the price is known. This order still needs a seller quote.")
    voucher = await _require_code(db, code, store_id)
    methods = voucher.get("payment_methods") or []
    if methods and payment_method not in methods:
        raise HTTPException(422, "This code does not cover that payment option")
    await _audience(db, voucher, buyer, store_id)
    subtotal, base = eligible_base(voucher, lines, membership_discount)
    if subtotal <= 0:
        raise HTTPException(422, "This code does not cover anything in the cart")
    if subtotal < int(voucher.get("min_subtotal_minor") or 0):
        raise HTTPException(422, f"Add more to use this code. Minimum is ₹{_rupees(int(voucher['min_subtotal_minor']))}")
    units = sum(int(line["quantity"]) for line in lines if _matches(line, voucher))
    if units < int(voucher.get("min_items") or 1):
        raise HTTPException(422, f"This code needs at least {voucher['min_items']} covered items")
    discount = _discount_amount(voucher, base)
    if discount <= 0:
        raise HTTPException(422, "This code does not reduce this order")
    use_key = f"{voucher['_id']}:{buyer['_id']}"
    used = await db.voucher_uses.find_one({"_id": use_key})
    if used and int(used.get("count") or 0) >= int(voucher.get("per_user") or 1):
        raise HTTPException(422, "You have already used this code")
    cap = voucher.get("max_redemptions")
    if cap is not None and int(voucher.get("redeemed") or 0) >= int(cap):
        raise HTTPException(422, "This code has been used up")
    return {
        "voucher": voucher, "discount_minor": discount, "code": voucher["code"], "title": voucher["title"],
    }


async def hold(
    db: Database, voucher: dict[str, Any], buyer_id: str, order_id: str, store_id: str, discount_minor: int
) -> None:
    use_key = f"{voucher['_id']}:{buyer_id}"
    per_user = int(voucher.get("per_user") or 1)
    took_user = False
    took_global = False
    try:
        existing = await db.voucher_uses.find_one({"_id": use_key})
        if existing is None:
            try:
                await db.voucher_uses.insert_one({
                    "_id": use_key, "voucher_id": voucher["_id"], "buyer_id": buyer_id, "count": 1,
                })
                took_user = True
            except DuplicateKeyError:
                existing = await db.voucher_uses.find_one({"_id": use_key})
        if not took_user:
            updated = await db.voucher_uses.update_one(
                {"_id": use_key, "count": {"$lt": per_user}}, {"$inc": {"count": 1}}
            )
            if updated.modified_count != 1:
                raise HTTPException(422, "You have already used this code")
            took_user = True
        query: dict[str, Any] = {"_id": voucher["_id"], "active": True}
        if voucher.get("max_redemptions") is not None:
            query["redeemed"] = {"$lt": int(voucher["max_redemptions"])}
        updated = await db.vouchers.update_one(query, {"$inc": {"redeemed": 1}})
        if updated.modified_count != 1:
            fresh = await db.vouchers.find_one({"_id": voucher["_id"]})
            if not fresh or not fresh.get("active"):
                raise HTTPException(422, "That code is not active")
            raise HTTPException(422, "This code has been used up")
        took_global = True
        await db.voucher_redemptions.insert_one({
            "_id": order_id, "voucher_id": voucher["_id"], "code": voucher["code"],
            "buyer_id": buyer_id, "store_id": store_id, "discount_minor": discount_minor,
            "status": "held", "created_at": now(),
        })
    except Exception:
        if took_global:
            await db.vouchers.update_one(
                {"_id": voucher["_id"], "redeemed": {"$gt": 0}}, {"$inc": {"redeemed": -1}}
            )
        if took_user:
            await db.voucher_uses.update_one({"_id": use_key, "count": {"$gt": 0}}, {"$inc": {"count": -1}})
        raise


async def release(db: Database, order_id: str) -> None:
    redemption = await db.voucher_redemptions.find_one_and_update(
        {"_id": order_id, "status": "held"}, {"$set": {"status": "released", "released_at": now()}}
    )
    if not redemption:
        return
    await db.voucher_uses.update_one(
        {"_id": f"{redemption['voucher_id']}:{redemption['buyer_id']}", "count": {"$gt": 0}},
        {"$inc": {"count": -1}},
    )
    await db.vouchers.update_one(
        {"_id": redemption["voucher_id"], "redeemed": {"$gt": 0}}, {"$inc": {"redeemed": -1}}
    )


def quote_view(
    code: str, title: str, summary_text: str, estimated: int, membership: int, discount: int
) -> dict[str, Any]:
    return {
        "code": code, "title": title, "summary": summary_text,
        "estimated_minor": estimated, "membership_discount_minor": membership,
        "discount_minor": discount, "payable_minor": estimated - membership - discount,
        "message": f"{code} takes ₹{_rupees(discount)} off this order. The store receives what you pay.",
    }


async def create_voucher(
    db: Database, owner_id: str, store_id: str | None, body: VoucherIn
) -> dict[str, Any]:
    code = normalize_code(body.code)
    if await db.vouchers.count_documents({"store_id": store_id, "active": True}) >= 12:
        who = "Campus" if store_id is None else "This store"
        raise HTTPException(422, f"{who} already has 12 active codes. Pause one first.")
    doc = body.model_dump()
    doc.update({
        "_id": new_id(), "code": code, "store_id": store_id, "owner_id": owner_id,
        "active": True, "redeemed": 0, "created_at": now(),
    })
    try:
        await db.vouchers.insert_one(doc)
    except DuplicateKeyError:
        raise HTTPException(409, "That code is already in use") from None
    await record(db, owner_id, "voucher.create", "voucher", doc["_id"], {"code": code, "store_id": store_id})
    return doc


async def set_active(db: Database, voucher_id: str, active: bool, actor_id: str) -> dict[str, Any]:
    res = await db.vouchers.update_one({"_id": voucher_id}, {"$set": {"active": active}})
    if res.matched_count != 1:
        raise HTTPException(404, "Code not found")
    await record(db, actor_id, "voucher.active", "voucher", voucher_id, {"active": active})
    found = await db.vouchers.find_one({"_id": voucher_id})
    assert found is not None
    return found
