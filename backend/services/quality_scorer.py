import json
import os

_SCORE_PROMPT = """\
Rate this explanation on three axes. Respond with ONLY a JSON object — no other text.
Format: {{"clarity": <1-5>, "accuracy": <1-5>, "style_fit": <1-5>}}

Topic: {topic}
Target style: {style}
---
{explanation}
---

JSON:"""


async def score_explanation(api_key: str, topic: str, style: str, explanation: str) -> dict:
    """
    Returns {{clarity, accuracy, style_fit, avg}}.
    Uses claude-haiku-4-5 for speed. Never raises — returns neutral scores on error.
    """
    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=api_key)
        prompt = _SCORE_PROMPT.format(topic=topic, style=style, explanation=explanation[:1500])
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=80,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        scores = json.loads(raw)
        avg = round(sum(scores.values()) / len(scores), 2)
        return {**scores, "avg": avg}
    except Exception:
        return {"clarity": 3, "accuracy": 3, "style_fit": 3, "avg": 3.0}
