from bson import ObjectId
from services.dependency_graph import get_node


async def get_recommendations(db, user_id: str, limit: int = 6) -> list[dict]:
    """
    Score candidate topics by:
    - +2 per appearance in next_topics of an explored topic (high intent)
    - +1 per appearance in related topics
    - +1 per appearance in cluster-peers' recent history (social signal)
    Excludes already-explored topics.
    """
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"topic_history": 1, "cluster_id": 1})
    if not user:
        return []

    explored = set(t.lower() for t in user.get("topic_history", []))
    cluster_id = user.get("cluster_id")

    scores: dict[str, int] = {}

    def _add(topic: str, pts: int):
        t = topic.lower()
        if t not in explored:
            scores[t] = scores.get(t, 0) + pts

    for raw in user.get("topic_history", [])[-20:]:
        node = get_node(raw)
        for t in node.get("next_topics", []):
            _add(t, 2)
        for t in node.get("related", []):
            _add(t, 1)

    if cluster_id is not None:
        cursor = db.users.find(
            {"cluster_id": cluster_id, "_id": {"$ne": ObjectId(user_id)}},
            {"topic_history": 1},
        ).limit(20)
        async for peer in cursor:
            for t in peer.get("topic_history", [])[-10:]:
                _add(t, 1)

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [{"topic": t, "score": s} for t, s in ranked]
