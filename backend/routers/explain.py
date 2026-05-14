import json
import re
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends
from pydantic import BaseModel, Field
from bson import ObjectId
from typing import Optional
import asyncio
import os

from database import get_db
from dependencies import get_optional_user_id, get_current_user_id
from services.mcp_manager import MCPManager
from services.rag_pipeline import get_rag_pipeline
from services.llm_service import call_llm, is_llm_available, LLMResponse

router = APIRouter(
    prefix="/explain",
    tags=["explain"],
    responses={
        500: {"description": "LLM provider not configured"},
        502: {"description": "LLM API error"},
    },
)

STYLE_INSTRUCTIONS = {
    "analogy": "Use real-world analogies and comparisons to everyday objects or situations. Make abstract concepts tangible.",
    "step-by-step": "Walk through the concept step by step with numbered steps. Be methodical and build understanding progressively.",
    "code-based": "Show working code examples in {lang}. Explain through practical implementation. Use ONLY {lang} — do not show code in any other language.",
}


def _code_style_instruction(lang: str) -> str:
    return STYLE_INSTRUCTIONS["code-based"].replace("{lang}", lang)

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


def _build_prompt(topic: str, style: str, difficulty: int, rag_context: str = "", code_language: str = "Python", metaphor_hint: str = "") -> str:
    is_live_web = rag_context and ("LIVE WEB DATA" in rag_context or "TODAY'S DATE:" in rag_context)

    if is_live_web:
        context_block = (
            f"\n{'='*60}\n"
            f"CRITICAL — LIVE WEB DATA (more current than your training):\n"
            f"You MUST use the facts below. Do NOT contradict them with your training data.\n"
            f"If the web data says someone died, they are dead. If it gives a date, use that date.\n"
            f"{'='*60}\n"
            f"{rag_context}\n"
            f"{'='*60}\n"
        )
        cite_rule = "- State current facts (dates, outcomes, status) EXACTLY as given in the LIVE WEB DATA above — do NOT soften, hedge, or contradict them"
    elif rag_context:
        context_block = (
            f"\nRelevant context from your knowledge sources — use this to personalise and ground the explanation:\n"
            f"{rag_context}\n"
        )
        cite_rule = "- If context sources were provided above, cite them naturally (e.g. \"As your notes mention…\")"
    else:
        context_block = ""
        cite_rule = "- Draw on your training knowledge to give an accurate, well-rounded explanation"

    style_instruction = (
        _code_style_instruction(code_language)
        if style == "code-based"
        else STYLE_INSTRUCTIONS[style]
    )

    hint_block = f"\nMETAPHOR PREFERENCE: {metaphor_hint}" if metaphor_hint else ""

    return f"""You are an expert teacher with a gift for making complex topics clear.
{context_block}
Explain "{topic}" to a {DIFFICULTY_LABELS[difficulty]} (difficulty level {difficulty}/5).

Style instruction: {style_instruction}

Rules:
- Avoid unnecessary jargon; explain any technical terms you must use
- Keep the explanation focused and complete (aim for 200-400 words)
{cite_rule}
- End with EXACTLY one follow-up question on a new line starting with "Follow-up question: "
{hint_block}
Your explanation:"""


def _parse_response(raw: str, topic: str) -> tuple[str, str]:
    if "Follow-up question:" in raw:
        parts = raw.rsplit("Follow-up question:", 1)
        return parts[0].strip(), parts[1].strip()
    return raw.strip(), f"Can you think of a real-world example where {topic} would be applied?"


async def _call_llm(topic: str, style: str, difficulty: int, rag_context: str = "", code_language: str = "Python", metaphor_hint: str = "") -> dict:
    """Single async LLM call with fallback. Scores quality and retries once if avg < 3.0."""
    prompt = _build_prompt(topic, style, difficulty, rag_context, code_language, metaphor_hint)

    for attempt in range(MAX_QUALITY_RETRIES):
        try:
            response: LLMResponse = await call_llm(
                messages=[{"role": "user", "content": prompt}],
                model="claude-sonnet-4-5",
                max_tokens=1024,
            )
            explanation, followup = _parse_response(response.text, topic)

            # Quality gate — uses fast model to score clarity/accuracy/style_fit
            from services.quality_scorer import score_explanation
            quality = await score_explanation(topic, style, explanation)

            if quality["avg"] >= QUALITY_THRESHOLD or attempt == MAX_QUALITY_RETRIES - 1:
                return {
                    "style": style,
                    "explanation": explanation,
                    "followup": followup,
                    "prompt": prompt,
                    "quality": quality,
                    "provider": response.provider,
                    "error": None,
                }
            prompt += f"\n\n[Previous attempt scored {quality['avg']:.1f}/5 — please improve clarity and depth.]"
        except Exception as e:
            return {"style": style, "explanation": "", "followup": "", "prompt": prompt, "quality": None, "provider": None, "error": str(e)}

    return {"style": style, "explanation": "", "followup": "", "prompt": prompt, "quality": None, "provider": None, "error": "Max retries exceeded"}


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
    """Request to generate an explanation."""
    topic: str = Field(
        ...,
        min_length=1,
        max_length=500,
        description="The topic or concept to explain",
        examples=["recursion", "binary search", "machine learning"],
    )
    style: Optional[str] = Field(
        default=None,
        pattern="^(analogy|step-by-step|code-based)$",
        description="Explanation style. If omitted, uses user's preferred style.",
    )
    difficulty: Optional[int] = Field(
        default=None,
        ge=1,
        le=5,
        description="Difficulty level (1=beginner, 5=expert). If omitted, uses user's level.",
    )
    code_language: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Programming language for code-based style (e.g. 'Java', 'Rust'). Defaults to Python.",
    )

    model_config = {"json_schema_extra": {"examples": [{"topic": "recursion", "style": "analogy", "difficulty": 2}]}}


class QualityScores(BaseModel):
    """Quality assessment scores for an explanation."""
    clarity: float = Field(..., description="Clarity score (1-5)")
    accuracy: float = Field(..., description="Accuracy score (1-5)")
    style_fit: float = Field(..., description="Style adherence score (1-5)")
    avg: float = Field(..., description="Average of all scores")


class ExplainResponse(BaseModel):
    """Generated explanation response."""
    explanation: str = Field(..., description="The generated explanation text")
    followup: str = Field(..., description="Suggested follow-up question")
    style: str = Field(..., description="Style used for this explanation")
    topic: str = Field(..., description="Original topic requested")
    history_id: Optional[str] = Field(None, description="ID to reference this explanation later")
    quality: Optional[dict] = Field(None, description="Quality assessment scores")


class StyleResult(BaseModel):
    """Result for a single style in multi-style response."""
    explanation: str = Field(..., description="Generated explanation")
    followup: str = Field(..., description="Follow-up question")
    history_id: Optional[str] = Field(None, description="History ID for this explanation")
    error: Optional[str] = Field(None, description="Error message if generation failed")


class MultiStyleResponse(BaseModel):
    """Response containing explanations in all three styles."""
    topic: str = Field(..., description="The topic explained")
    difficulty: int = Field(..., description="Difficulty level used")
    analogy: StyleResult = Field(..., description="Analogy-style explanation")
    step_by_step: StyleResult = Field(..., description="Step-by-step explanation")
    code_based: StyleResult = Field(..., description="Code-based explanation")


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

@router.post(
    "/generate",
    response_model=ExplainResponse,
    summary="Generate explanation",
    description="Generate a personalized explanation for a topic using AI.",
)
async def generate_explanation(
    body: ExplainRequest,
    background_tasks: BackgroundTasks,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    Generate an AI-powered explanation for any topic.

    **Features:**
    - Uses user's preferred style and difficulty if not specified
    - Pulls context from connected knowledge sources (Google Drive, Notion, GitHub)
    - Fetches live web data for current events/people
    - Quality-checked with automatic retry if score < 3.0
    - Saves to history for authenticated users
    """
    if not is_llm_available():
        raise HTTPException(status_code=500, detail="No LLM provider configured. Set ANTHROPIC_API_KEY or GROQ_API_KEY.")

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

    # Enrich with web search for current events
    from services.web_search import needs_web_search, search_web
    if needs_web_search(body.topic):
        web_ctx = await search_web(body.topic)
        if web_ctx:
            rag_context = web_ctx + ("\n\n" + rag_context if rag_context else "")

    lang = (body.code_language or "Python").strip() or "Python"

    metaphor_hint = ""
    if user_id:
        try:
            from services.metaphor_fingerprint import get_domain_prompt_hint
            metaphor_hint = await get_domain_prompt_hint(user_id)
        except Exception:
            pass

    result = await _call_llm(body.topic, effective_style, effective_difficulty, rag_context, lang, metaphor_hint)
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

        async def _tag_domain(explanation_text: str, hid: str):
            try:
                from services.metaphor_fingerprint import extract_domain
                domain_result = await extract_domain(explanation_text)
                await db.history.update_one(
                    {"_id": ObjectId(hid)},
                    {"$set": {
                        "metaphor_domain":           domain_result.get("primary_domain", "none"),
                        "metaphor_domain_secondary": domain_result.get("secondary_domain"),
                        "metaphor_evidence":         domain_result.get("evidence", ""),
                        "metaphor_confidence":       domain_result.get("confidence", 1.0),
                    }},
                )
            except Exception:
                pass

        background_tasks.add_task(_tag_domain, result["explanation"], history_id)

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


@router.post(
    "/multi-style",
    response_model=MultiStyleResponse,
    summary="Generate explanations in all styles",
    description="Generate explanations in analogy, step-by-step, and code-based styles simultaneously.",
)
async def multi_style_explanation(
    body: ExplainRequest,
    user_id: Optional[str] = Depends(get_optional_user_id),
):
    """
    Generate explanations in all three styles for comparison.
    """
    if not is_llm_available():
        raise HTTPException(status_code=500, detail="No LLM provider configured. Set ANTHROPIC_API_KEY or GROQ_API_KEY.")

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

    # Enrich with web search for current events
    from services.web_search import needs_web_search, search_web
    if needs_web_search(body.topic):
        web_ctx = await search_web(body.topic)
        if web_ctx:
            rag_context = web_ctx + ("\n\n" + rag_context if rag_context else "")

    lang = (body.code_language or "Python").strip() or "Python"
    tasks = [_call_llm(body.topic, s, effective_difficulty, rag_context, lang) for s in ALL_STYLES]
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
    """Request to generate audio for an explanation."""
    history_id: str = Field(..., description="ID of the explanation to convert to speech")


@router.post(
    "/audio",
    summary="Generate audio (TTS)",
    description="Convert an explanation to speech using ElevenLabs or Gemini TTS.",
)
async def request_audio(body: AudioRequest, user_id: str = Depends(get_current_user_id)):
    """Request text-to-speech generation for an explanation."""
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


@router.get(
    "/audio/{job_id}",
    summary="Check audio generation status",
    description="Poll the status of an audio generation job.",
)
async def audio_status(job_id: str, user_id: str = Depends(get_current_user_id)):
    """Check status of TTS job."""
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
    """Request to generate a diagram for an explanation."""
    history_id: str = Field(..., description="ID of the explanation to visualize")


@router.post(
    "/diagram",
    summary="Generate Mermaid diagram",
    description="Generate a Mermaid.js diagram visualizing the concept.",
)
async def generate_diagram(body: DiagramRequest, user_id: str = Depends(get_current_user_id)):
    """Generate a visual diagram for a topic using Mermaid.js syntax."""
    db = get_db()
    history = await db.history.find_one({"_id": ObjectId(body.history_id)})
    if not history:
        raise HTTPException(status_code=404, detail="History not found")
    if str(history["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not your history")

    if history.get("diagram_code"):
        return {"diagram_code": history["diagram_code"]}

    if not is_llm_available():
        raise HTTPException(status_code=500, detail="No LLM provider configured")

    topic = history["topic"]
    prompt = (
        f'Generate a Mermaid.js flowchart for the concept: "{topic}".\n\n'
        f"Output ONLY the raw Mermaid syntax — no markdown fences, no explanatory text.\n"
        f"Start your response with exactly: flowchart TD\n\n"
        f"Rules:\n"
        f"- Use flowchart TD layout\n"
        f"- 5-8 nodes maximum\n"
        f"- Short labels (2-4 plain words, ASCII only, NO parentheses or special chars)\n"
        f"- Always use double-quoted labels: A[\"Start\"] --> B[\"Step 1\"]\n"
        f"- Use --> for arrows, optionally with text: -->|\"label\"|\n"
        f"- No subgraphs, no styling, no classDef, no HTML\n\n"
        f"Example format:\n"
        f"flowchart TD\n"
        f'    A["Start"] --> B["Step One"]\n'
        f'    B --> C["Step Two"]\n'
        f'    C --> D["End"]'
    )

    response = await call_llm(
        messages=[{"role": "user", "content": prompt}],
        model="claude-sonnet-4-5",
        max_tokens=512,
    )
    raw = response.text.strip()

    # Extract clean Mermaid code — handle fences and preamble text
    fence_match = re.search(r'```(?:mermaid)?\s*\n([\s\S]+?)(?:\n```|$)', raw)
    if fence_match:
        raw = fence_match.group(1).strip()
    elif raw.startswith('`'):
        raw = re.sub(r'^`+\w*\s*', '', raw).rstrip('`').strip()

    # Find the first Mermaid keyword line and discard any preamble
    mermaid_start = re.search(
        r'^(flowchart|graph |sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap)',
        raw, re.MULTILINE,
    )
    if mermaid_start:
        raw = raw[mermaid_start.start():]

    # Fix common LLM syntax mistake: -->|label|> should be -->|label|
    raw = re.sub(r'\|>', '|', raw)

    # Sanitise for mermaid v11.15.0 — wrap bare labels in quotes, escape special chars
    def _sanitise_mermaid(code: str) -> str:
        lines = code.split('\n')
        sanitised = []
        for line in lines:
            # Wrap unquoted bracket labels: A[Label Text] -> A["Label Text"]
            line = re.sub(
                r'\[([^"\]]+)\]',
                lambda m: '["' + m.group(1).replace('"', '') + '"]',
                line,
            )
            # Escape parentheses inside labels (common LLM mistake)
            line = re.sub(
                r'\["([^"]*?)"\]',
                lambda m: '["' + m.group(1).replace('(', '#40;').replace(')', '#41;') + '"]',
                line,
            )
            # Strip any stray HTML tags
            line = re.sub(r'<[^>]+>', '', line)
            sanitised.append(line)
        return '\n'.join(sanitised)

    raw = _sanitise_mermaid(raw)
    diagram_code = raw.strip()

    await db.history.update_one(
        {"_id": ObjectId(body.history_id)},
        {"$set": {"diagram_code": diagram_code}},
    )
    return {"diagram_code": diagram_code}


# ── Follow-up chat ────────────────────────────────────────────────────────────

_chat_fallback: dict[str, list] = {}
CHAT_TTL = 7200
MAX_TURNS = 8


async def _get_redis():
    try:
        import redis.asyncio as aioredis
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        return aioredis.from_url(url, encoding="utf-8", decode_responses=True)
    except Exception:
        return None


class FollowupRequest(BaseModel):
    """Request to ask a follow-up question."""
    history_id: str = Field(..., description="ID of the explanation to follow up on")
    question: str = Field(..., min_length=1, max_length=1000, description="Your follow-up question")


@router.post(
    "/followup",
    summary="Ask follow-up question",
    description="Continue the conversation about an explanation with follow-up questions.",
)
async def followup_chat(body: FollowupRequest, user_id: str = Depends(get_current_user_id)):
    db = get_db()
    history = await db.history.find_one({"_id": ObjectId(body.history_id)})
    if not history:
        raise HTTPException(status_code=404, detail="History not found")
    if str(history["user_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not your history")

    if not is_llm_available():
        raise HTTPException(status_code=500, detail="No LLM provider configured")

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

    # Detect confusion
    confusion_note = ""
    try:
        from services.confusion_detector import detect_confusion
        confusion = await detect_confusion(topic, body.question)
        if confusion.get("confusion_score", 0) > 0.7:
            if is_socratic:
                confusion_note = (
                    "\n\nIMPORTANT: The student is stuck and doesn't know the answer. "
                    "STOP asking questions. Instead: directly explain the specific concept in 2-3 clear sentences, "
                    "then end with ONE simple yes/no or confirm question like 'Does that make sense?'"
                )
            else:
                confusion_note = (
                    "\n\nIMPORTANT: The student appears confused. Re-explain the relevant part "
                    "from scratch using a simpler analogy. Do NOT just repeat the same explanation."
                )
    except Exception:
        pass

    # Enrich follow-up chat with live web data for current-event topics
    followup_web_ctx = ""
    from services.web_search import needs_web_search, search_web
    if needs_web_search(topic):
        followup_web_ctx = await search_web(topic + " " + body.question)

    if is_socratic:
        system = (
            f'You are a Socratic tutor. The student has chosen to study "{topic}" — they already know the topic name.\n'
            f"Your goal is to guide them to discover the CONCEPTS, MECHANISMS, and PRINCIPLES that explain {topic}.\n\n"
            f"Rules:\n"
            f"- NEVER play dumb or pretend you don't know what {topic} is — the student chose this topic\n"
            f"- Ask ONE focused question at a time that probes understanding of HOW or WHY {topic} works\n"
            f"- Questions should reveal deeper concepts (science, mechanisms, cause-and-effect), not trivial facts\n"
            f"- If the student's answer is right, affirm briefly and go one level deeper\n"
            f"- If the student is wrong or stuck, give ONE concrete hint that nudges toward the concept\n"
            f"- After the student has grasped the key concepts (around 5-6 good exchanges), give a concise summary of what they discovered\n"
            f"- Keep responses SHORT: 1-3 sentences max\n"
            f"{confusion_note}"
        )
    else:
        if followup_web_ctx:
            web_section = (
                f"\n\n{'='*60}\n"
                f"CRITICAL — LIVE WEB DATA (more current than your training):\n"
                f"State all dates, outcomes, and status EXACTLY as written below. Do NOT contradict them.\n"
                f"{'='*60}\n"
                f"{followup_web_ctx}\n"
                f"{'='*60}\n"
            )
        else:
            web_section = ""
        system = (
            f"You are a helpful tutor. The student just read this explanation of \"{topic}\":\n\n"
            f"---\n{history['explanation'][:2000]}\n---\n"
            f"{web_section}\n"
            f"Answer their follow-up questions concisely (2–4 sentences). "
            f"For any current fact (death dates, election results, recent events) use the LIVE WEB DATA above — it overrides your training. "
            f"If the question is unrelated, gently redirect them back to \"{topic}\"."
            f"{confusion_note}"
        )

    messages = conversation + [{"role": "user", "content": body.question}]

    response = await call_llm(
        messages=messages,
        model="claude-sonnet-4-5",
        max_tokens=512,
        system=system,
    )
    reply = response.text.strip()

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
    """Request to start a Socratic learning session."""
    topic: str = Field(..., min_length=1, max_length=500, description="Topic to explore through Socratic dialogue")
    difficulty: Optional[int] = Field(default=2, ge=1, le=5, description="Student's knowledge level")


@router.post(
    "/socratic",
    summary="Start Socratic session",
    description="Begin a guided discovery session where the AI asks questions instead of explaining directly.",
)
async def start_socratic(body: SocraticRequest, user_id: str = Depends(get_current_user_id)):
    """Start a Socratic learning session."""
    if not is_llm_available():
        raise HTTPException(status_code=500, detail="No LLM provider configured")

    prompt = (
        f'Generate ONE opening Socratic question for a student who wants to learn about "{body.topic}".\n'
        f"Difficulty level: {body.difficulty}/5.\n\n"
        f"The student ALREADY KNOWS the topic is \"{body.topic}\" — do NOT play dumb about what it is.\n"
        f"Instead, ask a question that makes them think about the underlying MECHANISM, SCIENCE, or PRINCIPLE.\n\n"
        f"Return ONLY the question — no preamble, no explanation, no quotation marks."
    )

    response = await call_llm(
        messages=[{"role": "user", "content": prompt}],
        model="claude-sonnet-4-5",
        max_tokens=200,
    )
    opening_question = response.text.strip()

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
