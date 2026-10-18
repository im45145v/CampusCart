import asyncio
import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import db
from .config import get_settings
from .routers import (
    admin,
    ai,
    auth,
    chat,
    edge,
    home,
    me,
    orders,
    plans,
    products,
    reports,
    reviews,
    stores,
    uploads,
    vouchers,
    wallet,
    ws,
)

log = logging.getLogger(__name__)


async def _seed_demo() -> None:
    """Load the campus stalls once the process is accepting requests. Safe to run again."""
    port = os.environ.get("PORT", "8000")
    os.environ["CAMPUSCART_SEED_API"] = f"http://127.0.0.1:{port}"
    from scripts import seed_campus_stores as seed

    seed.API = os.environ["CAMPUSCART_SEED_API"]
    await asyncio.sleep(2)
    try:
        await seed.seed()
    except Exception:
        log.exception("demo seed failed")
        return
    log.info("demo catalogue seeded")
    log.error("demo catalogue was not seeded")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    get_settings().validate_for_runtime()
    if db.holder.db is None:
        await db.connect()
    if os.environ.get("SEED_DEMO", "").lower() in {"1", "true", "yes"}:
        asyncio.create_task(_seed_demo())
    yield


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(title="CampusCart API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=s.cors_origin_list, allow_credentials=False,
        allow_methods=["*"], allow_headers=["*"],
    )
    for r in (home, auth, stores, products, orders, me, chat, ws, reviews, reports, admin, ai,
              uploads, edge, wallet, plans, vouchers):
        app.include_router(r.router)
    Path(s.upload_dir).mkdir(parents=True, exist_ok=True)
    app.mount("/uploads", StaticFiles(directory=s.upload_dir), name="uploads")
    return app


app = create_app()
