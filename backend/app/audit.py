from typing import Any

from .db import Database
from .util import new_id, now


async def record(
    db: Database, actor_id: str, action: str, target_type: str, target_id: str,
    details: dict[str, Any] | None = None,
) -> None:
    await db.audit_logs.insert_one(
        {
            "_id": new_id(),
            "actor_id": actor_id,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "details": details or {},
            "created_at": now(),
        }
    )
