from typing import Any

from fastapi import APIRouter, HTTPException, Request

from ..audit import record
from ..deps import CurrentUser, DbDep
from ..ratelimit import enforce
from ..schemas import ReportIn
from ..util import new_id, now, out

router = APIRouter(prefix="/api", tags=["reports"])


async def _can_report(db: Any, user: dict[str, Any], rtype: str, target_id: str) -> bool:
    uid = user["_id"]
    if rtype == "store":
        return await db.stores.find_one({"_id": target_id}) is not None
    if rtype == "product":
        return await db.products.find_one({"_id": target_id}) is not None
    if rtype == "conversation":
        return await db.conversations.find_one({"_id": target_id, "participants": uid}) is not None
    return (
        await db.orders.find_one(
            {"_id": target_id, "$or": [{"buyer_id": uid}, {"seller_id": uid}]}
        )
        is not None
    )


@router.post("/reports", status_code=201)
async def create_report(
    body: ReportIn, request: Request, user: CurrentUser, db: DbDep
) -> dict[str, Any]:
    enforce(request, "report", 20, 60)
    if not await _can_report(db, user, body.target_type, body.target_id):
        raise HTTPException(404, "Target not found")
    report = {
        "_id": new_id(), "reporter_id": user["_id"], **body.model_dump(),
        "status": "open", "resolution": None, "resolved_by": None, "created_at": now(),
    }
    await db.reports.insert_one(report)
    await record(db, user["_id"], "report.create", body.target_type, body.target_id)
    return out(report)
