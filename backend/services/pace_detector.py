from bson import ObjectId


async def run_pace_detector(db, user_id: str, time_to_rate_sec: float) -> dict | None:
    """
    Rolling average of last 10 time_to_rate_sec values.
    - avg < 8s  → content too easy  → bump difficulty up by 1
    - avg > 60s → content too hard  → drop difficulty down by 1
    Returns {rolling_avg_sec, old_difficulty, new_difficulty} or None if no data.
    """
    cursor = (
        db.history
        .find({"user_id": ObjectId(user_id), "time_to_rate_sec": {"$ne": None}}, {"time_to_rate_sec": 1})
        .sort("created_at", -1)
        .limit(10)
    )
    times = []
    async for doc in cursor:
        t = doc.get("time_to_rate_sec")
        if t is not None:
            times.append(float(t))

    if not times:
        return None

    rolling_avg = sum(times) / len(times)

    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"difficulty_level": 1})
    if not user:
        return None

    old = user.get("difficulty_level", 2)
    new = old

    if rolling_avg < 8 and old < 5:
        new = old + 1
    elif rolling_avg > 60 and old > 1:
        new = old - 1

    if new != old:
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"difficulty_level": new}},
        )

    return {"rolling_avg_sec": round(rolling_avg, 1), "old_difficulty": old, "new_difficulty": new}
