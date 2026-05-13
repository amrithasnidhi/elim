import json

from services.llm_service import call_llm_simple

_CONFUSION_PROMPT = """\
Classify this follow-up question. Respond with ONLY a JSON object — no other text.
Format: {{"confusion_score": <0.0-1.0>, "type": "<confused|curious|offtopic>"}}

confusion_score: 1.0 = deeply confused, 0.0 = not confused at all
type:
  confused  = the student didn't understand the explanation
  curious   = the student wants to go deeper (good)
  offtopic  = unrelated to the explanation topic

Explanation topic: {topic}
Follow-up question: {question}

JSON:"""


async def detect_confusion(topic: str, question: str) -> dict:
    """Returns {{confusion_score, type}}. Never raises."""
    try:
        prompt = _CONFUSION_PROMPT.format(topic=topic, question=question)
        raw = await call_llm_simple(
            prompt=prompt,
            model="claude-haiku-4-5-20251001",
            max_tokens=60,
        )
        return json.loads(raw.strip())
    except Exception:
        return {"confusion_score": 0.3, "type": "curious"}
