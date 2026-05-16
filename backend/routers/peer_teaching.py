"""
ELIM — Peer Teaching Network
─────────────────────────────────────────────────────────────────────────────
Users who mastered a topic (Feynman score >= 85) teach users struggling
(score <= 40). ELIM matches them via Redis queues, facilitates the live
WebSocket chat, extracts a live "concept constellation" during teaching,
runs a Reverse Feynman after the session, and awards the protégé bonus.

Wired in main.py:
  app.include_router(peer_teaching.router)        # /peer/* HTTP routes
  app.include_router(peer_teaching.ws_router)     # /ws/peer/* WebSocket
"""

import asyncio
import json
import os
import random
import re
import uuid
from datetime import datetime, timezone, timedelta
from enum import Enum
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from database import get_db
from dependencies import get_current_user_id
from services.auth import decode_access_token
from services.llm_service import call_llm_simple


router    = APIRouter(prefix="/peer", tags=["peer-teaching"])
ws_router = APIRouter(tags=["peer-teaching-ws"])


# ── Tuning constants ──────────────────────────────────────────────────────────
TEACHER_SCORE_MIN     = 85
LEARNER_SCORE_MAX     = 40
SESSION_TIMEOUT_MIN   = 30
MAX_SESSION_TURNS     = 40
AI_CHECK_EVERY        = 5
CONCEPT_FORGE_EVERY   = 4
MATCH_TTL_SECONDS     = 3600
SESSION_TTL_SECONDS   = 7200

HAIKU = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-4-5"

# Latin mottos for the Whisper Lantern (dark academia flavour)
LATIN_MOTTOS = [
    "docendo discimus",       # we learn by teaching
    "verba volant scripta manent",
    "festina lente",          # make haste slowly
    "ad astra per aspera",
    "non scholae sed vitae discimus",
    "qui docet discit",
]


# ── Topic key helper (matches feynman.py convention) ──────────────────────────
def _topic_key(topic: str) -> str:
    return re.sub(r"[^a-z0-9_]", "_", topic.lower().strip())[:50]


def _topic_label(key: str) -> str:
    return key.replace("_", " ")


# ── Redis lazy connector (matches explain.py convention) ──────────────────────
async def _get_redis():
    try:
        import redis.asyncio as aioredis
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        return aioredis.from_url(url, encoding="utf-8", decode_responses=True)
    except Exception:
        return None


# ── Enums + schemas ───────────────────────────────────────────────────────────
class SessionStatus(str, Enum):
    WAITING   = "waiting"
    ACTIVE    = "active"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class MessageRole(str, Enum):
    TEACHER = "teacher"
    LEARNER = "learner"
    ELIM    = "elim"
    SYSTEM  = "system"


class MatchRequest(BaseModel):
    topic:        str = Field(..., min_length=1, max_length=120)
    role:         str = Field(..., pattern="^(teacher|learner)$")
    max_wait_min: int = Field(60, ge=5, le=240)


class ReverseFeynmanRequest(BaseModel):
    session_id: str
    explanation: str = Field(..., min_length=10, max_length=4000)


# ── Redis key helpers ─────────────────────────────────────────────────────────
def rk_match(topic_key: str, role: str) -> str:
    return f"elim:match:{role}:{topic_key}"


def rk_session(session_id: str) -> str:
    return f"elim:session:{session_id}"


def rk_user_session(user_id: str) -> str:
    return f"elim:user_session:{user_id}"


def rk_user_channel(user_id: str) -> str:
    return f"elim:channel:{user_id}"


# ── Alias generator (galaxy + dark academia hybrid) ───────────────────────────
_ALIAS_ADJ = [
    "Quantum", "Stellar", "Nebula", "Orbital", "Photon", "Vector",
    "Lumen", "Astral", "Cosmic", "Aurelian", "Vesper", "Solstice",
]
_ALIAS_NOUN = [
    "Scholar", "Cartographer", "Mariner", "Cipher", "Archivist",
    "Sage", "Augur", "Pilgrim", "Daedalus", "Polymath", "Voyager",
]


def _generate_alias() -> str:
    return f"{random.choice(_ALIAS_ADJ)}{random.choice(_ALIAS_NOUN)}"


# ── Matching engine ───────────────────────────────────────────────────────────
async def find_or_create_match(
    user_id: str,
    topic: str,
    role: str,
    max_wait: int,
) -> dict:
    r = await _get_redis()
    if not r:
        raise HTTPException(status_code=503, detail="Match queue unavailable — start Redis")

    db = get_db()
    key      = _topic_key(topic)
    opposite = "learner" if role == "teacher" else "teacher"
    opp_q    = rk_match(key, opposite)
    my_q     = rk_match(key, role)
    user_sk  = rk_user_session(user_id)

    existing = await r.get(user_sk)
    if existing:
        return {"status": "already_in_session", "session_id": existing}

    waiting = await r.lpop(opp_q)
    if waiting:
        partner = json.loads(waiting)
        partner_id = partner["user_id"]
        if partner_id == user_id:
            # Don't match yourself — put them back at the tail
            await r.rpush(opp_q, waiting)
            await r.rpush(my_q, json.dumps({
                "user_id": user_id, "topic": topic, "role": role,
                "requested_at": datetime.now(timezone.utc).isoformat(),
            }))
            await r.expire(my_q, MATCH_TTL_SECONDS)
            return {"status": "waiting", "topic": topic, "your_role": role,
                    "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=max_wait)).isoformat()}

        session_id  = str(uuid.uuid4())
        teacher_id  = user_id if role == "teacher" else partner_id
        learner_id  = partner_id if role == "teacher" else user_id

        session_data = {
            "session_id":      session_id,
            "topic":           topic,
            "topic_key":       key,
            "teacher_id":      teacher_id,
            "learner_id":      learner_id,
            "status":          SessionStatus.WAITING,
            "created_at":      datetime.now(timezone.utc).isoformat(),
            "messages":        [],
            "turn_count":      0,
            "teacher_alias":   _generate_alias(),
            "learner_alias":   _generate_alias(),
            "concepts_forged": [],   # live constellation built during chat
            "clarity_history": [],   # list of {turn, score} from AI checks
            "bond_score":      0,    # protégé bond — increments per quality turn
        }
        await r.setex(rk_session(session_id), SESSION_TTL_SECONDS, json.dumps(session_data))
        await r.setex(user_sk, SESSION_TTL_SECONDS, session_id)
        await r.setex(rk_user_session(partner_id), SESSION_TTL_SECONDS, session_id)

        await db.peer_sessions.insert_one({
            "_id":        ObjectId(),
            "session_id": session_id,
            "topic":      topic,
            "topic_key":  key,
            "teacher_id": ObjectId(teacher_id),
            "learner_id": ObjectId(learner_id),
            "status":     SessionStatus.WAITING,
            "created_at": datetime.now(timezone.utc),
        })

        try:
            await r.publish(rk_user_channel(partner_id), json.dumps({
                "event":      "match_found",
                "session_id": session_id,
                "topic":      topic,
                "your_role":  opposite,
            }))
        except Exception:
            pass

        return {"status": "matched", "session_id": session_id, "your_role": role, "topic": topic}

    # No partner — register as waiting
    await r.rpush(my_q, json.dumps({
        "user_id": user_id, "topic": topic, "role": role,
        "requested_at": datetime.now(timezone.utc).isoformat(),
    }))
    await r.expire(my_q, MATCH_TTL_SECONDS)
    return {
        "status":     "waiting",
        "topic":      topic,
        "your_role":  role,
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=max_wait)).isoformat(),
    }


# ── Connection manager (single-process; OK for hackathon) ────────────────────
class ConnectionManager:
    """
    NOTE for production: replace with Redis pub/sub fanout so multiple
    Uvicorn workers can route messages across processes. Single-process
    is intentional here for demo simplicity.
    """
    def __init__(self):
        self.connections: dict[str, dict[str, WebSocket]] = {}

    async def connect(self, session_id: str, user_id: str, ws: WebSocket):
        await ws.accept()
        self.connections.setdefault(session_id, {})[user_id] = ws

    def disconnect(self, session_id: str, user_id: str):
        sess = self.connections.get(session_id, {})
        sess.pop(user_id, None)
        if not sess:
            self.connections.pop(session_id, None)

    async def broadcast(self, session_id: str, message: dict, exclude_user: Optional[str] = None):
        dead = []
        for uid, ws in list(self.connections.get(session_id, {}).items()):
            if uid == exclude_user:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.disconnect(session_id, uid)

    async def send_to(self, session_id: str, user_id: str, message: dict):
        ws = self.connections.get(session_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_json(message)
            except Exception:
                self.disconnect(session_id, user_id)

    def count(self, session_id: str) -> int:
        return len(self.connections.get(session_id, {}))


manager = ConnectionManager()


# ── AI prompts ────────────────────────────────────────────────────────────────
_ACCURACY_PROMPT = """You are silently monitoring a peer teaching session about "{topic}".

Last {n} teacher messages:
{teacher_messages}

Recent learner questions:
{learner_messages}

Return ONLY valid JSON:
{{
  "accuracy_score": <0-100>,
  "clarity_score":  <0-100>,
  "has_critical_error": <true|false>,
  "error_description": "<specific wrong claim, or null>",
  "correction":     "<gentle correction phrased for the teacher to say, or null>",
  "is_stalled":     <true|false>,
  "nudge":          "<question to re-engage the learner, or null>"
}}"""


_CONCEPT_FORGE_PROMPT = """A peer teaching session about "{topic}" is in progress.
Recent teacher messages:
{teacher_messages}

Existing concepts already forged: {existing}

Extract at most ONE NEW concept the teacher just introduced.
A concept is a named idea, mechanism, or principle (not a sentence).
If the teacher introduced no new named concept, return null.

Return ONLY JSON:
{{
  "concept":    "<short concept name, 1-4 words, or null>",
  "summary":    "<one-sentence plain summary, or null>",
  "importance": <0-100>
}}"""


_OPENING_PROMPT = """A peer teaching session about "{topic}" is starting.
Teacher alias: {teacher_alias}.   Learner alias: {learner_alias}.

Write a warm, brief opening (2-3 sentences, under 60 words). Include the Latin
motto "docendo discimus" once, naturally. Tell the teacher to start with the
most fundamental idea. Tell the learner it is safe to say "I don't understand"."""


_GRADE_PROMPT = """Grade the teacher's explanation of "{topic}".

Teacher messages:
{teacher_messages}

Learner questions (signals of unclear points):
{learner_messages}

Return ONLY JSON:
{{
  "overall_score":         <0-100>,
  "clarity_score":         <0-100>,
  "accuracy_score":        <0-100>,
  "analogy_quality":       <0-100>,
  "concepts_covered":      ["<concept>"],
  "concepts_missed":       ["<concept>"],
  "biggest_strength":      "<one specific thing they did well>",
  "biggest_improvement":   "<one specific thing to improve>",
  "teaching_badge_earned": <true if overall_score >= 75>
}}"""


_REVERSE_FEYNMAN_PROMPT = """A learner just finished a peer teaching session about "{topic}".
Their pre-session Feynman score was {pre_score}.

They were taught these concepts: {concepts}

Now grade THEIR explanation back to you (the "reverse Feynman"):
---LEARNER---
{learner_explanation}
---END---

Return ONLY JSON:
{{
  "post_score":  <0-100>,
  "delta":       <post_score minus {pre_score}>,
  "what_stuck":  ["<concept they grasped>"],
  "still_fuzzy": ["<concept still missing or confused>"],
  "feedback":    "<one warm but honest sentence>"
}}"""


# ── AI helpers ────────────────────────────────────────────────────────────────
def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return raw.strip()


async def _ai_json(prompt: str, *, model: str = HAIKU, max_tokens: int = 400) -> Optional[dict]:
    try:
        raw = await call_llm_simple(prompt, model=model, max_tokens=max_tokens)
        return json.loads(_strip_fences(raw))
    except Exception:
        return None


async def check_session_health(
    topic: str,
    teacher_messages: list[str],
    learner_messages: list[str],
) -> dict:
    if len(teacher_messages) < 2:
        return {"intervene": False}

    last_n = teacher_messages[-AI_CHECK_EVERY:]
    data = await _ai_json(
        _ACCURACY_PROMPT.format(
            topic=topic, n=len(last_n),
            teacher_messages="\n".join(f"- {m}" for m in last_n),
            learner_messages="\n".join(f"- {m}" for m in learner_messages[-5:]) or "(none yet)",
        ),
        model=HAIKU, max_tokens=400,
    )
    if not data:
        return {"intervene": False, "clarity_score": 80}

    return {
        "intervene":      bool(data.get("has_critical_error") or data.get("is_stalled")),
        "accuracy_score": int(data.get("accuracy_score", 80)),
        "clarity_score":  int(data.get("clarity_score", 80)),
        "has_error":      bool(data.get("has_critical_error", False)),
        "correction":     data.get("correction"),
        "is_stalled":     bool(data.get("is_stalled", False)),
        "nudge":          data.get("nudge"),
    }


async def forge_concept(
    topic: str,
    teacher_messages: list[str],
    existing: list[str],
) -> Optional[dict]:
    """Live extraction — every CONCEPT_FORGE_EVERY turns the AI silently names a concept."""
    if len(teacher_messages) < 2:
        return None
    data = await _ai_json(
        _CONCEPT_FORGE_PROMPT.format(
            topic=topic,
            teacher_messages="\n".join(f"- {m}" for m in teacher_messages[-6:]),
            existing=", ".join(existing) if existing else "(none yet)",
        ),
        model=HAIKU, max_tokens=200,
    )
    if not data or not data.get("concept"):
        return None
    name = (data.get("concept") or "").strip()
    if not name or name.lower() in {n.lower() for n in existing}:
        return None
    return {
        "concept":    name[:80],
        "summary":    (data.get("summary") or "")[:200],
        "importance": max(0, min(100, int(data.get("importance", 50)))),
        "ts":         datetime.now(timezone.utc).isoformat(),
    }


async def grade_teacher(topic: str, teacher_msgs: list[str], learner_msgs: list[str]) -> dict:
    data = await _ai_json(
        _GRADE_PROMPT.format(
            topic=topic,
            teacher_messages="\n".join(f"- {m}" for m in teacher_msgs),
            learner_messages="\n".join(f"- {m}" for m in learner_msgs) or "(none)",
        ),
        model=SONNET, max_tokens=600,
    )
    if data:
        return data
    return {
        "overall_score": 70, "clarity_score": 70, "accuracy_score": 70,
        "analogy_quality": 70, "concepts_covered": [], "concepts_missed": [],
        "biggest_strength": "Completed the session",
        "biggest_improvement": "Keep practising",
        "teaching_badge_earned": False,
    }


async def generate_opening(topic: str, teacher_alias: str, learner_alias: str) -> str:
    try:
        return (await call_llm_simple(
            _OPENING_PROMPT.format(topic=topic, teacher_alias=teacher_alias, learner_alias=learner_alias),
            model=HAIKU, max_tokens=150,
        )).strip()
    except Exception:
        return (
            f"docendo discimus. Welcome — {teacher_alias}, start with the most fundamental idea. "
            f"{learner_alias}, say \"I don't understand\" freely; that is how this works."
        )


# ── Reward engine ─────────────────────────────────────────────────────────────
async def award_teaching_rewards(
    teacher_id: str,
    learner_id: str,
    topic: str,
    session_id: str,
    teacher_grade: dict,
    learner_improvement: int,
):
    db = get_db()
    key = _topic_key(topic)
    rewards = []

    if teacher_grade.get("teaching_badge_earned"):
        await db.users.update_one(
            {"_id": ObjectId(teacher_id)},
            {
                "$inc": {f"topic_mastery.{key}.teaching_sessions": 1},
                "$push": {"badges": {
                    "type":       "teaching_master",
                    "topic":      topic,
                    "score":      teacher_grade.get("overall_score"),
                    "session_id": session_id,
                    "earned_at":  datetime.now(timezone.utc),
                }},
                "$set": {
                    f"topic_mastery.{key}.last_taught":    datetime.now(timezone.utc),
                    f"topic_mastery.{key}.teaching_score": teacher_grade.get("overall_score"),
                },
            },
        )
        rewards.append({"user": "teacher", "type": "teaching_badge", "topic": topic})

    if learner_improvement and learner_improvement >= 15:
        u = await db.users.find_one({"_id": ObjectId(teacher_id)})
        cur = (u or {}).get("topic_mastery", {}).get(key, {}).get("score", 50)
        new = min(100, cur + 5)
        await db.users.update_one(
            {"_id": ObjectId(teacher_id)},
            {"$set": {f"topic_mastery.{key}.score": new}},
        )
        rewards.append({"user": "teacher", "type": "protege_effect", "boost": 5, "delta": learner_improvement})

    await db.peer_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "rewards":             rewards,
            "teacher_grade":       teacher_grade,
            "learner_improvement": learner_improvement,
            "completed_at":        datetime.now(timezone.utc),
            "status":              SessionStatus.COMPLETED,
        }},
    )
    return rewards


# ── HTTP routes ───────────────────────────────────────────────────────────────
@router.post("/match")
async def request_match(req: MatchRequest, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    key = _topic_key(req.topic)
    mastery = (user_doc or {}).get("topic_mastery", {}).get(key, {})
    score = int(mastery.get("score", 50))

    if req.role == "teacher" and score < TEACHER_SCORE_MIN:
        raise HTTPException(
            status_code=400,
            detail=f"Feynman score {score} is below teacher minimum {TEACHER_SCORE_MIN} for '{req.topic}'.",
        )
    if req.role == "learner" and score > LEARNER_SCORE_MAX:
        raise HTTPException(
            status_code=400,
            detail=f"Score {score} is above learner ceiling {LEARNER_SCORE_MAX} — try teaching instead.",
        )

    return await find_or_create_match(user_id, req.topic, req.role, req.max_wait_min)


@router.delete("/match")
async def cancel_match(topic: str, role: str, user_id: str = Depends(get_current_user_id)):
    r = await _get_redis()
    if not r:
        return {"cancelled": False, "reason": "queue offline"}
    key = rk_match(_topic_key(topic), role)
    entries = await r.lrange(key, 0, -1)
    for entry in entries:
        try:
            data = json.loads(entry)
        except Exception:
            continue
        if data.get("user_id") == user_id:
            await r.lrem(key, 1, entry)
            return {"cancelled": True}
    return {"cancelled": False, "reason": "no pending request"}


@router.get("/sessions")
async def get_my_sessions(limit: int = 10, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    oid = ObjectId(user_id)
    docs = await db.peer_sessions.find(
        {"$or": [{"teacher_id": oid}, {"learner_id": oid}]},
        sort=[("created_at", -1)],
        limit=limit,
    ).to_list(length=limit)

    out = []
    for d in docs:
        role = "teacher" if d.get("teacher_id") == oid else "learner"
        out.append({
            "session_id":          d["session_id"],
            "topic":               d["topic"],
            "role":                role,
            "status":              d.get("status", SessionStatus.COMPLETED),
            "created_at":          d["created_at"],
            "teacher_grade":       d.get("teacher_grade"),
            "rewards":             d.get("rewards", []),
            "concepts_forged":     d.get("concepts_forged", []),
            "duration_min":        d.get("duration_min"),
            "turn_count":          d.get("turn_count"),
            "learner_improvement": d.get("learner_improvement"),
            "reverse_feynman":     d.get("reverse_feynman"),
        })
    return out


@router.get("/eligible-topics")
async def get_eligible_topics(user_id: str = Depends(get_current_user_id)):
    db = get_db()
    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    mastery = (user_doc or {}).get("topic_mastery", {})

    can_teach, can_learn = [], []
    for key, data in mastery.items():
        score = int(data.get("score", 50))
        topic = _topic_label(key)
        entry = {
            "topic":             topic,
            "score":             score,
            "sessions":          int(data.get("sessions", 0)),
            "teaching_sessions": int(data.get("teaching_sessions", 0)),
        }
        if score >= TEACHER_SCORE_MIN:
            can_teach.append(entry)
        elif score <= LEARNER_SCORE_MAX:
            can_learn.append(entry)

    can_teach.sort(key=lambda x: x["score"], reverse=True)
    can_learn.sort(key=lambda x: x["score"])
    return {"can_teach": can_teach, "can_learn": can_learn}


@router.get("/waiting-count")
async def get_waiting_counts():
    r = await _get_redis()
    if not r:
        return {}
    counts: dict[str, dict] = {}
    keys = await r.keys("elim:match:*")
    for k in keys:
        parts = k.split(":")
        if len(parts) >= 4:
            role, topic_key = parts[2], ":".join(parts[3:])
            n = await r.llen(k)
            counts.setdefault(topic_key, {"teacher": 0, "learner": 0})[role] = n
    return counts


@router.post("/reverse-feynman")
async def submit_reverse_feynman(req: ReverseFeynmanRequest, user_id: str = Depends(get_current_user_id)):
    """
    After a session ends, the learner explains the topic back to ELIM.
    Replaces the proxy learner_improvement with a real measured delta.
    """
    db = get_db()
    sess = await db.peer_sessions.find_one({"session_id": req.session_id})
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if str(sess.get("learner_id")) != user_id:
        raise HTTPException(status_code=403, detail="Only the learner can submit a reverse Feynman")

    user_doc = await db.users.find_one({"_id": ObjectId(user_id)})
    key = _topic_key(sess["topic"])
    pre_score = int((user_doc or {}).get("topic_mastery", {}).get(key, {}).get("score", 30))
    concepts = [c.get("concept", "") for c in (sess.get("concepts_forged") or [])][:8]

    grade = await _ai_json(
        _REVERSE_FEYNMAN_PROMPT.format(
            topic=sess["topic"],
            pre_score=pre_score,
            concepts=", ".join(concepts) if concepts else "(none extracted)",
            learner_explanation=req.explanation,
        ),
        model=SONNET, max_tokens=500,
    )
    if not grade:
        grade = {"post_score": pre_score + 10, "delta": 10, "what_stuck": [],
                 "still_fuzzy": [], "feedback": "Keep practising — graders unavailable."}

    post_score = int(grade.get("post_score", pre_score + 5))
    delta = int(grade.get("delta", post_score - pre_score))

    # Update learner mastery using the same blend feynman.py uses
    new_score = round(0.7 * pre_score + 0.3 * post_score)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            f"topic_mastery.{key}.score":        new_score,
            f"topic_mastery.{key}.last_tested":  datetime.now(timezone.utc),
        }, "$inc": {f"topic_mastery.{key}.sessions": 1}},
    )

    # Re-issue protégé bonus to teacher if delta >= 15
    rewards_added = []
    if delta >= 15 and sess.get("teacher_id"):
        teacher_id = str(sess["teacher_id"])
        t_user = await db.users.find_one({"_id": ObjectId(teacher_id)})
        cur = (t_user or {}).get("topic_mastery", {}).get(key, {}).get("score", 50)
        await db.users.update_one(
            {"_id": ObjectId(teacher_id)},
            {"$set": {f"topic_mastery.{key}.score": min(100, cur + 5)}},
        )
        rewards_added.append({"user": "teacher", "type": "protege_effect", "boost": 5, "delta": delta, "measured": True})

    await db.peer_sessions.update_one(
        {"session_id": req.session_id},
        {"$set": {
            "reverse_feynman":     grade,
            "learner_improvement": delta,
        },
         "$push": {"rewards": {"$each": rewards_added}} if rewards_added else {}},
    )

    return {
        "pre_score":  pre_score,
        "post_score": post_score,
        "delta":      delta,
        "grade":      grade,
        "rewards":    rewards_added,
    }


# ── WebSocket endpoint ────────────────────────────────────────────────────────
@ws_router.websocket("/ws/peer/{session_id}")
async def peer_teaching_ws(session_id: str, websocket: WebSocket):
    """
    WebSocket for the live teaching session.
    Auth: pass JWT as ?token=...
    Client → server:  {"type": "message"|"end_session", "content": "..."}
    Server → client events:
      role_reveal | message | system | facilitator_whisper | lantern_hint |
      concept_forged | clarity_pulse | bond_update | session_ended
    """
    token = websocket.query_params.get("token", "")
    user_id = decode_access_token(token)
    if not user_id:
        await websocket.close(code=4001, reason="Invalid token")
        return

    r = await _get_redis()
    if not r:
        await websocket.close(code=4500, reason="Redis offline")
        return

    raw = await r.get(rk_session(session_id))
    if not raw:
        await websocket.close(code=4004, reason="Session not found")
        return

    session = json.loads(raw)
    teacher_id = session["teacher_id"]
    learner_id = session["learner_id"]
    if user_id not in (teacher_id, learner_id):
        await websocket.close(code=4003, reason="Not part of this session")
        return

    role = "teacher" if user_id == teacher_id else "learner"
    await manager.connect(session_id, user_id, websocket)

    try:
        connected = manager.count(session_id)

        # Always send the joiner their role + topic
        my_alias = session["teacher_alias"] if role == "teacher" else session["learner_alias"]
        await websocket.send_json({
            "type":    "role_reveal",
            "role":    role,
            "alias":   my_alias,
            "topic":   session["topic"],
            "teacher_alias": session["teacher_alias"],
            "learner_alias": session["learner_alias"],
        })

        # Replay any prior messages (in case of reconnect)
        for m in session.get("messages", []):
            await websocket.send_json({
                "type":    "message",
                "role":    m["role"],
                "alias":   session["teacher_alias"] if m["role"] == "teacher" else
                           session["learner_alias"] if m["role"] == "learner" else "ELIM",
                "content": m["content"],
                "ts":      m.get("ts"),
                "turn":    m.get("turn", 0),
                "replay":  True,
            })
        for c in session.get("concepts_forged", []):
            await websocket.send_json({"type": "concept_forged", **c})

        if connected == 1:
            await websocket.send_json({
                "type": "system", "role": "system",
                "content": "Awaiting your counterpart. The hall is quiet.",
            })

        elif connected == 2 and session["status"] == SessionStatus.WAITING:
            session["status"]     = SessionStatus.ACTIVE
            session["started_at"] = datetime.now(timezone.utc).isoformat()
            await r.setex(rk_session(session_id), SESSION_TTL_SECONDS, json.dumps(session))

            opening = await generate_opening(
                session["topic"], session["teacher_alias"], session["learner_alias"],
            )
            await manager.broadcast(session_id, {
                "type":    "message",
                "role":    MessageRole.ELIM,
                "alias":   "ELIM",
                "content": opening,
                "ts":      datetime.now(timezone.utc).isoformat(),
                "turn":    0,
            })

        # Main loop
        while True:
            # Reload session each iteration (other user may have appended)
            raw = await r.get(rk_session(session_id))
            if not raw:
                break
            session = json.loads(raw)

            # Timeout / cap checks
            started = session.get("started_at")
            if started:
                try:
                    s_dt = datetime.fromisoformat(started.replace("Z", "+00:00"))
                    if s_dt.tzinfo is None:
                        s_dt = s_dt.replace(tzinfo=timezone.utc)
                    elapsed_min = (datetime.now(timezone.utc) - s_dt).total_seconds() / 60
                    if elapsed_min > SESSION_TIMEOUT_MIN:
                        await manager.broadcast(session_id, {
                            "type": "system", "role": "system",
                            "content": "Session ended — 30 minute limit reached.",
                        })
                        break
                except Exception:
                    pass

            if session.get("turn_count", 0) >= MAX_SESSION_TURNS:
                await manager.broadcast(session_id, {
                    "type": "system", "role": "system",
                    "content": "Session ended — turn limit reached.",
                })
                break

            try:
                data = await asyncio.wait_for(websocket.receive_json(), timeout=1800.0)
            except asyncio.TimeoutError:
                break
            except WebSocketDisconnect:
                raise

            if data.get("type") == "end_session":
                await manager.broadcast(session_id, {
                    "type": "system", "role": "system",
                    "content": f"{my_alias} concluded the session.",
                })
                break

            content = (data.get("content") or "").strip()
            if not content:
                continue
            content = content[:2000]   # hard cap per message

            # Reload session right before mutating to minimise lost updates
            raw = await r.get(rk_session(session_id))
            if raw:
                session = json.loads(raw)

            ts = datetime.now(timezone.utc).isoformat()
            messages = session.get("messages", [])
            messages.append({"role": role, "content": content, "ts": ts})
            session["messages"]   = messages[-120:]
            session["turn_count"] = int(session.get("turn_count", 0)) + 1

            # Protégé bond: learner questions (containing "?") + substantive teacher turns
            bond = int(session.get("bond_score", 0))
            if role == "learner" and "?" in content:
                bond += 2
            elif role == "teacher" and len(content) > 60:
                bond += 1
            session["bond_score"] = min(100, bond)

            await manager.broadcast(session_id, {
                "type":    "message",
                "role":    role,
                "alias":   my_alias,
                "content": content,
                "ts":      ts,
                "turn":    session["turn_count"],
            })
            await manager.broadcast(session_id, {
                "type":  "bond_update",
                "score": session["bond_score"],
            })

            turn = session["turn_count"]

            # AI accuracy + clarity check every N turns
            if turn % AI_CHECK_EVERY == 0:
                teacher_msgs = [m["content"] for m in messages if m["role"] == "teacher"]
                learner_msgs = [m["content"] for m in messages if m["role"] == "learner"]
                health = await check_session_health(session["topic"], teacher_msgs, learner_msgs)

                clarity = int(health.get("clarity_score", 80))
                session["clarity_history"] = (session.get("clarity_history") or [])[-30:] + [{"turn": turn, "score": clarity}]
                await manager.broadcast(session_id, {
                    "type":  "clarity_pulse",
                    "score": clarity,
                    "turn":  turn,
                })

                if health.get("intervene"):
                    if health.get("has_error") and health.get("correction"):
                        motto = random.choice(LATIN_MOTTOS)
                        await manager.send_to(session_id, teacher_id, {
                            "type":    "facilitator_whisper",
                            "content": health["correction"],
                        })
                        await manager.send_to(session_id, teacher_id, {
                            "type":     "lantern_hint",
                            "motto":    motto,
                            "content":  health["correction"],
                            "ts":       datetime.now(timezone.utc).isoformat(),
                        })
                        await asyncio.sleep(1.5)
                        await manager.broadcast(session_id, {
                            "type":    "message",
                            "role":    MessageRole.ELIM,
                            "alias":   "ELIM",
                            "content": f"Quick clarification: {health['correction']}",
                            "ts":      datetime.now(timezone.utc).isoformat(),
                            "turn":    turn,
                        })
                    elif health.get("is_stalled") and health.get("nudge"):
                        await manager.broadcast(session_id, {
                            "type":    "message",
                            "role":    MessageRole.ELIM,
                            "alias":   "ELIM",
                            "content": health["nudge"],
                            "ts":      datetime.now(timezone.utc).isoformat(),
                            "turn":    turn,
                        })

            # Concept Forge — fire on its own cadence
            if turn % CONCEPT_FORGE_EVERY == 0 and role == "teacher":
                teacher_msgs = [m["content"] for m in messages if m["role"] == "teacher"]
                existing = [c["concept"] for c in session.get("concepts_forged", [])]
                forged = await forge_concept(session["topic"], teacher_msgs, existing)
                if forged:
                    session.setdefault("concepts_forged", []).append(forged)
                    await manager.broadcast(session_id, {"type": "concept_forged", **forged})

            await r.setex(rk_session(session_id), SESSION_TTL_SECONDS, json.dumps(session))

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "content": str(e)[:200]})
        except Exception:
            pass
    finally:
        manager.disconnect(session_id, user_id)
        if manager.count(session_id) == 0:
            try:
                raw_final = await r.get(rk_session(session_id))
                if raw_final:
                    await _close_session(session_id, json.loads(raw_final))
            except Exception:
                pass


async def _close_session(session_id: str, session: dict):
    db = get_db()
    r = await _get_redis()

    messages = session.get("messages", [])
    teacher_msgs = [m["content"] for m in messages if m["role"] == "teacher"]
    learner_msgs = [m["content"] for m in messages if m["role"] == "learner"]
    topic = session.get("topic", "")

    if len(teacher_msgs) < 2:
        await db.peer_sessions.update_one(
            {"session_id": session_id},
            {"$set": {"status": SessionStatus.ABANDONED, "completed_at": datetime.now(timezone.utc)}},
        )
        if r:
            await r.delete(rk_session(session_id))
            await r.delete(rk_user_session(session.get("teacher_id", "")))
            await r.delete(rk_user_session(session.get("learner_id", "")))
        return

    teacher_grade = await grade_teacher(topic, teacher_msgs, learner_msgs)

    # Provisional learner improvement — refined by Reverse Feynman if learner submits one
    provisional_improvement = min(25, len(learner_msgs) * 2)

    duration_min = 0
    if session.get("started_at"):
        try:
            s_dt = datetime.fromisoformat(session["started_at"].replace("Z", "+00:00"))
            if s_dt.tzinfo is None:
                s_dt = s_dt.replace(tzinfo=timezone.utc)
            duration_min = int((datetime.now(timezone.utc) - s_dt).total_seconds() / 60)
        except Exception:
            pass

    await db.peer_sessions.update_one(
        {"session_id": session_id},
        {"$set": {
            "duration_min":    duration_min,
            "turn_count":      session.get("turn_count", 0),
            "concepts_forged": session.get("concepts_forged", []),
            "clarity_history": session.get("clarity_history", []),
            "bond_score":      session.get("bond_score", 0),
            "completed_at":    datetime.now(timezone.utc),
        }},
    )

    await award_teaching_rewards(
        teacher_id=session["teacher_id"],
        learner_id=session["learner_id"],
        topic=topic,
        session_id=session_id,
        teacher_grade=teacher_grade,
        learner_improvement=provisional_improvement,
    )

    if r:
        await r.delete(rk_session(session_id))
        await r.delete(rk_user_session(session.get("teacher_id", "")))
        await r.delete(rk_user_session(session.get("learner_id", "")))
