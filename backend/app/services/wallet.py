"""Campus wallet: an on-campus credit ledger, not a bank or UPI payment.

A top-up stores the transaction ID the student typed and stays requested until
an admin approves it. That ID is not proof of payment, and the spendable balance
does not move until approval. Staff can still reverse a posted top-up. Payouts
leave the balance when requested; staff mark them paid or return them.
Balances are integer minor units. Debits only succeed when the stored balance
covers the amount.
"""

from typing import Any, Literal

from fastapi import HTTPException
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from ..audit import record
from ..db import Database
from ..ratelimit import limiter
from ..util import new_id, now

Reason = Literal[
    "topup", "withdrawal", "order_payment", "order_refund", "order_earning",
    "subscription", "subscription_renew", "subscription_refund", "reversal",
    "withdrawal_return",
]
TOPUP_MIN = 10_00
TOPUP_MAX = 2_000_00
TOPUP_DAY_MAX = 5_000_00
WITHDRAW_MIN = 10_00

def _entry(
    user_id: str, amount: int, direction: str, reason: str, balance_after: int,
    note: str = "", method: str | None = None, status: str = "posted",
    related_id: str | None = None, transaction_id: str | None = None,
) -> dict[str, Any]:
    row: dict[str, Any] = {
        "_id": new_id(), "user_id": user_id, "amount_minor": amount, "direction": direction,
        "reason": reason, "note": note[:200], "method": method, "status": status,
        "balance_after_minor": balance_after, "related_id": related_id, "created_at": now(),
    }
    if transaction_id:
        row["transaction_id"] = transaction_id
        row["transaction_key"] = transaction_id
    return row


async def credit(
    db: Database, user_id: str, amount: int, reason: Reason, *,
    note: str = "", method: str | None = None, status: str = "posted",
    related_id: str | None = None, actor_id: str | None = None,
) -> dict[str, Any]:
    if amount <= 0:
        raise HTTPException(422, "Amount must be positive")
    user = await db.users.find_one_and_update(
        {"_id": user_id},
        {"$inc": {"wallet_balance_minor": amount}},
        return_document=ReturnDocument.AFTER,
    )
    if not user:
        raise HTTPException(404, "User not found")
    entry = _entry(
        user_id, amount, "credit", reason, int(user.get("wallet_balance_minor") or 0),
        note, method, status, related_id,
    )
    await db.wallet_ledger.insert_one(entry)
    await record(db, actor_id or user_id, f"wallet.{reason}", "wallet", entry["_id"],
                 {"amount_minor": amount, "user_id": user_id, "related_id": related_id})
    return entry


async def debit(
    db: Database, user_id: str, amount: int, reason: Reason, *,
    note: str = "", status: str = "posted", related_id: str | None = None,
    actor_id: str | None = None,
) -> dict[str, Any]:
    if amount <= 0:
        raise HTTPException(422, "Amount must be positive")
    user = await db.users.find_one_and_update(
        {"_id": user_id, "wallet_balance_minor": {"$gte": amount}},
        {"$inc": {"wallet_balance_minor": -amount}},
        return_document=ReturnDocument.AFTER,
    )
    if not user:
        if not await db.users.find_one({"_id": user_id}, {"_id": 1}):
            raise HTTPException(404, "User not found")
        raise HTTPException(409, "Not enough campus wallet balance")
    entry = _entry(
        user_id, amount, "debit", reason, int(user.get("wallet_balance_minor") or 0),
        note, None, status, related_id,
    )
    await db.wallet_ledger.insert_one(entry)
    await record(db, actor_id or user_id, f"wallet.{reason}", "wallet", entry["_id"],
                 {"amount_minor": amount, "user_id": user_id, "related_id": related_id})
    return entry


def guard(user_id: str) -> None:
    if not limiter.allow(f"wallet:{user_id}", 20, 60):
        raise HTTPException(429, "Too many wallet requests, slow down")


async def _active_topup(db: Database, transaction_id: str) -> dict[str, Any] | None:
    return await db.wallet_ledger.find_one({
        "reason": "topup", "transaction_id": transaction_id,
        "status": {"$in": ["requested", "posted"]},
    })


async def add_funds(
    db: Database, user_id: str, amount: int, method: str, note: str, transaction_id: str,
) -> dict[str, Any]:
    """Request a campus-ledger top-up. The typed ID does not verify UPI or a bank.

    The row stays `requested` and the spendable balance does not change until an
    admin approves it. Sending the same ID again returns the existing row.
    """
    guard(user_id)
    txn = transaction_id.strip()
    if not txn:
        raise HTTPException(422, "Add the UPI transaction ID")
    if amount < TOPUP_MIN or amount > TOPUP_MAX:
        raise HTTPException(422, "Top-up must be between ₹10 and ₹2,000")
    if method == "reference" and len(note.strip()) < 4:
        raise HTTPException(422, "Add the reference the campus desk gave you")
    existing = await _active_topup(db, txn)
    if existing:
        if existing["user_id"] != user_id:
            raise HTTPException(409, "That transaction ID is already on another wallet")
        return existing
    start = now().replace(hour=0, minute=0, second=0, microsecond=0)
    today = 0
    async for row in db.wallet_ledger.find({
        "user_id": user_id, "reason": "topup", "created_at": {"$gte": start},
        "status": {"$in": ["requested", "posted"]},
    }):
        today += int(row["amount_minor"])
    if today + amount > TOPUP_DAY_MAX:
        raise HTTPException(409, "Daily top-up limit is ₹5,000")
    balance = await balance_of(db, user_id)
    entry = _entry(
        user_id, amount, "credit", "topup", balance, note=note.strip(), method=method,
        status="requested", transaction_id=txn,
    )
    try:
        await db.wallet_ledger.insert_one(entry)
    except DuplicateKeyError:
        raced = await _active_topup(db, txn)
        if raced and raced["user_id"] == user_id:
            return raced
        raise HTTPException(409, "That transaction ID is already on another wallet") from None
    await record(db, user_id, "wallet.topup_requested", "wallet", entry["_id"],
                 {"amount_minor": amount, "transaction_id": txn})
    from . import notifications
    await notifications.notify(
        db, user_id, "wallet", "Top-up waiting",
        "The desk has to confirm this top-up before you can spend it. "
        "The transaction ID is not proof of payment.",
        "/account", entry["_id"],
    )
    return entry


async def remove_funds(db: Database, user_id: str, amount: int, note: str) -> dict[str, Any]:
    """Take spendable balance out into a payout request. Staff mark it paid later."""
    guard(user_id)
    if amount < WITHDRAW_MIN:
        raise HTTPException(422, "The smallest payout is ₹10")
    if len(note.strip()) < 3:
        raise HTTPException(422, "Say how the campus desk should pay this out")
    waiting = await db.wallet_ledger.find_one(
        {"user_id": user_id, "reason": "withdrawal", "status": "requested"},
    )
    if waiting:
        raise HTTPException(409, "You already have a payout waiting for the desk")
    return await debit(
        db, user_id, amount, "withdrawal", note=note.strip(), status="requested",
    )


async def balance_of(db: Database, user_id: str) -> int:
    user = await db.users.find_one({"_id": user_id}, {"wallet_balance_minor": 1})
    if not user:
        raise HTTPException(404, "User not found")
    return int(user.get("wallet_balance_minor") or 0)


async def entries_for(db: Database, user_id: str, limit: int = 40) -> list[dict[str, Any]]:
    cur = db.wallet_ledger.find({"user_id": user_id}).sort("created_at", -1).limit(limit)
    return [row async for row in cur]


async def _apply_topup_credit(db: Database, entry_id: str) -> dict[str, Any]:
    """Credit a posted top-up once. A second call returns the row unchanged."""
    claimed = await db.wallet_ledger.find_one_and_update(
        {"_id": entry_id, "reason": "topup", "status": "posted", "balance_applied": {"$ne": True}},
        {"$set": {"balance_applied": True}},
        return_document=ReturnDocument.AFTER,
    )
    if not claimed:
        current = await db.wallet_ledger.find_one({"_id": entry_id})
        if not current or current.get("reason") != "topup":
            raise HTTPException(409, "That top-up is not waiting")
        return current
    user = await db.users.find_one_and_update(
        {"_id": claimed["user_id"]},
        {"$inc": {"wallet_balance_minor": int(claimed["amount_minor"])}},
        return_document=ReturnDocument.AFTER,
    )
    if not user:
        await db.wallet_ledger.update_one(
            {"_id": entry_id},
            {"$set": {"balance_applied": False, "status": "requested"}},
        )
        raise HTTPException(404, "User not found")
    balance = int(user.get("wallet_balance_minor") or 0)
    await db.wallet_ledger.update_one(
        {"_id": entry_id}, {"$set": {"balance_after_minor": balance}},
    )
    updated = await db.wallet_ledger.find_one({"_id": entry_id})
    assert updated is not None
    return updated


async def approve_topup(db: Database, entry_id: str, admin_id: str) -> dict[str, Any]:
    """Move a requested top-up to posted and add it to the spendable balance once."""
    won = await db.wallet_ledger.find_one_and_update(
        {"_id": entry_id, "reason": "topup", "status": "requested"},
        {"$set": {"status": "posted", "approved_by": admin_id, "approved_at": now()}},
        return_document=ReturnDocument.AFTER,
    )
    if won is None:
        existing = await db.wallet_ledger.find_one({"_id": entry_id, "reason": "topup"})
        if not existing or existing.get("status") != "posted":
            raise HTTPException(409, "That top-up is not waiting")
        if existing.get("balance_applied"):
            return existing
        return await _apply_topup_credit(db, entry_id)
    entry = await _apply_topup_credit(db, entry_id)
    await record(db, admin_id, "wallet.topup_approved", "wallet", entry_id,
                 {"amount_minor": int(entry["amount_minor"]), "user_id": entry["user_id"]})
    from . import notifications
    await notifications.notify(
        db, entry["user_id"], "wallet", "Top-up confirmed",
        "Campus desk confirmed your top-up. The credits are now spendable. "
        "This is a desk record, not a bank receipt.",
        "/account", entry_id,
    )
    return entry


async def reject_topup(db: Database, entry_id: str, admin_id: str) -> dict[str, Any]:
    """Decline a requested top-up. The spendable balance stays the same."""
    res = await db.wallet_ledger.update_one(
        {"_id": entry_id, "reason": "topup", "status": "requested"},
        {"$set": {"status": "rejected", "rejected_by": admin_id, "rejected_at": now()},
         "$unset": {"transaction_key": ""}},
    )
    if res.modified_count != 1:
        raise HTTPException(409, "That top-up is not waiting")
    entry = await db.wallet_ledger.find_one({"_id": entry_id})
    assert entry is not None
    await record(db, admin_id, "wallet.topup_rejected", "wallet", entry_id, {})
    from . import notifications
    await notifications.notify(
        db, entry["user_id"], "wallet", "Top-up not confirmed",
        "Campus desk did not confirm this top-up. Your spendable balance is unchanged.",
        "/account", entry_id,
    )
    return entry


async def reverse_topup(db: Database, entry_id: str, admin_id: str) -> dict[str, Any]:
    res = await db.wallet_ledger.update_one(
        {"_id": entry_id, "reason": "topup", "status": "posted"},
        {"$set": {"status": "reversed"}},
    )
    if res.modified_count != 1:
        raise HTTPException(409, "That top-up cannot be reversed")
    entry = await db.wallet_ledger.find_one({"_id": entry_id})
    assert entry is not None
    try:
        await debit(
            db, entry["user_id"], int(entry["amount_minor"]), "reversal",
            note="Staff reversed a campus top-up", related_id=entry_id, actor_id=admin_id,
        )
    except HTTPException:
        await db.wallet_ledger.update_one({"_id": entry_id}, {"$set": {"status": "posted"}})
        raise
    from . import notifications
    await notifications.notify(
        db, entry["user_id"], "wallet", "Top-up reversed",
        "Campus desk reversed a top-up. The credits left your balance.",
        "/account", entry_id,
    )
    return await db.wallet_ledger.find_one({"_id": entry_id})  # type: ignore[no-any-return]


async def mark_withdrawal_paid(db: Database, entry_id: str, admin_id: str) -> dict[str, Any]:
    res = await db.wallet_ledger.update_one(
        {"_id": entry_id, "reason": "withdrawal", "status": "requested"},
        {"$set": {"status": "paid"}},
    )
    if res.modified_count != 1:
        raise HTTPException(409, "That payout is not waiting")
    await record(db, admin_id, "wallet.withdrawal_paid", "wallet", entry_id, {})
    paid = await db.wallet_ledger.find_one({"_id": entry_id})
    assert paid is not None
    from . import notifications
    await notifications.notify(
        db, paid["user_id"], "wallet", "Payout marked paid",
        "Campus desk marked your payout as paid. This is a desk record, not a bank receipt.",
        "/account", entry_id,
    )
    return paid


async def return_withdrawal(db: Database, entry_id: str, admin_id: str) -> dict[str, Any]:
    res = await db.wallet_ledger.update_one(
        {"_id": entry_id, "reason": "withdrawal", "status": "requested"},
        {"$set": {"status": "returned"}},
    )
    if res.modified_count != 1:
        raise HTTPException(409, "That payout is not waiting")
    entry = await db.wallet_ledger.find_one({"_id": entry_id})
    assert entry is not None
    await credit(
        db, entry["user_id"], int(entry["amount_minor"]), "withdrawal_return",
        note="Payout returned to campus wallet", related_id=entry_id, actor_id=admin_id,
    )
    from . import notifications
    await notifications.notify(
        db, entry["user_id"], "wallet", "Payout returned",
        "The payout was returned to your campus wallet.",
        "/account", entry_id,
    )
    return await db.wallet_ledger.find_one({"_id": entry_id})  # type: ignore[no-any-return]
