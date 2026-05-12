import json

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


async def detect_confusion(api_key: str, topic: str, question: str) -> dict:
    """Returns {{confusion_score, type}}. Never raises."""
    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=api_key)
        prompt = _CONFUSION_PROMPT.format(topic=topic, question=question)
        message = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=60,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        return json.loads(raw)
    except Exception:
        return {"confusion_score": 0.3, "type": "curious"}
