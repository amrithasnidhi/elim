"""
Seed topic_mastery so the Peer Teaching Network has data.

Run:
    cd C:\\Users\\amrit\\elim\\backend
    python -m scripts.seed_peer_topics
"""

import asyncio
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

_root_env = Path(__file__).parent.parent.parent / ".env"
_backend_env = Path(__file__).parent.parent / ".env"
load_dotenv(_root_env)
load_dotenv(_backend_env)

sys.path.insert(0, str(Path(__file__).parent.parent))

from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

from services.auth import hash_password


# ── EDIT THIS to match the email on your ELIM account ────────────────────────
YOUR_EMAIL = "amrithasnidhi1234@gmail.com"

PARTNER_EMAIL    = "peer_partner@test.com"
PARTNER_PASSWORD = "peer1234"
PARTNER_NAME     = "Peer Partner"

DEFAULT_STYLE_WEIGHTS = {"analogy": 0.33, "step-by-step": 0.33, "code-based": 0.34}

# (topic, your_score, partner_score)
SEED_TOPICS = [
    ("binary search"           , 92  ,  28),
    ("recursion"               , 91  ,  22),
    ("dynamic programming"     , 88  ,  18),
    ("kubernetes"              , 25  ,  93),
    ("graph algorithms"        , 18  ,  90),
    ("linear algebra"          , 30  ,  87),
]


def topic_key(topic: str) -> str:
    return re.sub(r"[^a-z0-9_]", "_", topic.lower().strip())[:50]


def _full_user_doc(email: str, name: str, password: str) -> dict:
    """Match the schema /auth/register creates — every field _user_response needs."""
    now = datetime.now(timezone.utc)
    return {
        "email":               email,
        "password_hash":       hash_password(password),
        "name":                name,
        "preferred_style":     "auto",
        "difficulty_level":    2,
        "style_weights":       DEFAULT_STYLE_WEIGHTS.copy(),
        "enabled_mcp_sources": [],
        "mcp_tokens":          {},
        "topic_history":       [],
        "spaced_rep_queue":    [],
        "topic_mastery":       {},
        "created_at":          now,
        "last_active":         now,
    }


async def upsert_partner(db) -> ObjectId:
    existing = await db.users.find_one({"email": PARTNER_EMAIL})
    if existing:
        # Make sure the existing doc has the response-shape fields and a current password
        update = {
            "password_hash":    hash_password(PARTNER_PASSWORD),  # reset to known pw
            "preferred_style":  existing.get("preferred_style", "auto"),
            "difficulty_level": existing.get("difficulty_level", 2),
            "style_weights":    existing.get("style_weights", DEFAULT_STYLE_WEIGHTS.copy()),
            "name":             existing.get("name", PARTNER_NAME),
        }
        await db.users.update_one({"_id": existing["_id"]}, {"$set": update})
        print(f"  • Test partner already existed — refreshed password + required fields ({PARTNER_EMAIL})")
        return existing["_id"]
    res = await db.users.insert_one(_full_user_doc(PARTNER_EMAIL, PARTNER_NAME, PARTNER_PASSWORD))
    print(f"  ✓ Created test partner  {PARTNER_EMAIL}  (password: {PARTNER_PASSWORD})")
    return res.inserted_id


async def set_mastery(db, user_id: ObjectId, label: str, topic: str, score: int):
    key = topic_key(topic)
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {
            f"topic_mastery.{key}.score":       score,
            f"topic_mastery.{key}.sessions":    3,
            f"topic_mastery.{key}.last_tested": datetime.now(timezone.utc),
        }},
    )
    role = "TEACH" if score >= 85 else "LEARN" if score <= 40 else "  -  "
    print(f"    [{role}] {label}  topic_key={key:<24} score={score}")


async def main():
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    print(f"Connecting to {uri}\n")
    client = AsyncIOMotorClient(uri)
    db = client.elim

    # ── Look up your account ──────────────────────────────────────────────
    you = await db.users.find_one({"email": YOUR_EMAIL})
    if not you:
        print(f"  ✗ No user found with email {YOUR_EMAIL!r}.")
        # Be helpful: list known emails
        cursor = db.users.find({}, {"email": 1})
        known = [u.get("email") for u in await cursor.to_list(length=20)]
        if known:
            print("  Emails currently in DB:")
            for e in known:
                print(f"      - {e}")
            print(f"\n  Edit YOUR_EMAIL at the top of seed_peer_topics.py to one of these.")
        else:
            print("  The users collection is empty. Register an account first at /auth/register.")
        client.close()
        return

    print(f"  ✓ Found your user: {YOUR_EMAIL}  (id={you['_id']})\n")

    partner_id = await upsert_partner(db)

    print("\n  Setting topic mastery:\n")
    for topic, your_score, partner_score in SEED_TOPICS:
        await set_mastery(db, you["_id"],   "(you)    ", topic, your_score)
        await set_mastery(db, partner_id,   "(partner)", topic, partner_score)

    # ── Verify by reading back ────────────────────────────────────────────
    print("\n  Verifying...")
    you_after     = await db.users.find_one({"_id": you["_id"]})
    partner_after = await db.users.find_one({"_id": partner_id})

    def tally(doc):
        m = (doc or {}).get("topic_mastery", {}) or {}
        teach = sum(1 for d in m.values() if isinstance(d, dict) and d.get("score", 0) >= 85)
        learn = sum(1 for d in m.values() if isinstance(d, dict) and d.get("score", 100) <= 40)
        return len(m), teach, learn

    yt, yT, yL = tally(you_after)
    pt, pT, pL = tally(partner_after)
    print(f"    you     : {yt} topics total | TEACH-eligible: {yT} | LEARN-eligible: {yL}")
    print(f"    partner : {pt} topics total | TEACH-eligible: {pT} | LEARN-eligible: {pL}")

    print("\nDone.")
    print(f"  → Refresh /peer in your tab — TEACH should now show {yT}, LEARN should show {yL}.")
    print(f"  → Incognito → log in as {PARTNER_EMAIL} / {PARTNER_PASSWORD}.")
    print(f"  → Click any matching topic on both sides to test the live session.")
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
