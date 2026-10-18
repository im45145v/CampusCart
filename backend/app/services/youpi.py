"""YouPI-PG checkout client.

Credits are not decided here. The wallet credits a top-up only after the raw
callback body matches YouPI's HMAC and a second request, sent with the merchant
key, still describes a verified UPI success for that same order.
"""

import hashlib
import hmac
import json
from typing import Any
from urllib.parse import quote, urlsplit

import httpx

from ..config import get_settings

_ACCEPTED_TAG = ("verification", "sms", "gmail")
_REJECTED_TAG = ("COD", "UNVERIFIED", "DEFAULT", "TEST", "SIMUL")


class YoupiError(Exception):
    def __init__(self, status: int, detail: str) -> None:
        self.status = status
        self.detail = detail
        super().__init__(detail)


def configured() -> bool:
    settings = get_settings()
    return bool(settings.youpi_api_url and settings.youpi_merchant_id and settings.youpi_webhook_secret)


def minor_to_rupees(amount_minor: int) -> str:
    return f"{amount_minor // 100}.{amount_minor % 100:02d}"


def signed_payload(raw: bytes, header: str) -> dict[str, Any]:
    """Return the callback object only when the HMAC matches the raw bytes."""
    secret = get_settings().youpi_webhook_secret.encode()
    presented = header.strip()
    prefix = "sha256="
    if not secret or not presented.startswith(prefix) or len(presented) != len(prefix) + 64:
        raise YoupiError(401, "YouPI signature was rejected")
    digest = hmac.new(secret, raw, hashlib.sha256).hexdigest()
    given = presented[len(prefix):].lower()
    if not hmac.compare_digest(digest, given):
        raise YoupiError(401, "YouPI signature was rejected")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as err:
        raise YoupiError(400, "YouPI callback was not JSON") from err
    if not isinstance(payload, dict):
        raise YoupiError(400, "YouPI callback was not JSON")
    return payload


def is_verified_upi(remote: dict[str, Any], order_id: str, amount_minor: int, payment_id: str) -> bool:
    """True when YouPI's own payment record is a verified UPI success for this top-up."""
    if str(remote.get("paymentId") or "") != payment_id:
        return False
    if str(remote.get("orderId") or "") != order_id:
        return False
    if str(remote.get("status") or "").upper() != "SUCCESS":
        return False
    if str(remote.get("method") or "").upper() != "UPI":
        return False
    raw_paise = remote.get("amountPaise")
    raw_level = remote.get("verificationLevel") or 0
    if isinstance(raw_paise, bool) or not isinstance(raw_paise, (int, str)):
        return False
    if isinstance(raw_level, bool) or not isinstance(raw_level, (int, str)):
        return False
    try:
        paise = int(raw_paise)
        level = int(raw_level)
    except ValueError:
        return False
    if paise != amount_minor or level < 1:
        return False
    tag = str(remote.get("verificationTag") or "")
    upper = tag.upper()
    if any(part in upper for part in _REJECTED_TAG):
        return False
    return any(part in tag.lower() for part in _ACCEPTED_TAG)


def _api_root() -> str:
    return get_settings().youpi_api_url.rstrip("/")


async def create_payment(order_id: str, amount_minor: int, return_url: str) -> dict[str, str]:
    settings = get_settings()
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{_api_root()}/api/v1/payments",
                headers={"X-Merchant-Id": settings.youpi_merchant_id},
                json={
                    "orderId": order_id,
                    "amount": minor_to_rupees(amount_minor),
                    "currency": "INR",
                    "returnUrl": return_url,
                    "metadata": {"source": "unicart-wallet"},
                },
            )
    except httpx.HTTPError as err:
        raise YoupiError(502, "YouPI checkout could not be started") from err
    if response.status_code >= 400:
        raise YoupiError(502, "YouPI checkout could not be started")
    try:
        body = response.json()
    except ValueError as err:
        raise YoupiError(502, "YouPI checkout could not be started") from err
    payment_id = str(body.get("paymentId") or "")
    checkout_url = str(body.get("checkoutUrl") or "")
    parts = urlsplit(checkout_url)
    if not payment_id or len(payment_id) > 80 or any(ch.isspace() for ch in payment_id):
        raise YoupiError(502, "YouPI did not return a checkout")
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        raise YoupiError(502, "YouPI did not return a checkout")
    return {"paymentId": payment_id, "checkoutUrl": checkout_url}


async def fetch_payment(payment_id: str) -> dict[str, Any]:
    """Re-read a payment with the merchant key. The callback body is not this record."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.get(
                f"{_api_root()}/api/v1/payments/{quote(payment_id, safe='')}",
                headers={"X-Merchant-Key": get_settings().youpi_webhook_secret},
            )
    except httpx.HTTPError as err:
        raise YoupiError(503, "YouPI payment could not be re-read") from err
    if response.status_code >= 400:
        raise YoupiError(503, "YouPI payment could not be re-read")
    try:
        body = response.json()
    except ValueError as err:
        raise YoupiError(503, "YouPI payment could not be re-read") from err
    if not isinstance(body, dict):
        raise YoupiError(503, "YouPI payment could not be re-read")
    return body
