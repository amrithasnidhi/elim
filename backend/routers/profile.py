import asyncio
import difflib
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Optional

from database import get_db
from dependencies import get_current_user_id

router = APIRouter(
    prefix="/profile",
    tags=["profile"],
    responses={401: {"description": "Not authenticated"}, 404: {"description": "User not found"}},
)

VALID_STYLES = {"analogy", "step-by-step", "code-based", "auto"}


class StyleUpdateRequest(BaseModel):
    preferred_style: str = Field(..., pattern="^(analogy|step-by-step|code-based|auto)$")
    difficulty_level: int = Field(..., ge=1, le=5)


def _serialize_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "preferred_style": user["preferred_style"],
        "difficulty_level": user["difficulty_level"],
        "style_weights": user["style_weights"],
        "topic_history": user.get("topic_history", []),
        "enabled_mcp_sources": user.get("enabled_mcp_sources", []),
        "spaced_rep_due": user.get("spaced_rep_due", 0),
        "cluster_id": user.get("cluster_id"),
        "created_at": user["created_at"].isoformat() if user.get("created_at") else None,
        "last_active": user["last_active"].isoformat() if user.get("last_active") else None,
    }


@router.get(
    "",
    summary="Get user profile",
    description="Retrieve the authenticated user's profile and learning preferences.",
)
async def get_profile(user_id: str = Depends(get_current_user_id)):
    """
    Get current user's profile including:
    - Learning style preferences and weights
    - Difficulty level
    - Topic history
    - Connected knowledge sources
    - Spaced repetition due count
    """
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize_user(user)


@router.put("/style")
async def update_style(body: StyleUpdateRequest, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    result = await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            "preferred_style": body.preferred_style,
            "difficulty_level": body.difficulty_level,
        }},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    return _serialize_user(user)


@router.get("/history")
async def get_history(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    topic: Optional[str] = Query(default=None),
    user_id: str = Depends(get_current_user_id),
):
    db = get_db()
    query: dict = {"user_id": ObjectId(user_id)}
    if topic:
        query["topic"] = {"$regex": topic, "$options": "i"}

    skip = (page - 1) * limit
    total = await db.history.count_documents(query)
    cursor = db.history.find(query).sort("created_at", -1).skip(skip).limit(limit)

    items = []
    async for doc in cursor:
        items.append({
            "id": str(doc["_id"]),
            "topic": doc["topic"],
            "style_used": doc["style_used"],
            "difficulty_used": doc["difficulty_used"],
            "explanation": doc.get("explanation", ""),
            "feedback_score": doc.get("feedback_score", 0),
            "star_rating": doc.get("star_rating"),
            "time_to_rate_sec": doc.get("time_to_rate_sec"),
            "quality_scores": doc.get("quality_scores"),
            "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "has_more": (skip + limit) < total,
    }


@router.delete("/history/{history_id}")
async def delete_history(history_id: str, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    try:
        oid = ObjectId(history_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid history_id")

    doc = await db.history.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    if str(doc["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not your history entry")

    await db.history.delete_one({"_id": oid})
    return {"deleted": True}


# ── Spaced Repetition ─────────────────────────────────────────────────────────

@router.get("/spaced-rep")
async def get_spaced_rep(user_id: str = Depends(get_current_user_id)):
    """Return topics due for review today (SM-2 schedule)."""
    from services.spaced_rep import get_due_items
    db = get_db()
    items = await get_due_items(db, user_id)
    # Clear the cached due count now that the user has seen the list
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"spaced_rep_due": len(items)}},
    )
    return {"items": items, "count": len(items)}


# ── Concept Dependency Graph ──────────────────────────────────────────────────

@router.get("/dependencies")
async def concept_dependencies(
    topic: str = Query(..., min_length=1),
    user_id: str = Depends(get_current_user_id),
):
    """Return prerequisite / next / related topics for a concept from the knowledge graph."""
    from services.dependency_graph import get_node
    node = get_node(topic)

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)}, {"topic_history": 1})
    explored = set(t.lower() for t in user.get("topic_history", [])) if user else set()

    def _annotate(topics: list) -> list:
        return [{"topic": t, "explored": t.lower() in explored} for t in topics]

    return {
        "topic": topic,
        "prerequisites": _annotate(node["prerequisites"]),
        "next_topics": _annotate(node["next_topics"]),
        "related": _annotate(node["related"]),
    }


# ── Explanation Diff ──────────────────────────────────────────────────────────

@router.get("/history/topic-timeline")
async def topic_timeline(
    topic: str = Query(..., description="Topic to get timeline for"),
    current_id: str = Query(..., description="Current history_id to exclude"),
    user_id: str = Depends(get_current_user_id),
):
    """Get all past explanations for a topic (Explanation Ghost feature)."""
    db = get_db()
    try:
        current_oid = ObjectId(current_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid current_id")

    cursor = db.history.find({
        "user_id": ObjectId(user_id),
        "topic": {"$regex": f"^{topic}$", "$options": "i"},
        "_id": {"$ne": current_oid},
    }).sort("created_at", -1).limit(20)

    items = []
    async for doc in cursor:
        items.append({
            "id": str(doc["_id"]),
            "topic": doc["topic"],
            "style_used": doc["style_used"],
            "difficulty_used": doc["difficulty_used"],
            "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
        })

    return {"items": items, "count": len(items)}


@router.get("/history/diff")
async def history_diff(
    h1: str = Query(..., description="First history_id"),
    h2: str = Query(..., description="Second history_id"),
    user_id: str = Depends(get_current_user_id),
):
    """Unified diff of two explanation versions for the same (or different) topic."""
    db = get_db()
    try:
        oid1, oid2 = ObjectId(h1), ObjectId(h2)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid history_id")

    hist1, hist2 = await asyncio.gather(
        db.history.find_one({"_id": oid1}),
        db.history.find_one({"_id": oid2}),
    )

    for hist, label in [(hist1, "h1"), (hist2, "h2")]:
        if not hist:
            raise HTTPException(status_code=404, detail=f"{label} not found")
        if str(hist["user_id"]) != user_id:
            raise HTTPException(status_code=403, detail=f"Not your history entry ({label})")

    diff_lines = list(difflib.unified_diff(
        hist1["explanation"].splitlines(),
        hist2["explanation"].splitlines(),
        fromfile=f"Version 1 · {hist1['style_used']} · {hist1['created_at'].strftime('%Y-%m-%d')}",
        tofile=f"Version 2 · {hist2['style_used']} · {hist2['created_at'].strftime('%Y-%m-%d')}",
        lineterm="",
    ))

    return {
        "diff": diff_lines,
        "h1": {
            "id": h1, "topic": hist1["topic"], "style_used": hist1["style_used"],
            "created_at": hist1["created_at"].isoformat(),
        },
        "h2": {
            "id": h2, "topic": hist2["topic"], "style_used": hist2["style_used"],
            "created_at": hist2["created_at"].isoformat(),
        },
    }


# ── Topic Recommendations ─────────────────────────────────────────────────────

@router.get("/recommendations")
async def topic_recommendations(
    limit: int = Query(default=6, ge=1, le=20),
    user_id: str = Depends(get_current_user_id),
):
    """Return personalised topic recommendations based on learning history and cluster peers."""
    from services.topic_recommender import get_recommendations
    db = get_db()
    recs = await get_recommendations(db, user_id, limit=limit)
    return {"recommendations": recs}


# ── Breakthrough Profile (Aha Moment Analysis) ────────────────────────────────

@router.get("/breakthrough-profile")
async def breakthrough_profile(user_id: str = Depends(get_current_user_id)):
    """
    Get user's breakthrough profile based on detected aha moments.

    Returns insights like:
    - Best style for breakthroughs
    - Average turns before understanding clicks
    - Personalized learning recommendations
    """
    from services.aha_detector import get_breakthrough_profile, get_optimal_sequence
    db = get_db()
    profile = await get_breakthrough_profile(db, user_id)
    profile["optimal_sequence"] = await get_optimal_sequence(db, user_id)
    return profile


@router.get("/aha-moments")
async def list_aha_moments(
    limit: int = Query(default=20, ge=1, le=100),
    user_id: str = Depends(get_current_user_id),
):
    """List recent aha moments for visualization."""
    db = get_db()
    cursor = db.aha_moments.find(
        {"user_id": ObjectId(user_id)}
    ).sort("created_at", -1).limit(limit)

    items = []
    async for doc in cursor:
        items.append({
            "id": str(doc["_id"]),
            "history_id": str(doc["history_id"]),
            "turn_number": doc["turn_number"],
            "message": doc["message"],
            "confidence": doc["confidence"],
            "style_used": doc["style_used"],
            "topic": doc["topic"],
            "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
        })

    return {"items": items, "count": len(items)}
