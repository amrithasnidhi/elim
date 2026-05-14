from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Optional

from database import get_db
from dependencies import get_current_user_id

router = APIRouter(
    prefix="/feedback",
    tags=["feedback"],
    responses={401: {"description": "Not authenticated"}},
)


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

    signal = float(score)
    signal_strength = 1.0
    if time_to_rate_sec < 10 and score > 0:
        signal_strength = 1.2
    if multi_style:
        signal_strength *= 2.0

    if style not in weights:
        weights[style] = 0.33

    weights[style] = (0.8 * weights[style]) + (0.2 * signal * signal_strength)

    for k in weights:
        weights[k] = max(0.01, weights[k])

    total = sum(weights.values())
    weights = {k: round(v / total, 6) for k, v in weights.items()}

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"style_weights": weights}},
    )
    return weights


@router.post(
    "/rate",
    summary="Rate an explanation",
    description="Submit feedback on an explanation to improve future personalization.",
)
async def rate_explanation(body: RateRequest, background_tasks: BackgroundTasks, user_id: str = Depends(get_current_user_id)):
    """
    Rate an explanation and update learning preferences.

    **Effects:**
    - Updates style weights based on feedback
    - Records spaced repetition data (SM-2 algorithm)
    - Adjusts pace/difficulty if needed
    - Calculates time-to-rate for engagement metrics

    **Score values:**
    - `-1`: Not helpful
    - `0`: Neutral
    - `1`: Helpful
    """
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

    try:
        display_time = datetime.fromisoformat(body.display_time_utc.replace("Z", "+00:00"))
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

    is_multi = body.multi_style or history.get("multi_style", False)
    updated_weights = await update_style_weights(
        db, user_id, history["style_used"], body.score, time_to_rate_sec, multi_style=is_multi
    )

    async def _update_metaphor(uid: str, hid: str, score: int):
        try:
            from services.metaphor_fingerprint import update_fingerprint
            history_doc = await db.history.find_one({"_id": ObjectId(hid)})
            if not history_doc:
                return
            await update_fingerprint(
                user_id=uid,
                domain=history_doc.get("metaphor_domain", "none"),
                feedback_score=score,
                secondary_domain=history_doc.get("metaphor_domain_secondary"),
                confidence=history_doc.get("metaphor_confidence", 1.0),
            )
        except Exception:
            pass

    background_tasks.add_task(_update_metaphor, user_id, body.history_id, body.score)

    # Pace Detector — auto-adjust difficulty based on rolling avg rating speed
    pace_result = None
    try:
        from services.pace_detector import run_pace_detector
        pace_result = await run_pace_detector(db, user_id, time_to_rate_sec)
    except Exception:
        pass

    # Spaced Repetition — record review using SM-2 (score>0 ⟹ recalled, else forgot)
    sr_result = None
    try:
        from services.spaced_rep import record_review
        sr_score = 1 if body.score >= 0 else 0
        sr_result = await record_review(db, user_id, body.history_id, sr_score)
    except Exception:
        pass

    return {
        "updated_weights": updated_weights,
        "time_to_rate_sec": time_to_rate_sec,
        "pace": pace_result,
        "spaced_rep": sr_result,
    }


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
