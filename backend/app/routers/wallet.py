from typing import Any

from fastapi import APIRouter, HTTPException, Request

from ..deps import CurrentUser, DbDep
from ..schemas import CheckoutIn, FundsIn
from ..services import wallet as svc
from ..services import youpi
from ..services.youpi import YoupiError
from ..util import out

router = APIRouter(prefix="/api", tags=["wallet"])


@router.get("/payments/desk")
async def payment_desk() -> dict[str, str]:
    """Which top-up provider is configured. Returns no keys and no UPI id."""
    return {"provider": "youpi", "checkout": "ready" if youpi.configured() else "unavailable"}


@router.post("/payments/youpi")
async def youpi_callback(request: Request, db: DbDep) -> dict[str, Any]:
    """YouPI's server callback. The raw body is verified before it is parsed."""
    if not youpi.configured():
        raise HTTPException(503, "UPI checkout is not configured yet")
    raw = await request.body()
    if len(raw) > 16_000:
        raise HTTPException(413, "YouPI callback was too large")
    try:
        payload = youpi.signed_payload(raw, request.headers.get("x-gateway-signature", ""))
    except YoupiError as err:
        raise HTTPException(err.status, err.detail) from err
    status, body = await svc.apply_youpi_callback(db, payload)
    if status != 200:
        raise HTTPException(status, str(body.get("detail") or "YouPI callback was not applied"))
    return body


@router.get("/me/wallet")
async def my_wallet(user: CurrentUser, db: DbDep) -> dict[str, Any]:
    rows = await svc.entries_for(db, user["_id"])
    return {
        "balance_minor": await svc.balance_of(db, user["_id"]),
        "checkout": "ready" if youpi.configured() else "unavailable",
        "entries": [out(r) for r in rows],
    }


@router.post("/me/wallet/checkout", status_code=201)
async def start_checkout(body: CheckoutIn, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    entry = await svc.start_youpi_checkout(db, user["_id"], body.amount_minor)
    return out(entry)


@router.post("/me/wallet/add")
async def add_funds_retired(_user: CurrentUser) -> dict[str, Any]:
    """Retired. A typed transaction ID does not start a top-up."""
    raise HTTPException(
        410,
        "Pay the amount in the YouPI checkout. A transaction ID is not accepted.",
    )


@router.post("/me/wallet/remove", status_code=201)
async def remove_funds(body: FundsIn, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    entry = await svc.remove_funds(db, user["_id"], body.amount_minor, body.note)
    return out(entry)
