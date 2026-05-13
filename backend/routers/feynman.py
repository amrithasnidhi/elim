import json
import re
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from database import get_db
from dependencies import get_current_user_id
from services.llm_service import call_llm_simple

router = APIRouter(prefix="/feynman", tags=["feynman"])

# ── Grading prompt ────────────────────────────────────────────────────────────

_GRADING_PROMPT = """You are an expert educational evaluator running the Feynman Technique test.

The student studied this explanation of "{topic}" (difficulty {difficulty}/5):
---ORIGINAL---
{original}
---END---

The student then explained it in their own words:
---STUDENT---
{student}
---END---

Evaluate with precision. Return ONLY a valid JSON object — no markdown, no preamble:
{{
  "score": <integer 0-100>,
  "grade": "<MASTERED|SOLID|PARTIAL|FUZZY|MISSING>",
  "understood": ["<concept correctly grasped>"],
  "gaps": [
    {{
      "concept": "<specific concept missed or wrong>",
      "what_they_missed": "<1-2 sentences: what exactly was missing or incorrect>",
      "mini_explanation": "<2-4 sentences: targeted re-explanation of this gap only, at difficulty {difficulty}/5>",
      "severity": "<critical|minor|edge_case>"
    }}
  ],
  "confidence_mismatch": <true if student sounded confident but was wrong, else false>,
  "summary": "<one honest, specific sentence of feedback>",
  "encouragement": "<one genuinely motivating sentence about what they got right>"
}}

Rubric:
MASTERED (90-100): Core mechanism + edge cases + own words
SOLID (75-89): Core correct, small gaps
PARTIAL (50-74): Gets the gist, misses important mechanisms
FUZZY (25-49): Fragments only, significant confusion
MISSING (0-24): Fundamental misunderstanding or near-empty

Be honest. A deserved 60 beats a dishonest 90. Return ONLY the JSON."""


def _score_to_grade(score: int) -> str:
    if score >= 90: return "MASTERED"
    if score >= 75: return "SOLID"
    if score >= 50: return "PARTIAL"
    if score >= 25: return "FUZZY"
    return "MISSING"


def _grade_color(grade: str) -> str:
    return {"MASTERED": "#00FF9D", "SOLID": "#7C6EF0",
            "PARTIAL": "#F5A623", "FUZZY": "#D85A30", "MISSING": "#E24B4A"}.get(grade, "#5A8FAA")


async def _update_mastery(db, user_id: str, topic: str, score: int):
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    mastery = user.get("topic_mastery", {})
    key = re.sub(r"[^a-z0-9_]", "_", topic.lower().strip())[:50]
    existing = mastery.get(key, {"score": 50, "sessions": 0})
    new_score = round(0.7 * existing["score"] + 0.3 * score)
    sessions = existing["sessions"] + 1
    diff_rec = existing.get("difficulty_recommended")
    if sessions >= 3 and new_score >= 85:
        diff_rec = "increase"
    elif sessions >= 2 and new_score <= 35:
        diff_rec = "decrease"
    mastery[key] = {"score": new_score, "sessions": sessions,
                    "last_tested": datetime.now(timezone.utc),
                    "difficulty_recommended": diff_rec}
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"topic_mastery": mastery}})


async def _update_gaps(db, user_id: str, topic: str, gaps: list):
    if not gaps:
        return
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    gap_history = user.get("persistent_gaps", {})
    for gap in gaps:
        key = re.sub(r"[^a-z0-9_]", "_", gap.get("concept", "").lower())[:80]
        if not key:
            continue
        existing = gap_history.get(key, {"count": 0, "topic": topic})
        existing["count"] += 1
        existing["topic"] = topic
        existing["last_seen"] = datetime.now(timezone.utc)
        existing["persistent"] = existing["count"] >= 2
        gap_history[key] = existing
    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"persistent_gaps": gap_history}})


# ── Models ────────────────────────────────────────────────────────────────────

class SubmitRequest(BaseModel):
    history_id: str
    user_explanation: str = Field(..., min_length=10, max_length=6000)
    input_method: str = Field("text")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/submit")
async def submit_feynman(body: SubmitRequest, user_id: str = Depends(get_current_user_id)):
    db = get_db()

    try:
        history = await db.history.find_one({"_id": ObjectId(body.history_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid history_id")

    if not history:
        raise HTTPException(status_code=404, detail="Explanation session not found")
    if str(history["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not your session")

    original = history.get("explanation", "")
    if not original:
        raise HTTPException(status_code=400, detail="No original explanation found")

    topic = history.get("topic", "this topic")
    difficulty = history.get("difficulty_used", 2)

    prompt = _GRADING_PROMPT.format(
        topic=topic,
        difficulty=difficulty,
        original=original[:5000],
        student=body.user_explanation[:4000],
    )

    try:
        raw = await call_llm_simple(prompt, model="claude-sonnet-4-5", max_tokens=2000)
        raw = re.sub(r"^```(?:json)?\s*", "", raw.strip())
        raw = re.sub(r"\s*```$", "", raw)
        grading = json.loads(raw)
    except json.JSONDecodeError:
        # Try to extract JSON from response if LLM added text around it
        match = re.search(r"\{[\s\S]+\}", raw)
        if match:
            try:
                grading = json.loads(match.group())
            except Exception:
                raise HTTPException(status_code=502, detail="Grading model returned invalid JSON")
        else:
            raise HTTPException(status_code=502, detail="Grading model returned invalid JSON")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Grading failed: {e}")

    score = max(0, min(100, int(grading.get("score", 50))))
    grade = grading.get("grade", _score_to_grade(score))

    doc = {
        "user_id": ObjectId(user_id),
        "history_id": ObjectId(body.history_id),
        "topic": topic,
        "difficulty": difficulty,
        "user_explanation": body.user_explanation,
        "input_method": body.input_method,
        "score": score,
        "grade": grade,
        "grade_color": _grade_color(grade),
        "understood": grading.get("understood", []),
        "gaps": grading.get("gaps", []),
        "confidence_mismatch": bool(grading.get("confidence_mismatch", False)),
        "summary": grading.get("summary", ""),
        "encouragement": grading.get("encouragement", ""),
        "created_at": datetime.now(timezone.utc),
    }
    inserted = await db.feynman_results.insert_one(doc)
    session_id = str(inserted.inserted_id)

    await db.history.update_one(
        {"_id": ObjectId(body.history_id)},
        {"$set": {"feynman_score": score, "feynman_grade": grade,
                  "feynman_session_id": session_id,
                  "feynman_tested_at": datetime.now(timezone.utc)}},
    )

    await _update_mastery(db, user_id, topic, score)
    await _update_gaps(db, user_id, topic, grading.get("gaps", []))

    return {
        "score": score,
        "grade": grade,
        "grade_color": _grade_color(grade),
        "understood": grading.get("understood", []),
        "gaps": grading.get("gaps", []),
        "confidence_mismatch": bool(grading.get("confidence_mismatch", False)),
        "summary": grading.get("summary", ""),
        "encouragement": grading.get("encouragement", ""),
        "feynman_session_id": session_id,
    }


@router.get("/history")
async def feynman_history(
    limit: int = Query(default=20, le=50),
    topic: Optional[str] = Query(default=None),
    user_id: str = Depends(get_current_user_id),
):
    db = get_db()
    query: dict = {"user_id": ObjectId(user_id)}
    if topic:
        query["topic"] = {"$regex": topic, "$options": "i"}
    cursor = db.feynman_results.find(query).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [
        {
            "feynman_session_id": str(d["_id"]),
            "history_id": str(d["history_id"]),
            "topic": d["topic"],
            "score": d["score"],
            "grade": d["grade"],
            "grade_color": d.get("grade_color", "#5A8FAA"),
            "gaps_count": len(d.get("gaps", [])),
            "created_at": d["created_at"],
        }
        for d in docs
    ]


@router.get("/mastery")
async def feynman_mastery(user_id: str = Depends(get_current_user_id)):
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    topic_mastery = user.get("topic_mastery", {})

    results = []
    for key, data in topic_mastery.items():
        sessions_cursor = db.feynman_results.find(
            {"user_id": ObjectId(user_id), "topic": {"$regex": key.replace("_", " "), "$options": "i"}}
        ).sort("created_at", 1)
        sessions = await sessions_cursor.to_list(length=50)
        if not sessions:
            continue
        trend = [{"score": s["score"], "created_at": s["created_at"].isoformat()} for s in sessions]
        first = trend[0]["score"] if trend else data["score"]
        results.append({
            "topic": key.replace("_", " "),
            "sessions": trend,
            "current_score": data["score"],
            "improvement": data["score"] - first,
            "difficulty_recommended": data.get("difficulty_recommended"),
        })

    return sorted(results, key=lambda x: x["current_score"], reverse=True)


@router.get("/persistent-gaps")
async def persistent_gaps(user_id: str = Depends(get_current_user_id)):
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    gap_history = user.get("persistent_gaps", {})
    result = [
        {
            "concept": concept.replace("_", " "),
            "topic": data["topic"],
            "missed": data["count"],
            "last_seen": data.get("last_seen"),
        }
        for concept, data in gap_history.items()
        if data.get("persistent")
    ]
    return sorted(result, key=lambda x: x["missed"], reverse=True)
