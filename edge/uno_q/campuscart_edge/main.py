"""Entry point: python -m campuscart_edge.main  (Telegram bot) or  ... --ask "orders" (CLI)."""
import asyncio
import sys

from .assistant import answer
from .client import CampusCartClient
from .config import EdgeSettings
from .telegram_bot import run
from .tools import build_tools


async def amain(argv: list[str]) -> None:
    s = EdgeSettings()
    if not s.campuscart_api_token:
        raise SystemExit("Set CAMPUSCART_API_TOKEN (create one in Seller Studio).")
    client = CampusCartClient(s.campuscart_api_url, s.campuscart_api_token)
    tools = build_tools()
    try:
        if len(argv) >= 2 and argv[0] == "--ask":
            print(await answer(client, tools, " ".join(argv[1:])))
        elif s.telegram_bot_token and s.allowed_chats:
            await run(s.telegram_bot_token, s.allowed_chats, client, tools)
        else:
            raise SystemExit("Telegram needs TELEGRAM_BOT_TOKEN and TELEGRAM_ALLOWED_CHAT_IDS; "
                             "or use --ask '<question>'.")
    finally:
        await client.aclose()


if __name__ == "__main__":
    asyncio.run(amain(sys.argv[1:]))
