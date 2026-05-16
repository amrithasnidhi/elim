import logging
import traceback
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from database import get_db
from dependencies import get_current_user_id
from services.constellation import build_constellation

log = logging.getLogger(__name__)

router = APIRouter(prefix="/constellation", tags=["constellation"])

# In-memory cache: {user_id: {data, ts}}
_cache: dict[str, dict] = {}
CACHE_TTL_MINUTES = 30


async def _persist_snapshot(user_id: str, data: dict):
    db = get_db()
    await db.constellation_snapshots.update_one(
        {"user_id": ObjectId(user_id)},
        {
            "$push": {"snapshots": {
                "generated_at": data["generated_at"],
                "stats":        data["stats"],
                "node_count":   len(data["nodes"]),
            }},
            "$set": {"last_data": data},
        },
        upsert=True,
    )


@router.get("")
async def get_constellation(
    force_rebuild: bool = False,
    background_tasks: BackgroundTasks = None,
    user_id: str = Depends(get_current_user_id),
):
    """
    Get the user's constellation graph.
    Cached 30 minutes. Pass ?force_rebuild=true to bypass cache.
    Building from scratch takes 5-15s for large graphs.
    """
    cached = _cache.get(user_id)
    if cached and not force_rebuild:
        age = (datetime.now(timezone.utc) - cached["ts"]).total_seconds() / 60
        if age < CACHE_TTL_MINUTES:
            return cached["data"]

    db = get_db()
    if not force_rebuild:
        snapshot_doc = await db.constellation_snapshots.find_one({"user_id": ObjectId(user_id)})
        if snapshot_doc and snapshot_doc.get("last_data"):
            last = snapshot_doc["last_data"]
            gen_at = last.get("generated_at")
            if gen_at:
                if isinstance(gen_at, str):
                    gen_at = datetime.fromisoformat(gen_at.replace("Z", "+00:00"))
                if gen_at.tzinfo is None:
                    gen_at = gen_at.replace(tzinfo=timezone.utc)
                age = (datetime.now(timezone.utc) - gen_at).total_seconds() / 60
                if age < CACHE_TTL_MINUTES:
                    _cache[user_id] = {"data": last, "ts": datetime.now(timezone.utc)}
                    return last

    try:
        data = await build_constellation(user_id)
    except Exception as exc:
        log.error("build_constellation failed for %s: %s", user_id, traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Constellation build failed: {exc}")
    _cache[user_id] = {"data": data, "ts": datetime.now(timezone.utc)}

    if background_tasks:
        background_tasks.add_task(_persist_snapshot, user_id, data)

    return data


@router.get("/snapshots")
async def get_snapshots(user_id: str = Depends(get_current_user_id)):
    """Returns the last 30 historical snapshots for the time-scrubber."""
    db = get_db()
    doc = await db.constellation_snapshots.find_one({"user_id": ObjectId(user_id)})
    if not doc:
        return {"snapshots": []}
    return {"snapshots": doc.get("snapshots", [])[-30:]}


@router.post("/invalidate")
async def invalidate_cache(user_id: str = Depends(get_current_user_id)):
    """Clear in-memory cache for this user. Called after new explanations."""
    _cache.pop(user_id, None)
    return {"invalidated": True}
