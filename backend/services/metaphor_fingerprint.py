"""
ELIM — Metaphor Domain Fingerprinting
Tracks which real-world metaphor domains each user responds to best.
Completely invisible to the user — it just keeps clicking better.

Domains: cooking, sports, music, gaming, geography, biology, engineering,
         finance, nature, cinema, military, architecture

Flow:
  1. After LLM generates explanation → extract_domain(explanation_text)
  2. After user rates it            → update_fingerprint(user_id, domain, score)
  3. Before next LLM call           → get_domain_prompt_hint(user_id) → inject into prompt
"""

import json
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from database import get_db
from services.llm_service import call_llm_simple

DOMAINS = [
    "cooking",
    "sports",
    "music",
    "gaming",
    "geography",
    "biology",
    "engineering",
    "finance",
    "nature",
    "cinema",
    "military",
    "architecture",
]

DOMAIN_DESCRIPTIONS = {
    "cooking":      "recipes, ingredients, cooking processes, kitchen tools, flavors",
    "sports":       "games, athletes, scoring, training, team dynamics, competition",
    "music":        "rhythm, melody, instruments, composing, harmony, performance",
    "gaming":       "video games, levels, quests, players, strategy, progression",
    "geography":    "maps, terrain, navigation, distance, borders, exploration",
    "biology":      "cells, organisms, ecosystems, DNA, evolution, growth",
    "engineering":  "machines, circuits, systems, construction, design, mechanics",
    "finance":      "investment, markets, risk, returns, budgets, trading",
    "nature":       "weather, seasons, water cycles, plants, animals, landscapes",
    "cinema":       "films, storytelling, scenes, editing, characters, narrative",
    "military":     "strategy, command, tactics, defense, mission planning, ranks",
    "architecture": "structure, foundations, blueprints, load-bearing, space design",
}

DEFAULT_WEIGHTS = {d: round(1.0 / len(DOMAINS), 4) for d in DOMAINS}

CLASSIFY_PROMPT = """Analyze this explanation text and identify which real-world metaphor domain(s) it uses for analogies.

Text:
---
{text}
---

Available domains: {domains}

Rules:
- Only identify domains that are ACTUALLY used as analogies/comparisons in the text
- If no analogies are used, return "none"
- Return the PRIMARY domain (the most prominent one) and optionally a SECONDARY domain
- Be precise: "like a recipe" = cooking, "like a game of chess" = gaming, "like a river" = nature

Return ONLY valid JSON:
{{
  "primary_domain": "<domain_name or none>",
  "secondary_domain": "<domain_name or null>",
  "evidence": "<the specific phrase or sentence that contains the analogy>",
  "confidence": <0.0 to 1.0>
}}"""


async def extract_domain(explanation_text: str) -> dict:
    """
    Classify which metaphor domain an explanation uses.
    Returns {primary_domain, secondary_domain, evidence, confidence}.
    Falls back to {"primary_domain": "none"} on any error.
    """
    try:
        prompt = CLASSIFY_PROMPT.format(
            text=explanation_text[:3000],
            domains=", ".join(DOMAINS),
        )
        raw = await call_llm_simple(
            prompt=prompt,
            model="claude-haiku-4-5-20251001",
            max_tokens=200,
        )
        raw = raw.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        result = json.loads(raw)

        if result.get("primary_domain") not in DOMAINS + ["none"]:
            result["primary_domain"] = "none"
        if result.get("secondary_domain") not in DOMAINS + [None, "null", "none"]:
            result["secondary_domain"] = None
        if result.get("secondary_domain") in ["null", "none"]:
            result["secondary_domain"] = None

        return result
    except Exception:
        return {"primary_domain": "none", "secondary_domain": None, "evidence": "", "confidence": 0.0}


async def update_fingerprint(
    user_id: str,
    domain: str,
    feedback_score: int,
    secondary_domain: Optional[str] = None,
    confidence: float = 1.0,
) -> dict:
    """
    Update the user's metaphor domain fingerprint after a rating.
    EMA: new_weight = 0.85×old + 0.15×signal×confidence
    Returns the updated fingerprint dict.
    """
    if domain not in DOMAINS and domain != "none":
        return {}

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {}

    fingerprint = user.get("metaphor_fingerprint", {}).copy()
    if not fingerprint or "weights" not in fingerprint:
        fingerprint = {
            "weights":        DEFAULT_WEIGHTS.copy(),
            "session_count":  0,
            "last_domain":    None,
            "domain_history": [],
            "updated_at":     None,
        }

    weights    = fingerprint["weights"].copy()
    history    = fingerprint.get("domain_history", [])
    session_ct = fingerprint.get("session_count", 0)

    if domain != "none":
        signal = feedback_score * confidence
        old_w  = weights.get(domain, DEFAULT_WEIGHTS.get(domain, 0.08))
        new_w  = 0.85 * old_w + 0.15 * max(-1.0, min(1.0, signal))
        weights[domain] = round(max(0.01, new_w), 4)

    if secondary_domain and secondary_domain in DOMAINS and domain != "none":
        half_signal = feedback_score * confidence * 0.5
        old_w2      = weights.get(secondary_domain, DEFAULT_WEIGHTS.get(secondary_domain, 0.08))
        new_w2      = 0.85 * old_w2 + 0.15 * max(-1.0, min(1.0, half_signal))
        weights[secondary_domain] = round(max(0.01, new_w2), 4)

    total   = sum(weights.values())
    weights = {k: round(v / total, 4) for k, v in weights.items()}

    history.append({
        "domain":         domain,
        "feedback_score": feedback_score,
        "ts":             datetime.now(timezone.utc).isoformat(),
    })
    history = history[-50:]

    # Detect overuse: top domain used 3× in a row → trigger novelty rotation
    recent = [h["domain"] for h in history[-3:] if h["domain"] != "none"]
    novelty_skip = len(recent) == 3 and len(set(recent)) == 1

    updated_fp = {
        "weights":        weights,
        "session_count":  session_ct + 1,
        "last_domain":    domain if domain != "none" else fingerprint.get("last_domain"),
        "domain_history": history,
        "novelty_skip":   novelty_skip,
        "updated_at":     datetime.now(timezone.utc),
    }

    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"metaphor_fingerprint": updated_fp}},
    )
    return updated_fp


async def get_domain_prompt_hint(user_id: str) -> str:
    """
    Returns a prompt-injection string based on user's top metaphor domains.
    Empty string if not enough data yet (< 3 sessions).
    """
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return ""

    fp = user.get("metaphor_fingerprint", {})
    if not fp or fp.get("session_count", 0) < 3:
        return ""

    weights      = fp.get("weights", {})
    novelty_skip = fp.get("novelty_skip", False)
    last_domain  = fp.get("last_domain", "")

    sorted_domains = sorted(weights.items(), key=lambda x: x[1], reverse=True)
    top1 = sorted_domains[0][0]
    top2 = sorted_domains[1][0] if len(sorted_domains) > 1 else None

    if novelty_skip and top1 == last_domain and top2:
        return f"Prefer a {top2} metaphor if natural. Avoid {top1} analogies this time (variety)."

    desc = DOMAIN_DESCRIPTIONS.get(top1, top1)
    if top2 and weights.get(top2, 0) > 0.12:
        desc2 = DOMAIN_DESCRIPTIONS.get(top2, top2)
        return (
            f"Use a {top1} analogy ({desc}) if natural. "
            f"A {top2} angle ({desc2}) also works well for this user."
        )
    return f"Use a {top1} analogy ({desc}) if natural — this user responds well to {top1} metaphors."


async def get_fingerprint_profile(user_id: str) -> dict:
    """
    Returns a structured fingerprint profile for the Profile/Dashboard UI.
    """
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"ready": False, "sessions_until_ready": 3, "top_domains": [], "thinking_style": None, "session_count": 0}

    fp = user.get("metaphor_fingerprint", {})
    if not fp or not fp.get("weights"):
        return {
            "ready":                 False,
            "sessions_until_ready":  3,
            "top_domains":           [],
            "thinking_style":        None,
            "session_count":         0,
        }

    weights       = fp["weights"]
    session_count = fp.get("session_count", 0)
    sorted_w      = sorted(weights.items(), key=lambda x: x[1], reverse=True)
    top3          = [(d, round(w * 100)) for d, w in sorted_w[:3]]

    style_map = {
        "cooking":      "Recipe Thinker",
        "sports":       "Game Strategist",
        "music":        "Rhythm Learner",
        "gaming":       "Quest Navigator",
        "geography":    "Explorer Mind",
        "biology":      "Systems Biologist",
        "engineering":  "Builder Brain",
        "finance":      "Risk Analyst",
        "nature":       "Natural World Thinker",
        "cinema":       "Narrative Learner",
        "military":     "Tactical Thinker",
        "architecture": "Structure Builder",
    }

    top_domain     = sorted_w[0][0] if sorted_w else None
    thinking_style = style_map.get(top_domain, "Pattern Thinker")

    history = fp.get("domain_history", [])
    positive_hits = [h for h in history if h["feedback_score"] == 1 and h["domain"] != "none"]
    best_domain = None
    if positive_hits:
        counts      = Counter(h["domain"] for h in positive_hits)
        best_domain = counts.most_common(1)[0][0]

    return {
        "ready":                 session_count >= 3,
        "sessions_until_ready":  max(0, 3 - session_count),
        "top_domains":           top3,
        "thinking_style":        thinking_style,
        "session_count":         session_count,
        "novelty_skip":          fp.get("novelty_skip", False),
        "best_domain":           best_domain,
        "last_domain":           fp.get("last_domain"),
        "all_weights":           {d: round(w * 100) for d, w in sorted_w},
    }
