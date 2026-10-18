"""In-app notifications. Stored for later, and pushed on the chat socket when the user is connected.

The socket list is in-memory, so a live push only reaches users on this API process.
The record itself is what the bell reads after a refresh or a reconnect.
"""

from typing import Any

from fastapi.encoders import jsonable_encoder

from ..db import Database
from ..util import new_id, now, out


async def notify(
    db: Database,
    user_id: str,
    kind: str,
    title: str,
    body: str,
    href: str,
    related_id: str | None = None,
) -> dict[str, Any]:
    doc = {
        "_id": new_id(),
        "user_id": user_id,
        "kind": kind,
        "title": title[:80],
        "body": body[:240],
        "href": href[:200],
        "related_id": related_id,
        "read": False,
        "created_at": now(),
    }
    await db.notifications.insert_one(doc)
    from .chat import manager

    await manager.send(user_id, {"type": "notification", "notification": jsonable_encoder(out(doc))})
    return doc
