import asyncio
from typing import Any

import httpx

from .assistant import answer
from .client import CampusCartClient
from .tools import Tool


async def handle_update(
    update: dict[str, Any], allowed: set[int], client: CampusCartClient, tools: dict[str, Tool]
) -> tuple[int, str] | None:
    msg = update.get("message") or {}
    chat_id = (msg.get("chat") or {}).get("id")
    text = msg.get("text")
    if not isinstance(chat_id, int) or not isinstance(text, str):
        return None
    if chat_id not in allowed:  # allow-list: strangers get no data and no hints
        return None
    return chat_id, await answer(client, tools, text)


async def run(token: str, allowed: set[int], client: CampusCartClient, tools: dict[str, Tool]) -> None:
    base = f"https://api.telegram.org/bot{token}"
    offset = 0
    async with httpx.AsyncClient(timeout=40) as http:
        while True:
            try:
                r = await http.get(f"{base}/getUpdates", params={"timeout": 30, "offset": offset})
                for u in r.json().get("result", []):
                    offset = u["update_id"] + 1
                    reply = await handle_update(u, allowed, client, tools)
                    if reply:
                        await http.post(f"{base}/sendMessage", json={"chat_id": reply[0], "text": reply[1]})
            except (httpx.HTTPError, ValueError):
                await asyncio.sleep(5)
