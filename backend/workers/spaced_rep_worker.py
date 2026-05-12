import asyncio
from workers.celery_app import celery_app


@celery_app.task(bind=True, name="workers.spaced_rep_worker.send_reminders")
def send_reminders(self):
    asyncio.run(_update_due_counts())


async def _update_due_counts():
    """Count overdue spaced-rep items per user and cache the count on their document."""
    from datetime import datetime, timezone
    from bson import ObjectId
    from database import connect_db, get_db

    await connect_db()
    db = get_db()
    now = datetime.now(timezone.utc)

    # Aggregate due counts per user
    pipeline = [
        {"$match": {"next_review": {"$lte": now}}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}},
    ]
    async for item in db.spaced_rep.aggregate(pipeline):
        await db.users.update_one(
            {"_id": item["_id"]},
            {"$set": {"spaced_rep_due": item["count"]}},
        )
