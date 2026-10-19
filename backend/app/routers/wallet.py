import json
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


def _require_merchant_key(request: Request) -> None:
    if not youpi.merchant_key_matches(request.headers.get("x-merchant-key", "")):
        raise HTTPException(401, "YouPI signature was rejected")


@router.put("/payments/youpi/gmail")
async def keep_gmail(request: Request, db: DbDep) -> dict[str, bool]:
    """Store the Gmail refresh token for the next YouPI boot. The response has no token."""
    _require_merchant_key(request)
    raw = await request.body()
    if len(raw) > 8_000:
        raise HTTPException(413, "Gmail connection was too large")
    try:
        body = json.loads(raw)
    except json.JSONDecodeError as err:
        raise HTTPException(400, "Gmail connection was not JSON") from err
    if not isinstance(body, dict):
        raise HTTPException(400, "Gmail connection was not JSON")
    token = str(body.get("refresh_token") or "").strip()
    email = str(body.get("connected_email") or "").strip()
    if len(token) < 20 or len(token) > 2048 or any(ch.isspace() for ch in token) or len(email) > 200:
        raise HTTPException(422, "Gmail connection was not saved")
    await youpi.save_gmail_connection(db, token, email)
    return {"saved": True}


@router.get("/payments/youpi/gmail")
async def restore_gmail(request: Request, db: DbDep) -> dict[str, str]:
    """Return the saved Gmail refresh token to the YouPI boot script."""
    _require_merchant_key(request)
    row = await youpi.read_gmail_connection(db)
    if row is None:
        raise HTTPException(404, "Gmail is not connected")
    return row


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
