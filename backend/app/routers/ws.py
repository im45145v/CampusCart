import json
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import ValidationError

from ..config import get_settings
from ..db import get_db
from ..schemas import MessageIn
from ..services import chat
from ..util import now

router = APIRouter()

MAX_FRAME_CHARS = 8192
TICKET_TTL = timedelta(seconds=60)


async def _consume_ticket(ticket: str) -> str | None:
    db = get_db()
    rec = await db.ws_tickets.find_one_and_delete({"_id": ticket})  # single use
    if not rec or now() - _aware(rec["created_at"]) > TICKET_TTL:
        return None
    user = await db.users.find_one({"_id": rec["user_id"]})
    if not user or not user.get("is_active", True):
        return None
    return str(user["_id"])


def _aware(dt: Any) -> Any:
    from datetime import UTC

    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


@router.websocket("/ws/chat")
async def chat_socket(ws: WebSocket, ticket: str = "") -> None:
    origin = ws.headers.get("origin")
    if origin and origin not in get_settings().cors_origin_list:
        await ws.close(code=1008)
        return
    user_id = await _consume_ticket(ticket) if ticket else None
    if not user_id:
        await ws.close(code=4401)
        return
    await ws.accept()
    chat.manager.add(user_id, ws)
    await ws.send_json({"type": "ready", "user_id": user_id})
    db = get_db()
    await chat.announce_presence(db, user_id, True)
    try:
        while True:
            raw = await ws.receive_text()
            if len(raw) > MAX_FRAME_CHARS:
                await ws.close(code=1009)
                return
            try:
                frame = json.loads(raw)
                if not isinstance(frame, dict):
                    raise ValueError
            except ValueError:
                await ws.send_json({"type": "error", "code": "bad_frame"})
                continue
            await _handle(ws, db, user_id, frame)
    except WebSocketDisconnect:
        pass
    finally:
        chat.manager.remove(user_id, ws)
        if user_id and not chat.manager.is_online(user_id):
            await chat.announce_presence(get_db(), user_id, False)


async def _handle(ws: WebSocket, db: Any, user_id: str, frame: dict[str, Any]) -> None:
    kind = frame.get("type")
    client_id = frame.get("client_id")
    if client_id is not None and (not isinstance(client_id, str) or len(client_id) > 64):
        await ws.send_json({"type": "error", "code": "bad_client_id"})
        return
    conv_id = frame.get("conversation_id")
    if kind == "ping":
        await ws.send_json({"type": "pong"})
        return
    if not isinstance(conv_id, str):
        await ws.send_json({"type": "error", "code": "bad_frame", "client_id": client_id})
        return
    try:
        conv = await chat.get_member_conversation(db, conv_id, user_id)
        if kind == "send":
            try:
                body = MessageIn(text=frame.get("text"))  # type: ignore[arg-type]
            except ValidationError:
                await ws.send_json({"type": "error", "code": "invalid_message",
                                    "client_id": client_id})
                return
            chat.check_rate(user_id)
            # sender identity always comes from the authenticated connection
            msg = await chat.persist_message(db, conv, user_id, body.text, client_id)
            await ws.send_json({"type": "ack", "client_id": client_id,
                                "message": chat.to_json(chat.message_view(msg))})
            await chat.deliver(conv, msg, skip=ws)
        elif kind == "read":
            seq = frame.get("up_to_seq")
            if isinstance(seq, int) and not isinstance(seq, bool):
                await chat.mark_read(db, conv, user_id, seq)
        elif kind == "typing":
            other = next(p for p in conv["participants"] if p != user_id)
            await chat.manager.send(other, {"type": "typing", "conversation_id": conv_id,
                                            "user_id": user_id})
        else:
            await ws.send_json({"type": "error", "code": "unknown_type", "client_id": client_id})
    except HTTPException as e:
        code = "rate_limited" if e.status_code == 429 else "not_found"
        await ws.send_json({"type": "error", "code": code, "client_id": client_id})
