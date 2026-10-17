from typing import Any

import httpx


class CampusCartClient:
    """Read-only client. It can only call the narrow /api/edge/* endpoints."""

    def __init__(self, base_url: str, token: str, transport: httpx.AsyncBaseTransport | None = None):
        self._c = httpx.AsyncClient(
            base_url=base_url.rstrip("/"), timeout=15, transport=transport,
            headers={"Authorization": "Bearer " + token},
        )

    async def get(self, path: str, **params: Any) -> Any:
        r = await self._c.get("/api/edge" + path, params=params or None)
        r.raise_for_status()
        return r.json()

    async def aclose(self) -> None:
        await self._c.aclose()
