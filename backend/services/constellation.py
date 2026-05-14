"""
ELIM — Concept Constellation Service
Builds the personal knowledge universe graph for each user.

Node  = one studied topic
Edge  = semantic similarity between topics (cosine > threshold)
Ghost = nearby topic the user hasn't studied yet (unexplored space)

Star properties:
  size       ← Feynman mastery score (bigger = more mastered)
  brightness ← recency (dimmer = studied longer ago)
  color      ← domain classification
  supernova  ← mastery >= 85 AND studied in last 7 days
"""

import asyncio
import os
import re
from datetime import datetime, timezone
from collections import Counter

import numpy as np
from bson import ObjectId

from database import get_db
from services.llm_service import call_llm_simple

DOMAIN_COLORS = {
    "computer_science": "#00E5FF",
    "mathematics":      "#7C6EF0",
    "biology":          "#00FF9D",
    "chemistry":        "#F5A623",
    "physics":          "#B44FE8",
    "history":          "#D85A30",
    "language":         "#D4537E",
    "economics":        "#EF9F27",
    "philosophy":       "#85B7EB",
    "psychology":       "#5DCAA5",
    "general":          "#888780",
}

DOMAIN_CLASSIFY_PROMPT = """Classify this topic into exactly one domain.

Topic: "{topic}"

Domains (pick ONE): computer_science, mathematics, biology, chemistry, physics,
history, language, economics, philosophy, psychology, general

Return ONLY the domain name, nothing else."""

KNOWLEDGE_GRAPH_TOPICS = [
    "binary search", "quicksort", "merge sort", "hash tables", "binary trees",
    "graph traversal", "dynamic programming", "recursion", "Big O notation",
    "linked lists", "stacks and queues", "heaps", "tries", "balanced BSTs",
    "neural networks", "backpropagation", "transformers", "attention mechanism",
    "convolutional networks", "reinforcement learning", "gradient descent",
    "regularisation", "overfitting", "embeddings", "RAG", "fine-tuning",
    "vector databases", "tokenisation", "RLHF",
    "calculus derivatives", "integration", "linear algebra", "matrix multiplication",
    "eigenvalues", "probability theory", "Bayes theorem", "statistics",
    "set theory", "graph theory", "number theory", "differential equations",
    "DNA replication", "protein synthesis", "cell division", "evolution",
    "natural selection", "genetics", "CRISPR", "immunology", "photosynthesis",
    "cellular respiration", "neural synapses", "hormones",
    "Newton laws", "quantum mechanics", "special relativity", "thermodynamics",
    "electromagnetism", "wave-particle duality", "Schrodinger equation",
    "supply and demand", "opportunity cost", "inflation", "monetary policy",
    "game theory", "market equilibrium", "elasticity",
    "cognitive biases", "classical conditioning", "operant conditioning",
    "working memory", "long-term potentiation", "metacognition", "flow state",
]

_embedding_cache: dict[str, list[float]] = {}
EMBEDDING_DIMS = 768


def _gemini_embed_sync(text: str) -> list[float]:
    """Synchronous Gemini embed call — run via asyncio.to_thread."""
    try:
        import google.generativeai as genai
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY not set")
        genai.configure(api_key=api_key)
        result = genai.embed_content(
            model="models/gemini-embedding-001",
            content=text,
            task_type="SEMANTIC_SIMILARITY",
            output_dimensionality=EMBEDDING_DIMS,
        )
        return result["embedding"]
    except Exception:
        rng = np.random.default_rng(abs(hash(text)) % (2**31))
        vec = rng.normal(0, 0.1, EMBEDDING_DIMS).tolist()
        return vec


async def get_embedding(text: str) -> list[float]:
    key = text.lower().strip()[:200]
    if key in _embedding_cache:
        return _embedding_cache[key]
    vec = await asyncio.to_thread(_gemini_embed_sync, key)
    _embedding_cache[key] = vec
    return vec


def cosine_similarity(a: list[float], b: list[float]) -> float:
    av, bv = np.array(a), np.array(b)
    na, nb = np.linalg.norm(av), np.linalg.norm(bv)
    if na == 0 or nb == 0:
        return 0.0
    return float(np.dot(av, bv) / (na * nb))


async def classify_domain(topic: str) -> str:
    try:
        domain = await call_llm_simple(
            prompt=DOMAIN_CLASSIFY_PROMPT.format(topic=topic),
            model="claude-haiku-4-5-20251001",
            max_tokens=20,
        )
        domain = domain.strip().lower()
        return domain if domain in DOMAIN_COLORS else "general"
    except Exception:
        return "general"


def _topic_key(topic: str) -> str:
    """Match the exact key format used by feynman.py."""
    return re.sub(r"[^a-z0-9_]", "_", topic.lower().strip())[:50]


def _estimate_score(history_entries: list[dict], topic: str) -> int:
    """
    Estimate mastery from feedback history when no Feynman score exists.
    - 0 sessions → 20 (barely started)
    - sessions + positive feedback → scales up to ~75
    """
    relevant = [
        h for h in history_entries
        if h.get("topic", "").lower() == topic.lower()
    ]
    if not relevant:
        return 20

    n = len(relevant)
    rated = [h for h in relevant if h.get("feedback_score") not in (None, 0)]
    pos   = sum(1 for h in rated if h.get("feedback_score", 0) > 0)
    neg   = sum(1 for h in rated if h.get("feedback_score", 0) < 0)

    base  = min(45, 20 + n * 5)           # more sessions → higher base
    bonus = pos * 8 - neg * 10            # positive ratings add, negative subtract
    return max(10, min(75, base + bonus))


async def build_node(
    topic: str,
    mastery_data: dict,
    history_entries: list[dict],
) -> dict:
    key     = _topic_key(topic)
    mastery = mastery_data.get(key, {})

    if mastery:
        score    = mastery.get("score", 50)
        sessions = mastery.get("sessions", 1)
    else:
        score    = _estimate_score(history_entries, topic)
        sessions = len([h for h in history_entries if h.get("topic", "").lower() == topic.lower()])

    relevant = [h for h in history_entries if h.get("topic", "").lower() == topic.lower()]
    last_studied = None
    if relevant:
        dates = [h["created_at"] for h in relevant if h.get("created_at")]
        if dates:
            last_studied = max(dates)

    days_ago = 0
    if last_studied:
        ts = last_studied if last_studied.tzinfo else last_studied.replace(tzinfo=timezone.utc)
        days_ago = max(0, (datetime.now(timezone.utc) - ts).days)

    brightness  = max(0.3, 1.0 - (days_ago / 90) * 0.7)
    size        = 8 + (score / 100) * 24
    is_supernova = score >= 85 and days_ago <= 7

    domain, embedding = await asyncio.gather(
        classify_domain(topic),
        get_embedding(topic),
    )

    return {
        "id":           topic_key,
        "topic":        topic,
        "domain":       domain,
        "color":        DOMAIN_COLORS.get(domain, DOMAIN_COLORS["general"]),
        "score":        score,
        "sessions":     sessions,
        "size":         round(size, 1),
        "brightness":   round(brightness, 2),
        "days_ago":     days_ago,
        "last_studied": last_studied.isoformat() if last_studied else None,
        "is_supernova": is_supernova,
        "feynman_score":mastery.get("score"),
        "improvement":  0,
        "embedding":    embedding,
        "is_ghost":     False,
    }


async def find_ghost_stars(
    studied_nodes: list[dict],
    max_ghosts: int = 15,
    similarity_threshold: float = 0.50,
    ghost_ceiling: float = 0.80,
) -> list[dict]:
    studied_topics = {n["topic"].lower() for n in studied_nodes}

    # Embed candidates in batches of 10 to avoid rate limits
    candidates = [t for t in KNOWLEDGE_GRAPH_TOPICS if t.lower() not in studied_topics]
    candidate_embeds = []
    for i in range(0, len(candidates), 10):
        batch = candidates[i:i + 10]
        batch_vecs = await asyncio.gather(*[get_embedding(t) for t in batch])
        candidate_embeds.extend(batch_vecs)

    ghosts = []
    for topic, embedding in zip(candidates, candidate_embeds):
        max_sim     = 0.0
        closest     = None
        for node in studied_nodes:
            sim = cosine_similarity(node["embedding"], embedding)
            if sim > max_sim:
                max_sim = sim
                closest = node["topic"]

        if similarity_threshold <= max_sim <= ghost_ceiling:
            domain = await classify_domain(topic)
            ghosts.append({
                "id":           topic.replace(" ", "_"),
                "topic":        topic,
                "domain":       domain,
                "color":        DOMAIN_COLORS.get(domain, DOMAIN_COLORS["general"]),
                "score":        0,
                "sessions":     0,
                "size":         5,
                "brightness":   0.2,
                "days_ago":     None,
                "last_studied": None,
                "is_supernova": False,
                "feynman_score":None,
                "improvement":  0,
                "embedding":    embedding,
                "is_ghost":     True,
                "ghost_sim":    round(max_sim, 3),
                "ghost_closest":closest,
            })

    ghosts.sort(key=lambda g: g["ghost_sim"], reverse=True)
    return ghosts[:max_ghosts]


def build_edges(
    nodes: list[dict],
    min_similarity: float = 0.45,
    max_edges_per_node: int = 4,
) -> list[dict]:
    edges = []
    edge_counts: dict[str, int] = {}

    pairs = []
    n = len(nodes)
    for i in range(n):
        for j in range(i + 1, n):
            sim = cosine_similarity(nodes[i]["embedding"], nodes[j]["embedding"])
            if sim >= min_similarity:
                pairs.append((sim, nodes[i]["id"], nodes[j]["id"]))

    pairs.sort(reverse=True)
    for sim, id_a, id_b in pairs:
        if edge_counts.get(id_a, 0) >= max_edges_per_node:
            continue
        if edge_counts.get(id_b, 0) >= max_edges_per_node:
            continue
        edges.append({
            "source":     id_a,
            "target":     id_b,
            "similarity": round(sim, 3),
            "strength":   round((sim - min_similarity) / (1 - min_similarity), 3),
        })
        edge_counts[id_a] = edge_counts.get(id_a, 0) + 1
        edge_counts[id_b] = edge_counts.get(id_b, 0) + 1

    return edges


def _strip(n: dict) -> dict:
    return {k: v for k, v in n.items() if k != "embedding"}


async def build_constellation(user_id: str) -> dict:
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"nodes": [], "edges": [], "stats": {}, "generated_at": None}

    mastery_data  = user.get("topic_mastery", {})
    topic_history = user.get("topic_history", [])

    if not topic_history:
        return {
            "nodes":        [],
            "edges":        [],
            "stats":        {"total_topics": 0, "mastered": 0, "domains": {}, "ghost_topics": 0, "supernovas": [], "avg_score": 0},
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    history_entries = await db.history.find(
        {"user_id": ObjectId(user_id)},
        {"topic": 1, "created_at": 1},
    ).sort("created_at", -1).limit(500).to_list(length=500)

    # Deduplicate topics
    seen: set[str] = set()
    unique_topics: list[str] = []
    for h in history_entries:
        t = h.get("topic", "").strip()
        if t and t.lower() not in seen:
            seen.add(t.lower())
            unique_topics.append(t)
    for t in topic_history:
        if t and t.lower() not in seen:
            seen.add(t.lower())
            unique_topics.append(t)

    # Build nodes in batches of 8
    nodes = []
    for i in range(0, len(unique_topics), 8):
        batch = unique_topics[i:i + 8]
        batch_nodes = await asyncio.gather(*[
            build_node(topic, mastery_data, history_entries)
            for topic in batch
        ])
        nodes.extend(batch_nodes)

    ghost_nodes = await find_ghost_stars(nodes)
    all_nodes   = nodes + ghost_nodes
    edges       = build_edges(all_nodes, min_similarity=0.42)

    domains_count: dict[str, int] = {}
    for nd in nodes:
        d = nd["domain"]
        domains_count[d] = domains_count.get(d, 0) + 1

    return {
        "nodes":        [_strip(n) for n in all_nodes],
        "edges":        edges,
        "stats": {
            "total_topics": len(nodes),
            "ghost_topics": len(ghost_nodes),
            "mastered":     sum(1 for n in nodes if n["score"] >= 90),
            "domains":      domains_count,
            "supernovas":   [n["topic"] for n in nodes if n["is_supernova"]],
            "avg_score":    round(sum(n["score"] for n in nodes) / max(len(nodes), 1)),
        },
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
