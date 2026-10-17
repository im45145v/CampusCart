import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request


class SlidingWindowLimiter:
    """In-memory limiter (per process). Use a shared store if scaling horizontally."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str, limit: int, window_s: float) -> bool:
        t = time.monotonic()
        q = self._hits[key]
        while q and q[0] <= t - window_s:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(t)
        return True

    def reset(self) -> None:
        self._hits.clear()


limiter = SlidingWindowLimiter()


def enforce(request: Request, scope: str, limit: int, window_s: int) -> None:
    host = request.client.host if request.client else "unknown"
    if not limiter.allow(f"{scope}:{host}", limit, window_s):
        raise HTTPException(429, "Too many requests, slow down")
