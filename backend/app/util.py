import re
import uuid
from datetime import UTC, datetime
from typing import Any


def new_id() -> str:
    return uuid.uuid4().hex


def now() -> datetime:
    return datetime.now(UTC)


def out(doc: dict[str, Any] | None) -> dict[str, Any]:
    """Convert a Mongo document to an API dict (`_id` -> `id`)."""
    assert doc is not None
    d = dict(doc)
    d["id"] = d.pop("_id")
    return d


def contains_regex(q: str) -> dict[str, Any]:
    """Case-insensitive literal substring match; user input is always escaped."""
    return {"$regex": re.escape(q.strip()[:80]), "$options": "i"}
