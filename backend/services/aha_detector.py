"""
Aha Moment Detector - Mines chat messages for comprehension signals.

Detects:
- Short excited replies ("oh!", "ohhh", "aha")
- Realization phrases ("wait that means", "so basically", "so it's like")
- Confirmation signals ("got it", "makes sense now", "I see")
- Sudden clarity after confusion
"""

import re
from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId

# Linguistic patterns indicating comprehension breakthrough
AHA_PATTERNS = [
    # Exclamations
    (r'\boh+!*\b', 0.7),
    (r'\baha+!*\b', 0.9),
    (r'\bwow+!*\b', 0.6),
    (r'\bnice+!*\b', 0.5),

    # Realization phrases
    (r'\bwait,?\s*(so|that)\s*means?\b', 0.85),
    (r'\bso\s+basically\b', 0.8),
    (r'\bso\s+it\'?s?\s+(like|basically)\b', 0.8),
    (r'\bthat\s+explains\b', 0.85),
    (r'\bnow\s+i\s+(get|understand|see)\b', 0.9),

    # Confirmation signals
    (r'\bgot\s+it!*\b', 0.75),
    (r'\bmakes?\s+sense\s*now\b', 0.85),
    (r'\bi\s+see!*\b', 0.6),
    (r'\boh\s+i\s+see\b', 0.8),
    (r'\bthat\'?s?\s+(it|right)!*\b', 0.7),
    (r'\bfinally!*\b', 0.8),
    (r'\bclicked!*\b', 0.9),

    # Connection-making
    (r'\blike\s+when\b', 0.6),
    (r'\bjust\s+like\b', 0.5),
    (r'\bsimilar\s+to\b', 0.5),
    (r'\bremind[s]?\s+me\s+of\b', 0.6),
]

# Compile patterns
COMPILED_PATTERNS = [(re.compile(p, re.IGNORECASE), score) for p, score in AHA_PATTERNS]


def detect_aha_signals(message: str) -> dict:
    """
    Analyze message for aha moment signals.

    Returns:
        {
            "is_aha": bool,
            "confidence": float (0-1),
            "triggers": list of matched patterns,
            "message_length": int,
            "exclamation_ratio": float
        }
    """
    message = message.strip()
    if not message:
        return {"is_aha": False, "confidence": 0, "triggers": [], "message_length": 0}

    triggers = []
    max_score = 0

    for pattern, score in COMPILED_PATTERNS:
        if pattern.search(message):
            triggers.append(pattern.pattern)
            max_score = max(max_score, score)

    # Short excited reply boost (< 50 chars with exclamation)
    msg_len = len(message)
    exclamation_count = message.count('!')
    exclamation_ratio = exclamation_count / max(msg_len, 1)

    if msg_len < 50 and exclamation_count > 0:
        max_score = min(1.0, max_score + 0.15)

    # Very short confirmation (< 20 chars) with pattern = high confidence
    if msg_len < 20 and triggers:
        max_score = min(1.0, max_score + 0.1)

    is_aha = max_score >= 0.6

    return {
        "is_aha": is_aha,
        "confidence": round(max_score, 3),
        "triggers": triggers,
        "message_length": msg_len,
        "exclamation_ratio": round(exclamation_ratio, 3),
    }


async def record_aha_moment(
    db,
    user_id: str,
    history_id: str,
    turn_number: int,
    message: str,
    detection: dict,
    style_used: str,
    topic: str,
    context: Optional[dict] = None,
):
    """
    Store detected aha moment in database.

    Args:
        db: Database instance
        user_id: User ID
        history_id: Explanation history ID
        turn_number: Chat turn where aha occurred
        message: User message that triggered detection
        detection: Output from detect_aha_signals()
        style_used: Explanation style (analogy, step-by-step, code-based)
        topic: Topic being explained
        context: Optional extra context (previous messages, etc)
    """
    doc = {
        "user_id": ObjectId(user_id),
        "history_id": ObjectId(history_id),
        "turn_number": turn_number,
        "message": message[:500],  # Truncate long messages
        "confidence": detection["confidence"],
        "triggers": detection["triggers"],
        "style_used": style_used,
        "topic": topic,
        "context": context or {},
        "created_at": datetime.now(timezone.utc),
    }

    result = await db.aha_moments.insert_one(doc)
    return str(result.inserted_id)


async def get_breakthrough_profile(db, user_id: str, min_moments: int = 3) -> dict:
    """
    Analyze user's aha moments to build breakthrough profile.

    Returns patterns like:
    - "You click after the second analogy"
    - "Code examples unlock understanding"
    - "You need X turns before breakthrough"
    """
    pipeline = [
        {"$match": {"user_id": ObjectId(user_id)}},
        {"$group": {
            "_id": None,
            "total_moments": {"$sum": 1},
            "avg_turn": {"$avg": "$turn_number"},
            "avg_confidence": {"$avg": "$confidence"},
            "styles": {"$push": "$style_used"},
            "turns": {"$push": "$turn_number"},
            "triggers": {"$push": "$triggers"},
        }},
    ]

    result = await db.aha_moments.aggregate(pipeline).to_list(1)

    if not result or result[0]["total_moments"] < min_moments:
        return {
            "has_profile": False,
            "total_moments": result[0]["total_moments"] if result else 0,
            "message": "Need more learning sessions to build profile",
        }

    data = result[0]

    # Count styles
    style_counts = {}
    for s in data["styles"]:
        style_counts[s] = style_counts.get(s, 0) + 1

    best_style = max(style_counts, key=style_counts.get) if style_counts else None
    best_style_pct = round(style_counts.get(best_style, 0) / data["total_moments"] * 100, 1) if best_style else 0

    # Analyze turn patterns
    turns = data["turns"]
    early_clicks = sum(1 for t in turns if t <= 2)
    late_clicks = sum(1 for t in turns if t > 4)

    # Flatten and count triggers
    all_triggers = []
    for t_list in data["triggers"]:
        all_triggers.extend(t_list)

    trigger_counts = {}
    for t in all_triggers:
        trigger_counts[t] = trigger_counts.get(t, 0) + 1

    top_triggers = sorted(trigger_counts.items(), key=lambda x: -x[1])[:3]

    # Build insights
    insights = []

    if best_style and best_style_pct > 40:
        style_names = {
            "analogy": "analogies",
            "step-by-step": "step-by-step breakdowns",
            "code-based": "code examples",
        }
        insights.append(f"{style_names.get(best_style, best_style)} unlock your understanding ({best_style_pct}% of breakthroughs)")

    avg_turn = data["avg_turn"]
    if avg_turn <= 2:
        insights.append("You grasp concepts quickly (avg breakthrough on turn 2)")
    elif avg_turn <= 4:
        insights.append(f"You need dialogue to click (avg {avg_turn:.1f} turns)")
    else:
        insights.append(f"Deep exploration works for you (avg {avg_turn:.1f} turns before breakthrough)")

    if early_clicks > late_clicks * 2:
        insights.append("First explanation often clicks - you learn fast")
    elif late_clicks > early_clicks * 2:
        insights.append("Follow-up questions are your unlock - keep asking")

    return {
        "has_profile": True,
        "total_moments": data["total_moments"],
        "avg_turn": round(avg_turn, 1),
        "avg_confidence": round(data["avg_confidence"], 2),
        "best_style": best_style,
        "best_style_pct": best_style_pct,
        "style_breakdown": style_counts,
        "insights": insights,
        "top_triggers": [t[0] for t in top_triggers],
    }


async def get_optimal_sequence(db, user_id: str) -> list:
    """
    Recommend explanation sequence based on breakthrough patterns.

    Returns ordered list of styles most likely to trigger understanding.
    """
    profile = await get_breakthrough_profile(db, user_id)

    if not profile.get("has_profile"):
        # Default sequence
        return ["analogy", "step-by-step", "code-based"]

    breakdown = profile.get("style_breakdown", {})
    if not breakdown:
        return ["analogy", "step-by-step", "code-based"]

    # Sort by breakthrough count
    sorted_styles = sorted(breakdown.items(), key=lambda x: -x[1])
    return [s[0] for s in sorted_styles]
