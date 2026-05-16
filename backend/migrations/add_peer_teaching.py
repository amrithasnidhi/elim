"""
Peer Teaching Network — Mongo migration.
Run once:  python -m migrations.add_peer_teaching
"""
import asyncio
import os
from pathlib import Path
from dotenv import load_dotenv

_root_env = Path(__file__).parent.parent.parent / ".env"
_backend_env = Path(__file__).parent.parent / ".env"
load_dotenv(_root_env)
load_dotenv(_backend_env)

from motor.motor_asyncio import AsyncIOMotorClient


async def migrate():
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    client = AsyncIOMotorClient(uri)
    db = client.elim

    print("Setting up peer teaching collections...")

    await db.peer_sessions.create_index([("session_id", 1)], unique=True)
    await db.peer_sessions.create_index([("teacher_id", 1), ("created_at", -1)])
    await db.peer_sessions.create_index([("learner_id", 1), ("created_at", -1)])
    await db.peer_sessions.create_index([("topic", 1), ("status", 1)])
    print("  ok  peer_sessions indexes")

    await db.notifications.create_index([("user_id", 1), ("read", 1), ("created_at", -1)])
    await db.notifications.create_index([("created_at", 1)], expireAfterSeconds=2592000)
    print("  ok  notifications indexes (30-day TTL)")

    print("\nMigration complete.")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
