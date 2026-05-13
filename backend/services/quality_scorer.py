import json

from services.llm_service import call_llm_simple

_SCORE_PROMPT = """\
Rate this explanation on three axes. Respond with ONLY a JSON object — no other text.
Format: {{"clarity": <1-5>, "accuracy": <1-5>, "style_fit": <1-5>}}

Topic: {topic}
Target style: {style}
---
{explanation}
---

JSON:"""


async def score_explanation(topic: str, style: str, explanation: str) -> dict:
    """
    Returns {{clarity, accuracy, style_fit, avg}}.
    Uses fast model (Haiku or Groq 8b). Never raises — returns neutral scores on error.
    """
    try:
        prompt = _SCORE_PROMPT.format(topic=topic, style=style, explanation=explanation[:1500])
        raw = await call_llm_simple(
            prompt=prompt,
            model="claude-haiku-4-5-20251001",
            max_tokens=80,
        )
        scores = json.loads(raw.strip())
        avg = round(sum(scores.values()) / len(scores), 2)
        return {**scores, "avg": avg}
    except Exception:
        return {"clarity": 3, "accuracy": 3, "style_fit": 3, "avg": 3.0}
