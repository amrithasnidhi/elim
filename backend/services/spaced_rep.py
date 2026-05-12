from datetime import datetime, timezone, timedelta
from bson import ObjectId


def _sm2(n: int, ef: float, score: int) -> tuple[int, float, int]:
    """
    SM-2 algorithm.
    score: 1 = recalled correctly, 0 = forgot
    Returns (interval_days, new_ef, new_n).
    """
    if score == 0:
        return 1, max(1.3, ef - 0.2), 0

    quality = score * 5          # map 0/1 → 0/5
    ef = max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))

    if n == 0:
        interval = 1
    elif n == 1:
        interval = 6
    else:
        interval = round(n * ef)

    return interval, round(ef, 4), n + 1


async def record_review(db, user_id: str, history_id: str, score: int) -> dict:
    """
    Upsert a spaced-repetition entry for the topic in this history item.
    score: 1 = thumbs-up / understood, 0 = thumbs-down / confused
    """
    hist = await db.history.find_one({"_id": ObjectId(history_id)}, {"topic": 1})
    if not hist:
        return {}

    topic = hist["topic"]
    now = datetime.now(timezone.utc)
    uid = ObjectId(user_id)

    existing = await db.spaced_rep.find_one({"user_id": uid, "topic": topic})
    n = existing.get("repetition", 0) if existing else 0
    ef = existing.get("easiness_factor", 2.5) if existing else 2.5

    interval_days, new_ef, new_n = _sm2(n, ef, score)
    next_review = now + timedelta(days=interval_days)

    await db.spaced_rep.update_one(
        {"user_id": uid, "topic": topic},
        {"$set": {
            "user_id": uid,
            "topic": topic,
            "history_id": ObjectId(history_id),
            "repetition": new_n,
            "easiness_factor": new_ef,
            "interval_days": interval_days,
            "next_review": next_review,
            "last_reviewed": now,
        }},
        upsert=True,
    )
    return {"topic": topic, "next_review": next_review.isoformat(), "interval_days": interval_days}


async def get_due_items(db, user_id: str) -> list[dict]:
    """Return topics whose next_review is today or earlier."""
    now = datetime.now(timezone.utc)
    uid = ObjectId(user_id)
    items = []
    async for doc in db.spaced_rep.find(
        {"user_id": uid, "next_review": {"$lte": now}},
        sort=[("next_review", 1)],
    ):
        items.append({
            "topic": doc["topic"],
            "next_review": doc["next_review"].isoformat(),
            "interval_days": doc.get("interval_days", 1),
            "repetition": doc.get("repetition", 0),
            "easiness_factor": doc.get("easiness_factor", 2.5),
        })
    return items
