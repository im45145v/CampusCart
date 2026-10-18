from typing import Any

from motor.motor_asyncio import AsyncIOMotorClient

from .config import get_settings

Database = Any


class DbHolder:
    db: Database = None


holder = DbHolder()


def get_db() -> Database:
    if holder.db is None:
        raise RuntimeError("database not initialised")
    return holder.db


async def connect() -> Database:
    settings = get_settings()
    client: Any = AsyncIOMotorClient(settings.mongodb_uri, tz_aware=True)
    holder.db = client[settings.mongodb_db]
    await ensure_indexes(holder.db)
    return holder.db


async def ensure_indexes(db: Database) -> None:
    await db.users.create_index("email", unique=True)
    await db.stores.create_index("owner_id")
    await db.stores.create_index([("status", 1), ("category", 1)])
    await db.products.create_index([("store_id", 1), ("published", 1)])
    await db.products.create_index([("category", 1), ("price_minor", 1)])
    await db.products.create_index("sold_count")
    await db.products.create_index([("featured", 1), ("published", 1)])
    await db.orders.create_index([("buyer_id", 1), ("created_at", -1)])
    await db.orders.create_index([("seller_id", 1), ("status", 1), ("created_at", -1)])
    await db.conversations.create_index("participants")
    await db.conversations.create_index("key", unique=True)
    await db.messages.create_index([("conversation_id", 1), ("seq", 1)], unique=True)
    await db.messages.create_index(
        [("conversation_id", 1), ("sender_id", 1), ("client_id", 1)],
        unique=True,
        partialFilterExpression={"client_id": {"$type": "string"}},
    )
    await db.reviews.create_index("order_id", unique=True)
    await db.reviews.create_index("store_id")
    await db.wallet_ledger.create_index([("user_id", 1), ("created_at", -1)])
    await db.wallet_ledger.create_index([("reason", 1), ("status", 1), ("created_at", -1)])
    await db.wallet_ledger.create_index(
        "transaction_key",
        unique=True,
        partialFilterExpression={"transaction_key": {"$type": "string"}},
    )
    await db.plans.create_index([("store_id", 1), ("active", 1)])
    await db.subscriptions.create_index("active_key", unique=True, sparse=True)
    await db.subscriptions.create_index([("buyer_id", 1), ("created_at", -1)])
    await db.subscriptions.create_index([("store_id", 1), ("status", 1)])
    await db.reports.create_index([("status", 1), ("created_at", -1)])
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.vouchers.create_index("code", unique=True)
    await db.vouchers.create_index([("store_id", 1), ("active", 1)])
    await db.voucher_redemptions.create_index([("voucher_id", 1), ("buyer_id", 1)])
    await db.audit_logs.create_index([("created_at", -1)])
    await db.ws_tickets.create_index("created_at", expireAfterSeconds=120)
    await db.api_tokens.create_index("token_hash", unique=True)
    await db.login_challenges.create_index("email")
    await db.login_challenges.create_index("token_hash", unique=True)
    await db.login_challenges.create_index("expires_at", expireAfterSeconds=0)
