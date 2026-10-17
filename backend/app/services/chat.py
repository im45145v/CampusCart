from typing import Any

from fastapi import HTTPException, WebSocket
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError

from ..config import get_settings
from ..db import Database
from ..ratelimit import limiter
from ..util import new_id, now


class ConnectionManager:
    """Tracks live sockets per user. In-memory: use a pub/sub layer (e.g. Redis) to scale out."""

    def __init__(self) -> None:
        self._conns: dict[str, set[WebSocket]] = {}

    def add(self, user_id: str, ws: WebSocket) -> None:
        self._conns.setdefault(user_id, set()).add(ws)

    def remove(self, user_id: str, ws: WebSocket) -> None:
        self._conns.get(user_id, set()).discard(ws)
        if not self._conns.get(user_id):
            self._conns.pop(user_id, None)

    def is_online(self, user_id: str) -> bool:
        return user_id in self._conns

    async def send(
        self, user_id: str, payload: dict[str, Any], skip: WebSocket | None = None
    ) -> None:
        for ws in list(self._conns.get(user_id, ())):
            if ws is skip:
                continue
            try:
                await ws.send_json(payload)
            except Exception:  # noqa: BLE001 - dead socket; receive loop will clean up
                self.remove(user_id, ws)


manager = ConnectionManager()


def message_view(m: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": m["_id"], "conversation_id": m["conversation_id"], "seq": m["seq"],
        "sender_id": m["sender_id"], "text": m["text"], "created_at": m["created_at"],
        "client_id": m.get("client_id"),
    }


def check_rate(user_id: str) -> None:
    s = get_settings()
    if not limiter.allow(f"chat:{user_id}", s.chat_rate_limit_messages, s.chat_rate_limit_window_s):
        raise HTTPException(429, "You are sending messages too quickly")


async def get_member_conversation(db: Database, conv_id: str, user_id: str) -> dict[str, Any]:
    conv = await db.conversations.find_one({"_id": conv_id, "participants": user_id})
    if not conv:
        raise HTTPException(404, "Conversation not found")  # same answer for non-members
    return conv  # type: ignore[no-any-return]


async def start_conversation(
    db: Database, user: dict[str, Any], store_id: str, order_id: str | None, product_id: str | None
) -> dict[str, Any]:
    store = await db.stores.find_one({"_id": store_id})
    if not store:
        raise HTTPException(404, "Store not found")
    buyer_id = user["_id"]
    order = None
    if order_id:
        order = await db.orders.find_one({"_id": order_id, "store_id": store_id})
        if not order or user["_id"] not in (order["buyer_id"], order["seller_id"]):
            raise HTTPException(404, "Order not found")
        buyer_id = order["buyer_id"]
    elif store["owner_id"] == user["_id"]:
        raise HTTPException(400, "Sellers start conversations from an order")
    if buyer_id == store["owner_id"]:
        raise HTTPException(400, "You cannot message yourself")
    if product_id and not await db.products.find_one({"_id": product_id, "store_id": store_id}):
        raise HTTPException(404, "Product not found")
    key = f"{buyer_id}:{store_id}:{order_id or '-'}"
    existing = await db.conversations.find_one({"key": key})
    if existing:
        return existing  # type: ignore[no-any-return]
    conv = {
        "_id": new_id(), "key": key, "participants": [buyer_id, store["owner_id"]],
        "buyer_id": buyer_id, "seller_id": store["owner_id"], "store_id": store_id,
        "store_name": store["name"], "order_id": order_id, "product_id": product_id,
        "msg_seq": 0, "unread": {buyer_id: 0, store["owner_id"]: 0},
        "read_seq": {buyer_id: 0, store["owner_id"]: 0},
        "last_message": None, "created_at": now(), "updated_at": now(),
    }
    try:
        await db.conversations.insert_one(conv)
    except DuplicateKeyError:
        conv = await db.conversations.find_one({"key": key})  # type: ignore[assignment]
    return conv


async def persist_message(
    db: Database, conv: dict[str, Any], sender_id: str, text: str, client_id: str | None
) -> dict[str, Any]:
    """Store a message (idempotent on client_id). Callers ack only after this returns."""
    if client_id:
        dup = await db.messages.find_one(
            {"conversation_id": conv["_id"], "sender_id": sender_id, "client_id": client_id}
        )
        if dup:
            return dup  # type: ignore[no-any-return]
    updated = await db.conversations.find_one_and_update(
        {"_id": conv["_id"]}, {"$inc": {"msg_seq": 1}}, return_document=ReturnDocument.AFTER
    )
    msg = {
        "_id": new_id(), "conversation_id": conv["_id"], "seq": updated["msg_seq"],
        "sender_id": sender_id, "text": text, "client_id": client_id, "created_at": now(),
    }
    if client_id is None:
        msg.pop("client_id")
    try:
        await db.messages.insert_one(msg)
    except DuplicateKeyError:
        dup = await db.messages.find_one(
            {"conversation_id": conv["_id"], "sender_id": sender_id, "client_id": client_id}
        )
        if dup:
            return dup  # type: ignore[no-any-return]
        raise
    recipient = next(p for p in conv["participants"] if p != sender_id)
    await db.conversations.update_one(
        {"_id": conv["_id"]},
        {"$set": {"last_message": {"text": text[:200], "sender_id": sender_id,
                                   "at": msg["created_at"], "seq": msg["seq"]},
                  "updated_at": msg["created_at"]},
         "$inc": {f"unread.{recipient}": 1}},
    )
    return msg


async def deliver(conv: dict[str, Any], msg: dict[str, Any], skip: WebSocket | None = None) -> None:
    payload = {"type": "message", "message": to_json(message_view(msg))}
    for uid in conv["participants"]:
        await manager.send(uid, payload, skip=skip)


async def mark_read(db: Database, conv: dict[str, Any], user_id: str, up_to_seq: int) -> int:
    up_to_seq = max(0, min(up_to_seq, conv.get("msg_seq", 0)))
    current = conv.get("read_seq", {}).get(user_id, 0)
    up_to_seq = max(up_to_seq, current)
    unread = await db.messages.count_documents(
        {"conversation_id": conv["_id"], "seq": {"$gt": up_to_seq}, "sender_id": {"$ne": user_id}}
    )
    await db.conversations.update_one(
        {"_id": conv["_id"]},
        {"$set": {f"read_seq.{user_id}": up_to_seq, f"unread.{user_id}": unread}},
    )
    other = next(p for p in conv["participants"] if p != user_id)
    await manager.send(other, {"type": "read", "conversation_id": conv["_id"],
                               "reader_id": user_id, "up_to_seq": up_to_seq})
    return unread


def to_json(d: dict[str, Any]) -> dict[str, Any]:
    out = dict(d)
    if hasattr(out.get("created_at"), "isoformat"):
        out["created_at"] = out["created_at"].isoformat()
    return out
