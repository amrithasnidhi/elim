import json
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Optional
import anthropic
import asyncio
import os

from database import get_db
from dependencies import get_optional_user_id, get_current_user_id
from services.mcp_manager import MCPManager
from services.rag_pipeline import get_rag_pipeline

router = APIRouter(prefix="/explain", tags=["explain"])

STYLE_INSTRUCTIONS = {
    "analogy": "Use real-world analogies and comparisons to everyday objects or situations. Make abstract concepts tangible.",
    "step-by-step": "Walk through the concept step by step with numbered steps. Be methodical and build understanding progressively.",
    "code-based": "Show working code examples (prefer Python unless specified). Explain through practical implementation.",
}

DIFFICULTY_LABELS = {
    1: "complete beginner with no prior knowledge",
    2: "beginner with basic awareness",
    3: "intermediate learner with some background",
    4: "advanced learner comfortable with the field",
    5: "expert — assume deep technical knowledge",
}

ALL_STYLES = ["analogy", "step-by-step", "code-based"]
MAX_QUALITY_RETRIES = 2
QUALITY_THRESHOLD = 3.0


def _argmax_style(weights: dict) -> str:
    return max(weights, key=lambda k: weights[k])


def _build_prompt(topic: str, style: str, difficulty: int, rag_context: str = "") -> str:
    context_block = (
        f"\nRelevant context from your knowledge sources — use this to personalise and ground the explanation:\n"
        f"{rag_context}\n"
        if rag_context else ""
    )
    return f"""You are an expert teacher with a gift for making complex topics clear.
{context_block}
Explain "{topic}" to a {DIFFICULTY_LABELS[difficulty]} (difficulty level {difficulty}/5).

Style instruction: {STYLE_INSTRUCTIONS[style]}

Rules:
- Avoid unnecessary jargon; explain any technical terms you must use
- Keep the explanation focused and complete (aim for 200-400 words)
- If context sources were provided above, cite them naturally (e.g. "As your notes mention…")
- End with EXACTLY one follow-up question on a new line starting with "Follow-up question: "

Your explanation:"""


def _parse_response(raw: str, topic: str) -> tuple[str, str]:
    if "Follow-up question:" in raw:
        parts = raw.rsplit("Follow-up question:", 1)
        return parts[0].strip(), parts[1].strip()
    return raw.strip(), f"Can you think of a real-world example where {topic} would be applied?"


async def _call_llm(api_key: str, topic: str, style: str, difficulty: int, rag_context: str = "") -> dict:
    """Single async LLM call. Scores quality with Haiku and retries once if avg < 3.0."""
    prompt = _build_prompt(topic, style, difficulty, rag_context)

    for attempt in range(MAX_QUALITY_RETRIES):
        try:
            client = anthropic.AsyncAnthropic(api_key=api_key)
            message = await client.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            explanation, followup = _parse_response(message.content[0].text, topic)

            # Quality gate — Haiku scores clarity/accuracy/style_fit
            from services.quality_scorer import score_explanation
            quality = await score_explanation(api_key, topic, style, explanation)

            if quality["avg"] >= QUALITY_THRESHOLD or attempt == MAX_QUALITY_RETRIES - 1:
                return {
                    "style": style,
                    "explanation": explanation,
                    "followup": followup,
                    "prompt": prompt,
                    "quality": quality,
                    "error": None,
                }
            # Retry with a more explicit prompt nudge
            prompt += f"\n\n[Previous attempt scored {quality['avg']:.1f}/5 — please improve clarity and depth.]"
        except Exception as e:
            return {"style": style, "explanation": "", "followup": "", "prompt": prompt, "quality": None, "error": str(e)}

    return {"style": style, "explanation": "", "followup": "", "prompt": prompt, "quality": None, "error": "Max retries exceeded"}


async def _save_history(
    db,
    user_id: str,
    topic: str,
    style: str,
    difficulty: int,
    prompt: str,
    explanation: str,
    multi_style: bool = False,
    mcp_sources_used: list = None,
    rag_chunks: list = None,
    quality_scores: dict = None,
) -> str:
    now = datetime.now(timezone.utc)
    result = await db.history.insert_one({
        "user_id": ObjectId(user_id),
        "topic": topic,
        "style_used": style,
        "difficulty_used": difficulty,
        "prompt_snapshot": prompt,
        "explanation": explanation,
        "diagram_code": None,
        "audio_url": None,
        "mcp_sources_used": mcp_sources_used or [],
        "rag_chunks": rag_chunks or [],
        "quality_scores": quality_scores,
        "feedback_score": 0,
        "star_rating": None,
        "time_to_rate_sec": None,
        "multi_style": multi_style,
        "created_at": now,
    })
    return str(result.inserted_id)


# ── Models ──────────────────────────────────────────────────────────────────

class ExplainRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    style: Optional[str] = Field(default=None, pattern="^(analogy|step-by-step|code-based)$")
    difficulty: Optional[int] = Field(default=None, ge=1, le=5)


class ExplainResponse(BaseModel):
    explanation: str
    followup: str
    style: str
    topic: str
    history_id: Optional[str] = None
    quality: Optional[dict] = None


class StyleResult(BaseModel):
    explanation: str
    followup: str
    history_id: Optional[str] = None
    error: Optional[str] = None


class MultiStyleResponse(BaseModel):
    topic: str
    difficulty: int
    analogy: StyleResult
    step_by_step: StyleResult
    code_based: StyleResult


# ── MCP context helper ───────────────────────────────────────────────────────

async def _load_mcp_context(user: dict, topic: str) -> tuple[str, list[str], list[dict]]:
    """Returns (context_string, sources_used, raw_chunks). Never raises."""
    enabled: list = user.get("enabled_mcp_sources", [])
    if not enabled:
        return "", [], []

    user_id = str(user["_id"])
    doc_counts: dict = user.get("mcp_doc_counts", {})
    has_indexed = any(doc_counts.get(s, 0) > 0 for s in enabled if s != "web")

    if has_indexed:
        pipeline = get_rag_pipeline()
        if pipeline:
            try:
                chunks = await pipeline.search(user_id, topic, enabled_sources=enabled)
                if chunks:
                    context = MCPManager.build_context_string(chunks)
                    sources_used = list({c["source"] for c in chunks})
                    return context, sources_used, chunks
            except Exception:
                pass

    tokens: dict = user.get("mcp_tokens", {})
    try:
        mgr = MCPManager(enabled, tokens)
        chunks = await mgr.search(topic)
        context = MCPManager.build_context_string(chunks)
        sources_used = list({c["source"] for c in chunks})
        return context, sources_used, chunks
    except Exception:
        return "", [], []


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=ExplainResponse)
async def generate_explanation(
    body: ExplainRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    db = get_db()
    effective_style = body.style
    effective_difficulty = body.difficulty
    user = None

    if user_id:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user:
            if effective_style is None:
                ps = user.get("preferred_style", "auto")
                effective_style = _argmax_style(user.get("style_weights", {"analogy": 1})) if ps == "auto" else ps
            if effective_difficulty is None:
                effective_difficulty = user.get("difficulty_level", 2)

    effective_style = effective_style or "analogy"
    effective_difficulty = effective_difficulty or 2

    rag_context, mcp_sources, rag_chunks = "", [], []
    if user:
        rag_context, mcp_sources, rag_chunks = await _load_mcp_context(user, body.topic)

    result = await _call_llm(api_key, body.topic, effective_style, effective_difficulty, rag_context)
    if result["error"]:
        raise HTTPException(status_code=502, detail=f"LLM API error: {result['error']}")

    history_id = None
    if user_id:
        history_id = await _save_history(
            db, user_id, body.topic, effective_style, effective_difficulty,
            result["prompt"], result["explanation"],
            mcp_sources_used=mcp_sources,
            rag_chunks=[{"text": c["text"][:400], "source": c["source"]} for c in rag_chunks],
            quality_scores=result.get("quality"),
        )
        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {"last_active": datetime.now(timezone.utc)},
                "$push": {"topic_history": {"$each": [body.topic], "$slice": -50}},
            },
        )

    return ExplainResponse(
        explanation=result["explanation"],
        followup=result["followup"],
        style=effective_style,
        topic=body.topic,
        history_id=history_id,
        quality=result.get("quality"),
    )


@router.post("/multi-style", response_model=MultiStyleResponse)
async def multi_style_explanation(
    body: ExplainRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    db = get_db()
    effective_difficulty = body.difficulty
    user = None

    if user_id:
        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if user and effective_difficulty is None:
            effective_difficulty = user.get("difficulty_level", 2)

    effective_difficulty = effective_difficulty or 2

    rag_context, mcp_sources, rag_chunks = "", [], []
    if user:
        rag_context, mcp_sources, rag_chunks = await _load_mcp_context(user, body.topic)

    tasks = [_call_llm(api_key, body.topic, s, effective_difficulty, rag_context) for s in ALL_STYLES]
    results = await asyncio.gather(*tasks)

    by_style = {r["style"]: r for r in results}
    stored_chunks = [{"text": c["text"][:400], "source": c["source"]} for c in rag_chunks]

    history_ids: dict[str, Optional[str]] = {s: None for s in ALL_STYLES}
    if user_id:
        save_tasks = [
            _save_history(
                db, user_id, body.topic, s, effective_difficulty,
                by_style[s]["prompt"], by_style[s]["explanation"],
                multi_style=True,
                mcp_sources_used=mcp_sources,
                rag_chunks=stored_chunks,
                quality_scores=by_style[s].get("quality"),
            )
            for s in ALL_STYLES if not by_style[s]["error"]
        ]
        saved_ids = await asyncio.gather(*save_tasks)
        idx = 0
        for s in ALL_STYLES:
            if not by_style[s]["error"]:
                history_ids[s] = saved_ids[idx]
                idx += 1

        await db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {"last_active": datetime.now(timezone.utc)},
                "$push": {"topic_history": {"$each": [body.topic], "$slice": -50}},
            },
        )

    def _to_result(style_key: str) -> StyleResult:
        r = by_style[style_key]
        return StyleResult(
            explanation=r["explanation"],
            followup=r["followup"],
            history_id=history_ids[style_key],
            error=r["error"],
        )

    return MultiStyleResponse(
        topic=body.topic,
        difficulty=effective_difficulty,
        analogy=_to_result("analogy"),
        step_by_step=_to_result("step-by-step"),
        code_based=_to_result("code-based"),
    )


# ── Audio TTS ─────────────────────────────────────────────────────────────────

class AudioRequest(BaseModel):
    history_id: str


@router.post("/audio")
async def request_audio(body: AudioRequest, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    history = await db.history.find_one({"_id": ObjectId(body.history_id)})
    if not history:
        raise HTTPException(status_code=404, detail="History not found")
    if str(history["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not your history")

    if history.get("audio_url"):
        return {"audio_url": history["audio_url"], "job_id": None}

    try:
        from workers.tts import generate_audio
        task = generate_audio.delay(body.history_id, user_id)
        return {"audio_url": None, "job_id": task.id}
    except Exception:
        raise HTTPException(status_code=503, detail="Celery worker not available — start Redis and the worker first")


@router.get("/audio/{job_id}")
async def audio_status(job_id: str, user_id: str = Depends(get_current_user_id)):
    try:
        from workers.celery_app import celery_app
        result = celery_app.AsyncResult(job_id)
        if result.state == "PENDING":
            return {"status": "queued", "audio_url": None}
        if result.state in ("STARTED", "PROGRESS"):
            info = result.info or {}
            return {"status": "generating", "audio_url": None, **info}
        if result.state == "SUCCESS":
            info = result.result or {}
            return {"status": "done", **info}
        if result.state == "FAILURE":
            return {"status": "failed", "error": str(result.info), "audio_url": None}
        return {"status": result.state.lower(), "audio_url": None}
    except Exception:
        raise HTTPException(status_code=503, detail="Cannot reach Celery backend")


# ── Diagram ───────────────────────────────────────────────────────────────────

class DiagramRequest(BaseModel):
    history_id: str


@router.post("/diagram")
async def generate_diagram(body: DiagramRequest, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    history = await db.history.find_one({"_id": ObjectId(body.history_id)})
    if not history:
        raise HTTPException(status_code=404, detail="History not found")
    if str(history["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not your history")

    if history.get("diagram_code"):
        return {"diagram_code": history["diagram_code"]}

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    topic = history["topic"]
    prompt = f"""Generate a Mermaid.js diagram that visually represents the concept: "{topic}".

Rules:
- Return ONLY raw Mermaid source — no markdown fences, no explanation text
- Use flowchart TD or graph LR; pick whichever fits the concept better
- Keep it concise: 5–10 nodes maximum
- Labels must be short (2–5 words each)"""

    client = anthropic.AsyncAnthropic(api_key=api_key)
    message = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=512,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = message.content[0].text.strip()

    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    diagram_code = raw.strip()

    await db.history.update_one(
        {"_id": ObjectId(body.history_id)},
        {"$set": {"diagram_code": diagram_code}},
    )
    return {"diagram_code": diagram_code}


# ── Follow-up chat ────────────────────────────────────────────────────────────

_chat_fallback: dict[str, list] = {}
CHAT_TTL = 7200
MAX_TURNS = 5


async def _get_redis():
    try:
        import redis.asyncio as aioredis
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        return aioredis.from_url(url, encoding="utf-8", decode_responses=True)
    except Exception:
        return None


class FollowupRequest(BaseModel):
    history_id: str
    question: str = Field(..., min_length=1, max_length=1000)


@router.post("/followup")
async def followup_chat(body: FollowupRequest, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    history = await db.history.find_one({"_id": ObjectId(body.history_id)})
    if not history:
        raise HTTPException(status_code=404, detail="History not found")
    if str(history["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not your history")

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    chat_key = f"chat:{body.history_id}"
    is_socratic = history.get("style_used") == "socratic"

    r = await _get_redis()
    conversation: list = []
    try:
        if r:
            raw = await r.get(chat_key)
            if raw:
                conversation = json.loads(raw)
        else:
            conversation = list(_chat_fallback.get(chat_key, []))
    except Exception:
        conversation = []

    if len(conversation) > MAX_TURNS * 2:
        conversation = conversation[-(MAX_TURNS * 2):]

    topic = history["topic"]

    # Detect confusion — if highly confused, instruct the AI to re-explain simply
    confusion_note = ""
    try:
        from services.confusion_detector import detect_confusion
        confusion = await detect_confusion(api_key, topic, body.question)
        if confusion.get("confusion_score", 0) > 0.7:
            confusion_note = (
                "\n\nIMPORTANT: The student appears confused. Re-explain the relevant part "
                "from scratch using a simpler analogy. Do NOT just repeat the same explanation."
            )
    except Exception:
        pass

    if is_socratic:
        system = (
            f'You are a Socratic tutor guiding the student to discover "{topic}" through questions.\n'
            f"Rules:\n"
            f"- Ask ONE guiding question at a time — never give the answer directly\n"
            f"- If the student is on the right track, praise briefly and ask a deeper question\n"
            f"- If the student is wrong, give a gentle hint and ask again\n"
            f"- After 5 correct turns, give a short confirming summary of the concept\n"
            f"{confusion_note}"
        )
    else:
        system = (
            f"You are a helpful tutor. The student just read this explanation of \"{topic}\":\n\n"
            f"---\n{history['explanation'][:2000]}\n---\n\n"
            f"Answer their follow-up questions concisely (2–4 sentences). "
            f"If the question is unrelated, gently redirect them back to \"{topic}\"."
            f"{confusion_note}"
        )

    messages = conversation + [{"role": "user", "content": body.question}]

    client = anthropic.AsyncAnthropic(api_key=api_key)
    response = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=512,
        system=system,
        messages=messages,
    )
    reply = response.content[0].text.strip()

    conversation.append({"role": "user", "content": body.question})
    conversation.append({"role": "assistant", "content": reply})
    try:
        if r:
            await r.setex(chat_key, CHAT_TTL, json.dumps(conversation))
        else:
            _chat_fallback[chat_key] = conversation
    except Exception:
        _chat_fallback[chat_key] = conversation

    return {"reply": reply, "turn": len(conversation) // 2}


# ── Socratic mode ─────────────────────────────────────────────────────────────

class SocraticRequest(BaseModel):
    topic: str = Field(..., min_length=1, max_length=500)
    difficulty: Optional[int] = Field(default=2, ge=1, le=5)


@router.post("/socratic")
async def start_socratic(body: SocraticRequest, user_id: str = Depends(get_current_user_id)):
    """
    Begin a Socratic learning session. Returns an opening question and a session history_id
    that can be used with POST /explain/followup to continue the Socratic dialogue.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not configured")

    prompt = (
        f'You are starting a Socratic learning session on the topic: "{body.topic}".\n'
        f"The student is at difficulty level {body.difficulty}/5.\n\n"
        f"Generate ONE opening Socratic question that:\n"
        f"- Probes what the student already knows\n"
        f"- Is open-ended and thought-provoking\n"
        f"- Does NOT give away any part of the answer\n\n"
        f"Return ONLY the question — no preamble, no explanation."
    )

    client = anthropic.AsyncAnthropic(api_key=api_key)
    message = await client.messages.create(
        model="claude-sonnet-4-5",
        max_tokens=200,
        messages=[{"role": "user", "content": prompt}],
    )
    opening_question = message.content[0].text.strip()

    db = get_db()
    history_id = await _save_history(
        db, user_id, body.topic, "socratic", body.difficulty or 2,
        prompt, "",
    )

    # Seed the chat context with the opening question as assistant turn
    chat_key = f"chat:{history_id}"
    seed = [{"role": "assistant", "content": opening_question}]
    r = await _get_redis()
    try:
        if r:
            await r.setex(chat_key, CHAT_TTL, json.dumps(seed))
        else:
            _chat_fallback[chat_key] = seed
    except Exception:
        _chat_fallback[chat_key] = seed

    return {
        "opening_question": opening_question,
        "history_id": history_id,
        "topic": body.topic,
    }
