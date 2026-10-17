from typing import Any

from fastapi import APIRouter, HTTPException, Query

from ..audit import record
from ..deps import AdminUser, DbDep
from ..schemas import ModerationIn, ResolveReportIn
from ..services.chat import message_view
from ..util import now, out

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/users")
async def users(
    _: AdminUser, db: DbDep, limit: int = Query(100, ge=1, le=200)
) -> list[dict[str, Any]]:
    cur = db.users.find({}, {"password_hash": 0}).sort("created_at", -1).limit(limit)
    return [out(u) async for u in cur]


@router.post("/users/{user_id}/active")
async def set_user_active(
    user_id: str, body: ModerationIn, active: bool, admin: AdminUser, db: DbDep
) -> dict[str, Any]:
    if user_id == admin["_id"]:
        raise HTTPException(400, "You cannot change your own status")
    res = await db.users.update_one({"_id": user_id}, {"$set": {"is_active": active}})
    if res.matched_count != 1:
        raise HTTPException(404, "User not found")
    await record(db, admin["_id"], "user.activate" if active else "user.deactivate",
                 "user", user_id, {"reason": body.reason})
    return {"id": user_id, "is_active": active}


@router.get("/stores")
async def stores(_: AdminUser, db: DbDep) -> list[dict[str, Any]]:
    return [out(s) async for s in db.stores.find({}).sort("created_at", -1).limit(200)]


@router.post("/stores/{store_id}/status")
async def set_store_status(
    store_id: str, body: ModerationIn, suspended: bool, admin: AdminUser, db: DbDep
) -> dict[str, Any]:
    status = "suspended" if suspended else "active"
    res = await db.stores.update_one({"_id": store_id}, {"$set": {"status": status}})
    if res.matched_count != 1:
        raise HTTPException(404, "Store not found")
    await record(db, admin["_id"], f"store.{status}", "store", store_id, {"reason": body.reason})
    return {"id": store_id, "status": status}


@router.post("/products/{product_id}/moderate")
async def moderate_product(
    product_id: str, body: ModerationIn, remove: bool, admin: AdminUser, db: DbDep
) -> dict[str, Any]:
    state = "removed" if remove else "active"
    update: dict[str, Any] = {"moderation_status": state}
    if remove:
        update["published"] = False
    res = await db.products.update_one({"_id": product_id}, {"$set": update})
    if res.matched_count != 1:
        raise HTTPException(404, "Product not found")
    await record(db, admin["_id"], f"product.{state}", "product", product_id,
                 {"reason": body.reason})
    return {"id": product_id, "moderation_status": state}


@router.get("/reports")
async def reports(
    _: AdminUser, db: DbDep, status: str | None = None
) -> list[dict[str, Any]]:
    cur = db.reports.find({"status": status} if status else {}).sort("created_at", -1).limit(200)
    return [out(r) async for r in cur]


@router.post("/reports/{report_id}/resolve")
async def resolve_report(
    report_id: str, body: ResolveReportIn, admin: AdminUser, db: DbDep
) -> dict[str, Any]:
    res = await db.reports.update_one(
        {"_id": report_id, "status": "open"},
        {"$set": {"status": body.status, "resolution": body.resolution,
                  "resolved_by": admin["_id"], "resolved_at": now()}},
    )
    if res.modified_count != 1:
        raise HTTPException(409, "Report not found or already closed")
    await record(db, admin["_id"], f"report.{body.status}", "report", report_id,
                 {"resolution": body.resolution})
    return out(await db.reports.find_one({"_id": report_id}))


@router.get("/reports/{report_id}/conversation")
async def reported_conversation(report_id: str, admin: AdminUser, db: DbDep) -> list[dict[str, Any]]:
    """Admins may read a conversation only through a report about it; access is audited."""
    r = await db.reports.find_one({"_id": report_id, "target_type": "conversation"})
    if not r:
        raise HTTPException(404, "Report not found")
    await record(db, admin["_id"], "conversation.review", "conversation", r["target_id"],
                 {"report_id": report_id})
    cur = db.messages.find({"conversation_id": r["target_id"]}).sort("seq", 1).limit(500)
    return [message_view(m) async for m in cur]


@router.get("/audit")
async def audit(_: AdminUser, db: DbDep, limit: int = Query(100, ge=1, le=500)) -> list[dict[str, Any]]:
    return [out(a) async for a in db.audit_logs.find({}).sort("created_at", -1).limit(limit)]
