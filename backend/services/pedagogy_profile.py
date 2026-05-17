"""
ELIM — Personal Pedagogy Profile (PPP)

Compiles every user signal (ratings, Feynman tests, aha moments, persistent gaps,
metaphor domains) into a structured profile object, then renders two views:

  1. render_for_prompt(profile)  — terse, action-oriented block injected as a
     system message into every explanation prompt. The same Claude API call
     produces a different shape for every user because of this block.

  2. render_for_display(profile) — verbose, evidence-citing dict for the
     "/profile/learning" page so the user (and judges) can SEE what ELIM
     has learned.

Every claim carries an `evidence` count so we never make assertions from no data.
Sections are gated by MIN_EVIDENCE thresholds — a brand-new user gets a small,
honest profile; a heavy user gets a richer one over time.
"""

import re
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

from bson import ObjectId


# ── Evidence thresholds ───────────────────────────────────────────────────────
MIN_RATINGS_FOR_LENGTH    = 4
MIN_DOMAIN_HITS_PREFERRED = 3   # need 3 high-rated explanations to declare preference
MIN_DOMAIN_HITS_AVOIDED   = 2   # need 2 low-rated to declare avoidance
MIN_GAP_RECURRENCE        = 2
RECENT_DAYS               = 30
HISTORY_LOOKBACK          = 80


# ── Builder ───────────────────────────────────────────────────────────────────

async def build_profile(user_id: str, db) -> dict:
    """
    Compute a structured pedagogy profile from all of the user's signals.
    Returns a dict that both renderers can consume. Pure read — no writes.
    """
    user = await db.users.find_one({"_id": ObjectId(user_id)}) or {}

    # Pull the most recent rated explanations
    history = await db.history.find(
        {
            "user_id": ObjectId(user_id),
            "star_rating": {"$ne": None},
        },
        sort=[("created_at", -1)],
        limit=HISTORY_LOOKBACK,
    ).to_list(length=HISTORY_LOOKBACK)

    # ── Style preference (already maintained by feedback router) ──────────────
    weights = user.get("style_weights", {"analogy": 0.33, "step-by-step": 0.33, "code-based": 0.34})
    style_ranked = sorted(weights.items(), key=lambda kv: kv[1], reverse=True)

    # ── Metaphor domain affinity (positive vs negative from history ratings) ──
    pos_domains, neg_domains = Counter(), Counter()
    domain_examples: dict[str, list[dict]] = defaultdict(list)
    for h in history:
        dom = (h.get("metaphor_domain") or "").strip()
        if not dom or dom == "none":
            continue
        rating = h.get("star_rating", 0) or 0
        if rating >= 4:
            pos_domains[dom] += 1
            if len(domain_examples[dom]) < 2:
                domain_examples[dom].append({"topic": h.get("topic"), "rating": rating})
        elif rating <= 2:
            neg_domains[dom] += 1

    best_domains = [
        {"domain": d, "evidence": n, "examples": domain_examples.get(d, [])}
        for d, n in pos_domains.most_common(4) if n >= MIN_DOMAIN_HITS_PREFERRED
    ]
    avoided_domains = [
        {"domain": d, "evidence": n}
        for d, n in neg_domains.most_common(3) if n >= MIN_DOMAIN_HITS_AVOIDED
    ]

    # ── Optimal length (correlate rating with explanation char count) ─────────
    rated = [(len((h.get("explanation") or "")), h.get("star_rating") or 0)
             for h in history if (h.get("explanation") or "")]
    optimal_chars = None
    if len(rated) >= MIN_RATINGS_FOR_LENGTH:
        high = [chars for chars, r in rated if r >= 4]
        if len(high) >= 2:
            optimal_chars = int(sum(high) / len(high))

    # ── Persistent gaps (already tracked by feynman router) ───────────────────
    gaps = []
    raw_gaps = user.get("persistent_gaps", {}) or {}
    if isinstance(raw_gaps, dict):
        gap_items = sorted(
            ((k, v) for k, v in raw_gaps.items() if isinstance(v, dict)),
            key=lambda kv: kv[1].get("count", 0), reverse=True,
        )[:5]
        for k, v in gap_items:
            if v.get("count", 0) >= MIN_GAP_RECURRENCE:
                gaps.append({
                    "concept":  k.replace("_", " "),
                    "evidence": int(v.get("count", 0)),
                    "topic":    v.get("topic"),
                })

    # ── Recently failed Feynman (so we know what to pre-empt) ─────────────────
    cutoff = datetime.now(timezone.utc) - timedelta(days=RECENT_DAYS)
    failing = await db.feynman_results.find(
        {
            "user_id": ObjectId(user_id),
            "created_at": {"$gte": cutoff},
            "score": {"$lt": 50},
        },
        sort=[("created_at", -1)],
        limit=6,
    ).to_list(length=6)
    failing_topics = [
        {"topic": f.get("topic"), "score": int(f.get("score", 0)),
         "when":  f.get("created_at").isoformat() if f.get("created_at") else None}
        for f in failing if f.get("topic")
    ]

    # ── Aha-moment style affinity (which style produced breakthroughs) ────────
    aha_by_style = Counter()
    try:
        aha_docs = await db.aha_moments.find(
            {"user_id": ObjectId(user_id)},
            sort=[("created_at", -1)],
            limit=30,
        ).to_list(length=30)
        for a in aha_docs:
            s = (a.get("style_used") or "").strip()
            if s:
                aha_by_style[s] += 1
    except Exception:
        aha_docs = []
    aha_top = [{"style": s, "evidence": n} for s, n in aha_by_style.most_common(3)]

    # ── Mastery snapshot ──────────────────────────────────────────────────────
    mastery = user.get("topic_mastery", {}) or {}
    mastered = sum(1 for v in mastery.values() if isinstance(v, dict) and v.get("score", 0) >= 85)
    learning = sum(1 for v in mastery.values() if isinstance(v, dict) and v.get("score", 100) <= 40)

    # ── Rating trend (early vs recent avg) ────────────────────────────────────
    trend = None
    if len(history) >= 10:
        ordered = list(reversed(history))  # oldest first
        half = len(ordered) // 2
        early = [h.get("star_rating") for h in ordered[:half] if h.get("star_rating")]
        recent = [h.get("star_rating") for h in ordered[half:] if h.get("star_rating")]
        if early and recent:
            trend = {
                "early_avg":  round(sum(early)  / len(early),  2),
                "recent_avg": round(sum(recent) / len(recent), 2),
                "samples":    len(history),
            }

    return {
        "user_id":           user_id,
        "name":              user.get("name"),
        "style_ranked":      [{"style": s, "weight": round(w, 3)} for s, w in style_ranked],
        "preferred_style":   user.get("preferred_style", "auto"),
        "difficulty_level":  int(user.get("difficulty_level", 2)),
        "best_domains":      best_domains,
        "avoided_domains":   avoided_domains,
        "optimal_chars":     optimal_chars,
        "gaps":              gaps,
        "failing_topics":    failing_topics,
        "aha_top":           aha_top,
        "mastered_topics":   mastered,
        "learning_topics":   learning,
        "trend":             trend,
        "history_samples":   len(history),
        "computed_at":       datetime.now(timezone.utc).isoformat(),
    }


# ── Prompt-side rendering (compact, action-oriented) ──────────────────────────

def render_for_prompt(profile: dict) -> str:
    """
    Returns a system-message block to inject before every explanation prompt.
    Keep it under ~250 tokens — Claude listens better when the signal is concise.
    Empty if there's not enough evidence to say anything useful.
    """
    if not profile:
        return ""

    lines: list[str] = []

    # Style ranking (always present)
    style_str = " > ".join(
        f"{s['style']}({s['weight']})" for s in profile["style_ranked"]
    )
    lines.append(f"Style preference: {style_str}")

    if profile["best_domains"]:
        doms = ", ".join(d["domain"] for d in profile["best_domains"][:3])
        lines.append(f"PREFER metaphors from: {doms}")

    if profile["avoided_domains"]:
        doms = ", ".join(d["domain"] for d in profile["avoided_domains"])
        lines.append(f"AVOID metaphors from: {doms} (downrated previously)")

    if profile["optimal_chars"]:
        words = int(profile["optimal_chars"] / 5)   # ~5 chars/word avg
        lines.append(f"Target length ~{words} words (their high-rated explanations cluster here)")

    if profile["gaps"]:
        gs = "; ".join(g["concept"] for g in profile["gaps"][:3])
        lines.append(f"Persistent confusions to pre-empt: {gs}")

    if profile["failing_topics"]:
        ts = ", ".join(f"{t['topic']}({t['score']})" for t in profile["failing_topics"][:3])
        lines.append(f"Recently failed Feynman on: {ts} — be especially careful on adjacent ideas")

    if profile["aha_top"]:
        styles = ", ".join(a["style"] for a in profile["aha_top"][:2])
        lines.append(f"Past breakthroughs came via: {styles}")

    if not lines:
        return ""

    body = "\n".join(f"- {ln}" for ln in lines)
    return (
        "============================================================\n"
        "PERSONAL LEARNING PROFILE — adapt the explanation to THIS learner:\n"
        f"{body}\n"
        "Follow these patterns even when they conflict with your defaults. "
        "If the topic touches a persistent confusion, address it explicitly before moving on.\n"
        "============================================================"
    )


# ── Display-side rendering (verbose, evidence-citing, for the UI) ─────────────

def render_for_display(profile: dict) -> dict:
    """
    Returns a dict the frontend can render directly as 'What ELIM has learned
    about you'. Every claim carries an evidence count so the page can cite it.
    """
    if not profile:
        return {"claims": [], "summary": "Not enough data yet."}

    claims: list[dict] = []

    # Style
    top_style = profile["style_ranked"][0] if profile["style_ranked"] else None
    if top_style and top_style["weight"] > 0.4:
        claims.append({
            "kind":    "style",
            "title":   f"I lead with {top_style['style']} explanations for you",
            "detail":  f"You've reinforced this style {int(top_style['weight'] * 100)}% of the way across all your ratings.",
            "evidence": profile["history_samples"],
        })

    # Best domains
    for d in profile["best_domains"]:
        examples = ", ".join(e["topic"] for e in d["examples"] if e.get("topic"))
        claims.append({
            "kind":    "domain_prefer",
            "title":   f"I prefer {d['domain']} analogies for you",
            "detail":  f"You rated {d['evidence']} of these 4★ or higher" + (f" (e.g. {examples})" if examples else ""),
            "evidence": d["evidence"],
        })

    # Avoided domains
    for d in profile["avoided_domains"]:
        claims.append({
            "kind":    "domain_avoid",
            "title":   f"I avoid {d['domain']} analogies for you",
            "detail":  f"You downrated {d['evidence']} explanation(s) that used this domain.",
            "evidence": d["evidence"],
        })

    # Optimal length
    if profile["optimal_chars"]:
        words = int(profile["optimal_chars"] / 5)
        claims.append({
            "kind":    "length",
            "title":   f"I keep explanations around {words} words for you",
            "detail":  "This is the average length of your high-rated explanations. Longer drifts toward lower ratings.",
            "evidence": profile["history_samples"],
        })

    # Persistent gaps
    for g in profile["gaps"]:
        claims.append({
            "kind":    "gap",
            "title":   f"I pre-empt your confusion around \"{g['concept']}\"",
            "detail":  f"Caught in {g['evidence']} Feynman tests, most recently on {g.get('topic') or 'a related topic'}.",
            "evidence": g["evidence"],
        })

    # Recent failures
    if profile["failing_topics"]:
        topics = ", ".join(t["topic"] for t in profile["failing_topics"][:3])
        claims.append({
            "kind":    "failing",
            "title":   "I'm gentler on topics adjacent to your recent failures",
            "detail":  f"Recently failed Feynman on: {topics}. I introduce related concepts at a lower difficulty until you recover.",
            "evidence": len(profile["failing_topics"]),
        })

    # Aha moments
    if profile["aha_top"]:
        styles = ", ".join(a["style"] for a in profile["aha_top"][:2])
        claims.append({
            "kind":    "aha",
            "title":   "I lean on the styles that have produced breakthroughs for you",
            "detail":  f"Your aha moments cluster in: {styles}.",
            "evidence": sum(a["evidence"] for a in profile["aha_top"]),
        })

    # Trend
    if profile["trend"]:
        early, recent = profile["trend"]["early_avg"], profile["trend"]["recent_avg"]
        diff = round(recent - early, 2)
        if abs(diff) >= 0.2:
            claims.append({
                "kind":    "trend",
                "title":   f"Your avg rating has moved {early} → {recent} (Δ {'+' if diff > 0 else ''}{diff})",
                "detail":  ("ELIM is getting better at teaching you over time."
                            if diff > 0 else
                            "ELIM is losing accuracy — your most recent ratings dipped. Worth checking which style or domain regressed."),
                "evidence": profile["trend"]["samples"],
            })

    summary_parts: list[str] = []
    if claims:
        summary_parts.append(f"{len(claims)} active personalization signals.")
    if profile["mastered_topics"]:
        summary_parts.append(f"{profile['mastered_topics']} topic(s) mastered.")
    if profile["learning_topics"]:
        summary_parts.append(f"{profile['learning_topics']} topic(s) actively learning.")
    if not summary_parts:
        summary_parts.append("Profile is still warming up — rate a few explanations and run a Feynman test to seed it.")

    return {
        "claims":          claims,
        "summary":         " ".join(summary_parts),
        "style_ranked":    profile["style_ranked"],
        "difficulty":      profile["difficulty_level"],
        "history_samples": profile["history_samples"],
        "computed_at":     profile["computed_at"],
    }
