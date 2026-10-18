"""Push order snapshots over the existing chat socket. In-memory, single process."""

from typing import Any

from fastapi.encoders import jsonable_encoder

from ..util import out
from .chat import manager


async def push_order(order: dict[str, Any]) -> None:
    payload = {"type": "order", "order": jsonable_encoder(out(order))}
    buyer = str(order["buyer_id"])
    seller = str(order["seller_id"])
    await manager.send(buyer, payload)
    if seller != buyer:
        await manager.send(seller, payload)
