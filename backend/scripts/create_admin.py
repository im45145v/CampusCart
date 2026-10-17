"""Promote an existing user to administrator: python -m scripts.create_admin you@example.com"""
import asyncio
import sys

from app import db
from app.audit import record


async def main(email: str) -> None:
    database = await db.connect()
    user = await database.users.find_one({"email": email.strip().lower()})
    if not user:
        raise SystemExit("No such user; register through the app first.")
    await database.users.update_one({"_id": user["_id"]}, {"$addToSet": {"roles": "admin"}})
    await record(database, "cli", "user.promote_admin", "user", user["_id"])
    print(f"{email} is now an administrator")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    asyncio.run(main(sys.argv[1]))
