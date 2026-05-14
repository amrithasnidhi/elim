"""
Run once to add indexes for metaphor fingerprinting.
Usage: python -m backend.migrations.add_metaphor_fingerprint
"""

import asyncio
import os

import motor.motor_asyncio
from dotenv import load_dotenv

load_dotenv()


async def migrate():
    client = motor.motor_asyncio.AsyncIOMotorClient(os.getenv("MONGODB_URI", "mongodb://localhost:27017"))
    db = client.elim

    print("Adding metaphor fingerprint indexes...")

    await db.history.create_index([("user_id", 1), ("metaphor_domain", 1)])
    await db.history.create_index([("user_id", 1), ("metaphor_domain", 1), ("feedback_score", 1)])
    print("  history metaphor domain indexes created")

    print("  metaphor_fingerprint embedded in users collection (no new collection needed)")
    print("\nMigration complete.")
    client.close()


if __name__ == "__main__":
    asyncio.run(migrate())
