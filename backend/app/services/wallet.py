"""Campus wallet: an on-campus credit ledger, not a bank or UPI payment.

Top-ups are recorded by the student and can be reversed by staff. Nothing here
verifies a bank transfer. Balances are integer minor units. Debits only succeed
when the stored balance covers the amount.
"""

from typing import Any, Literal

from fastapi import HTTPException
from pymongo import ReturnDocument

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
    related_id: str | None = None,
) -> dict[str, Any]:
    return {
        "_id": new_id(), "user_id": user_id, "amount_minor": amount, "direction": direction,
        "reason": reason, "note": note[:200], "method": method, "status": status,
        "balance_after_minor": balance_after, "related_id": related_id, "created_at": now(),
    }


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


async def add_funds(
    db: Database, user_id: str, amount: int, method: str, note: str
) -> dict[str, Any]:
    """Record a campus-ledger top-up. This does not verify UPI or a bank."""
    guard(user_id)
    if amount < TOPUP_MIN or amount > TOPUP_MAX:
        raise HTTPException(422, "Top-up must be between ₹10 and ₹2,000")
    if method == "reference" and len(note.strip()) < 4:
        raise HTTPException(422, "Add the reference the campus desk gave you")
    start = now().replace(hour=0, minute=0, second=0, microsecond=0)
    today = 0
    async for row in db.wallet_ledger.find(
        {"user_id": user_id, "reason": "topup", "created_at": {"$gte": start}, "status": "posted"}
    ):
        today += int(row["amount_minor"])
    if today + amount > TOPUP_DAY_MAX:
        raise HTTPException(409, "Daily top-up limit is ₹5,000")
    return await credit(
        db, user_id, amount, "topup", note=note.strip(), method=method, status="posted",
    )


async def remove_funds(db: Database, user_id: str, amount: int, note: str) -> dict[str, Any]:
    """Take spendable balance out into a payout request. Staff mark it paid later."""
    guard(user_id)
    if amount < WITHDRAW_MIN:
        raise HTTPException(422, "The smallest payout is ₹10")
    if len(note.strip()) < 3:
        raise HTTPException(422, "Say how the campus desk should pay this out")
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
