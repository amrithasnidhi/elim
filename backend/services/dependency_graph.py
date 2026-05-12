import json
import os

_GRAPH_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "knowledge_graph.json")
_cache: dict | None = None


def _load() -> dict:
    global _cache
    if _cache is not None:
        return _cache
    try:
        with open(_GRAPH_PATH, encoding="utf-8") as f:
            _cache = json.load(f)
    except Exception:
        _cache = {}
    return _cache


def get_node(topic: str) -> dict:
    """Return {prerequisites, next_topics, related} for a topic. Fuzzy-matches if exact not found."""
    graph = _load()
    key = topic.lower().strip()

    if key in graph:
        return graph[key]

    # Partial match
    for node_key, node in graph.items():
        if key in node_key or node_key in key:
            return node

    return {"prerequisites": [], "next_topics": [], "related": []}


def all_topics() -> list[str]:
    return list(_load().keys())
