from typing import Any

from fastapi import APIRouter, Query

from ..deps import CurrentUser, DbDep
from ..schemas import ConversationIn, MessageIn
from ..services import chat
from ..util import new_id, now

router = APIRouter(prefix="/api/chat", tags=["chat"])


async def _conv_view(db: Any, c: dict[str, Any], me: str) -> dict[str, Any]:
    other_id = next(p for p in c["participants"] if p != me)
    other = await db.users.find_one({"_id": other_id}, {"name": 1})
    return {
        "id": c["_id"], "store_id": c["store_id"], "store_name": c["store_name"],
        "order_id": c.get("order_id"), "product_id": c.get("product_id"),
        "other_user": {"id": other_id, "name": other["name"] if other else "Unknown",
                       "online": chat.manager.is_online(other_id)},
        "unread": c.get("unread", {}).get(me, 0), "last_message": c.get("last_message"),
        "last_seq": c.get("msg_seq", 0),
        "other_read_seq": c.get("read_seq", {}).get(other_id, 0),
        "updated_at": c["updated_at"],
    }


@router.post("/conversations", status_code=201)
async def start(body: ConversationIn, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    conv = await chat.start_conversation(db, user, body.store_id, body.order_id, body.product_id)
    return await _conv_view(db, conv, user["_id"])


@router.get("/conversations")
async def inbox(user: CurrentUser, db: DbDep) -> list[dict[str, Any]]:
    cur = db.conversations.find({"participants": user["_id"]}).sort("updated_at", -1).limit(100)
    return [await _conv_view(db, c, user["_id"]) async for c in cur]


@router.get("/unread")
async def unread(user: CurrentUser, db: DbDep) -> dict[str, int]:
    total = 0
    async for c in db.conversations.find({"participants": user["_id"]}, {"unread": 1}):
        total += c.get("unread", {}).get(user["_id"], 0)
    return {"unread": total}


@router.post("/ws-ticket")
async def ws_ticket(user: CurrentUser, db: DbDep) -> dict[str, Any]:
    """Short-lived single-use ticket so the JWT never appears in a WebSocket URL."""
    ticket = new_id() + new_id()
    await db.ws_tickets.insert_one({"_id": ticket, "user_id": user["_id"], "created_at": now()})
    return {"ticket": ticket, "expires_in": 60}


@router.get("/conversations/{conv_id}/messages")
async def messages(
    conv_id: str, user: CurrentUser, db: DbDep,
    after_seq: int | None = Query(None, ge=0),
    before_seq: int | None = Query(None, ge=1),
    limit: int = Query(50, ge=1, le=100),
) -> dict[str, Any]:
    conv = await chat.get_member_conversation(db, conv_id, user["_id"])
    base: dict[str, Any] = {"conversation_id": conv_id}
    if after_seq is not None:  # missed-message recovery after a reconnect
        base["seq"] = {"$gt": after_seq}
        docs = [m async for m in db.messages.find(base).sort("seq", 1).limit(limit)]
        has_more = len(docs) == limit
    else:  # newest page, or older page when before_seq is given
        if before_seq is not None:
            base["seq"] = {"$lt": before_seq}
        docs = [m async for m in db.messages.find(base).sort("seq", -1).limit(limit + 1)]
        has_more = len(docs) > limit
        docs = list(reversed(docs[:limit]))
    return {"messages": [chat.message_view(m) for m in docs], "has_more": has_more,
            "other_read_seq": conv.get("read_seq", {}).get(
                next(p for p in conv["participants"] if p != user["_id"]), 0)}


@router.post("/conversations/{conv_id}/messages", status_code=201)
async def send_rest(conv_id: str, body: MessageIn, user: CurrentUser, db: DbDep) -> dict[str, Any]:
    """HTTP fallback for sending when the WebSocket is unavailable."""
    conv = await chat.get_member_conversation(db, conv_id, user["_id"])
    chat.check_rate(user["_id"])
    msg = await chat.persist_message(db, conv, user["_id"], body.text, None)
    await chat.deliver(conv, msg)
    return chat.message_view(msg)


@router.post("/conversations/{conv_id}/read")
async def read(
    conv_id: str, user: CurrentUser, db: DbDep, up_to_seq: int = Query(10**9, ge=0)
) -> dict[str, int]:
    conv = await chat.get_member_conversation(db, conv_id, user["_id"])
    return {"unread": await chat.mark_read(db, conv, user["_id"], up_to_seq)}


