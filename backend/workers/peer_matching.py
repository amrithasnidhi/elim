import asyncio
from workers.celery_app import celery_app


@celery_app.task(bind=True, name="workers.peer_matching.run_peer_matching")
def run_peer_matching(self):
    asyncio.run(_do_peer_matching())


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
