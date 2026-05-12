from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Optional

from database import get_db
from dependencies import get_current_user_id

router = APIRouter(prefix="/feedback", tags=["feedback"])


class RateRequest(BaseModel):
    history_id: str
    score: int = Field(..., ge=-1, le=1)
    star_rating: Optional[int] = Field(default=None, ge=1, le=5)
    display_time_utc: str
    multi_style: bool = False  # True when rating from multi-style comparison (2× signal)


async def update_style_weights(db, user_id: str, style: str, score: int,
                                time_to_rate_sec: float, multi_style: bool = False):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return

    weights = dict(user.get("style_weights", {"analogy": 0.33, "step-by-step": 0.33, "code-based": 0.34}))

    # Determine signal strength
    signal = float(score)
    signal_strength = 1.0
    if time_to_rate_sec < 10 and score > 0:
        signal_strength = 1.2  # fast positive = high confidence
    if multi_style:
        signal_strength *= 2.0  # user saw all 3 styles and chose — higher confidence

    if style not in weights:
        weights[style] = 0.33

    weights[style] = (0.8 * weights[style]) + (0.2 * signal * signal_strength)

    # Clamp to avoid negative weights
    for k in weights:
        weights[k] = max(0.01, weights[k])

    # Normalise so all weights sum to exactly 1.0
    total = sum(weights.values())
    weights = {k: round(v / total, 6) for k, v in weights.items()}

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"style_weights": weights}},
    )
    return weights


@router.post("/rate")
async def rate_explanation(body: RateRequest, user_id: str = Depends(get_current_user_id)):
    db = get_db()

    try:
        hist_oid = ObjectId(body.history_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid history_id")

    history = await db.history.find_one({"_id": hist_oid})
    if not history:
        raise HTTPException(status_code=404, detail="History entry not found")
    if str(history["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not your history entry")

    # Compute time_to_rate_sec
    try:
        display_time = datetime.fromisoformat(body.display_time_utc.replace("Z", "+00:00"))
        created_at = history["created_at"]
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        time_to_rate_sec = max(0.0, (datetime.now(timezone.utc) - display_time).total_seconds())
    except Exception:
        time_to_rate_sec = 30.0

    await db.history.update_one(
        {"_id": hist_oid},
        {"$set": {
            "feedback_score": body.score,
            "star_rating": body.star_rating,
            "time_to_rate_sec": time_to_rate_sec,
        }},
    )

    # Use multi_style flag from body, or detect from history document
    is_multi = body.multi_style or history.get("multi_style", False)

    updated_weights = await update_style_weights(
        db, user_id, history["style_used"], body.score, time_to_rate_sec, multi_style=is_multi
    )

    return {"updated_weights": updated_weights, "time_to_rate_sec": time_to_rate_sec}


@router.get("/summary")
async def feedback_summary(days: int = 30, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    since = datetime.now(timezone.utc) - timedelta(days=days)

    cursor = db.history.find({
        "user_id": ObjectId(user_id),
        "created_at": {"$gte": since},
        "feedback_score": {"$ne": 0},
    })

    per_style: dict[str, dict] = {}
    async for doc in cursor:
        s = doc["style_used"]
        if s not in per_style:
            per_style[s] = {"count": 0, "total_score": 0, "positive": 0, "negative": 0}
        per_style[s]["count"] += 1
        per_style[s]["total_score"] += doc["feedback_score"]
        if doc["feedback_score"] > 0:
            per_style[s]["positive"] += 1
        elif doc["feedback_score"] < 0:
            per_style[s]["negative"] += 1

    result = {}
    for s, data in per_style.items():
        result[s] = {
            "count": data["count"],
            "avg_score": round(data["total_score"] / data["count"], 3) if data["count"] else 0,
            "positive": data["positive"],
            "negative": data["negative"],
            "win_rate": round(data["positive"] / data["count"], 3) if data["count"] else 0,
        }

    best_style = max(result, key=lambda k: result[k]["win_rate"]) if result else None
    return {"per_style": result, "best_style": best_style, "days": days}
