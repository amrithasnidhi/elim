import asyncio
import json
import os
from datetime import datetime, timezone

from workers.celery_app import celery_app


@celery_app.task(bind=True, name="workers.peer_matching.run_peer_matching")
def run_peer_matching(self):
    asyncio.run(_do_peer_matching())


@celery_app.task(name="workers.peer_matching.sweep_peer_queues")
def sweep_peer_queues():
    """
    10-minute beat task: scans Redis match queues, creates sessions for any
    topic with both a waiting teacher and a waiting learner, and stores
    in-app notifications for both. Also evicts stale (>1h) match requests.
    """
    asyncio.run(_do_sweep_queues())


async def _do_sweep_queues():
    try:
        import redis.asyncio as aioredis
    except Exception:
        return

    from bson import ObjectId
    from database import connect_db, get_db
    from routers.peer_teaching import find_or_create_match, rk_match, _topic_label

    await connect_db()
    db = get_db()

    url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    r = aioredis.from_url(url, encoding="utf-8", decode_responses=True)

    try:
        teacher_keys = await r.keys("elim:match:teacher:*")
        for key in teacher_keys:
            topic_key = key.replace("elim:match:teacher:", "")
            learner_key = f"elim:match:learner:{topic_key}"
            t_n = await r.llen(key)
            l_n = await r.llen(learner_key)
            if t_n == 0 or l_n == 0:
                continue

            teacher_raw = await r.lpop(key)
            learner_raw = await r.lpop(learner_key)
            if not teacher_raw or not learner_raw:
                if teacher_raw:
                    await r.rpush(key, teacher_raw)
                if learner_raw:
                    await r.rpush(learner_key, learner_raw)
                continue

            teacher_data = json.loads(teacher_raw)
            learner_data = json.loads(learner_raw)
            teacher_id = teacher_data["user_id"]
            learner_id = learner_data["user_id"]

            if teacher_id == learner_id:
                await r.rpush(learner_key, learner_raw)
                await r.rpush(key, teacher_raw)
                continue

            topic = teacher_data.get("topic") or _topic_label(topic_key)

            # Re-queue the teacher first then call find_or_create_match as the
            # learner so the standard matchmaker creates the session deterministically.
            await r.rpush(key, teacher_raw)
            result = await find_or_create_match(
                user_id=learner_id, topic=topic, role="learner", max_wait=60,
            )

            if result.get("status") == "matched":
                session_id = result["session_id"]
                now = datetime.now(timezone.utc)
                await db.notifications.insert_many([
                    {"user_id": teacher_id, "type": "peer_match", "topic": topic,
                     "role": "teacher", "session_id": session_id, "created_at": now, "read": False},
                    {"user_id": learner_id, "type": "peer_match", "topic": topic,
                     "role": "learner", "session_id": session_id, "created_at": now, "read": False},
                ])

        # Evict match requests older than 1 hour
        for key in await r.keys("elim:match:*"):
            for entry in await r.lrange(key, 0, -1):
                try:
                    data = json.loads(entry)
                    requested = datetime.fromisoformat(data.get("requested_at", "2000-01-01T00:00:00+00:00").replace("Z", "+00:00"))
                    if requested.tzinfo is None:
                        requested = requested.replace(tzinfo=timezone.utc)
                    if (datetime.now(timezone.utc) - requested).total_seconds() > 3600:
                        await r.lrem(key, 1, entry)
                except Exception:
                    continue
    finally:
        try:
            await r.aclose()
        except Exception:
            pass


async def _do_peer_matching():
    """K-means (k=3) on style_weight vectors. Assigns cluster_id to each user."""
    from bson import ObjectId
    from database import connect_db, get_db

    await connect_db()
    db = get_db()

    users = []
    async for u in db.users.find({}, {"_id": 1, "style_weights": 1}):
        w = u.get("style_weights", {"analogy": 0.33, "step-by-step": 0.33, "code-based": 0.34})
        vec = [w.get("analogy", 0.33), w.get("step-by-step", 0.33), w.get("code-based", 0.34)]
        users.append((str(u["_id"]), vec))

    if not users:
        return

    if len(users) < 3:
        for uid, _ in users:
            await db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"cluster_id": 0}})
        return

    try:
        import numpy as np
        from sklearn.cluster import KMeans

        X = np.array([v for _, v in users])
        km = KMeans(n_clusters=3, n_init=10, random_state=42)
        labels = km.fit_predict(X)
        for (uid, _), label in zip(users, labels):
            await db.users.update_one(
                {"_id": ObjectId(uid)},
                {"$set": {"cluster_id": int(label)}},
            )
    except Exception:
        # sklearn not installed — assign by dominant style position as a cheap proxy
        for uid, vec in users:
            cluster = int(vec.index(max(vec)))
            await db.users.update_one({"_id": ObjectId(uid)}, {"$set": {"cluster_id": cluster}})
