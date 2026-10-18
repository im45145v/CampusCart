from typing import Any

from fastapi import APIRouter

from ..config import get_settings
from ..deps import CurrentUser, DbDep
from ..schemas import AddFundsIn, FundsIn
from ..services import wallet as svc
from ..util import out

router = APIRouter(prefix="/api", tags=["wallet"])


@router.get("/payments/desk")
async def payment_desk() -> dict[str, str]:
    """Public desk UPI for top-ups. Returns no other settings."""
    return {"upi_id": get_settings().admin_upi_id}


@router.get("/me/wallet")
async def my_wallet(user: CurrentUser, db: DbDep) -> dict[str, Any]:
    rows = await svc.entries_for(db, user["_id"])
    return {
        "balance_minor": await svc.balance_of(db, user["_id"]),
        "upi_id": get_settings().admin_upi_id,
        "entries": [out(r) for r in rows],
    }


@router.post("/me/wallet/add", status_code=201)
async def add_funds(body: AddFundsIn, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    entry = await svc.add_funds(
        db, user["_id"], body.amount_minor, body.method, body.note, body.transaction_id,
    )
    return out(entry)


@router.post("/me/wallet/remove", status_code=201)
async def remove_funds(body: FundsIn, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    entry = await svc.remove_funds(db, user["_id"], body.amount_minor, body.note)
    return out(entry)
