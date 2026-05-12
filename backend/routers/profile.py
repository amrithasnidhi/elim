from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Optional

from database import get_db
from dependencies import get_current_user_id

router = APIRouter(prefix="/profile", tags=["profile"])

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
        "created_at": user["created_at"].isoformat() if user.get("created_at") else None,
        "last_active": user["last_active"].isoformat() if user.get("last_active") else None,
    }


@router.get("")
async def get_profile(user_id: str = Depends(get_current_user_id)):
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
