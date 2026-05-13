import os
import secrets
import urllib.parse
from typing import Optional

import httpx
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel

from database import get_db
from dependencies import get_current_user_id
from services.mcp_manager import SOURCE_LABELS, encrypt_token
from services.rag_pipeline import get_rag_pipeline

router = APIRouter(prefix="/mcp", tags=["mcp"])

# Slack removed — not needed for Phase 1-8
ALL_SOURCES = ["gdrive", "notion", "github", "web"]

OAUTH_CONFIG: dict[str, dict] = {
    "gdrive": {
        "auth_url": "https://accounts.google.com/o/oauth2/v2/auth",
        "token_url": "https://oauth2.googleapis.com/token",
        "scope": "https://www.googleapis.com/auth/drive.readonly",
        "client_id_env": "GOOGLE_CLIENT_ID",
        "client_secret_env": "GOOGLE_CLIENT_SECRET",
        "extra_params": {"access_type": "offline", "prompt": "consent"},
    },
    "notion": {
        "auth_url": "https://api.notion.com/v1/oauth/authorize",
        "token_url": "https://api.notion.com/v1/oauth/token",
        "scope": "read_content",
        "client_id_env": "NOTION_CLIENT_ID",
        "client_secret_env": "NOTION_CLIENT_SECRET",
        "extra_params": {"owner": "user"},
    },
    "github": {
        "auth_url": "https://github.com/login/oauth/authorize",
        "token_url": "https://github.com/login/oauth/access_token",
        "scope": "repo read:user",
        "client_id_env": "GITHUB_CLIENT_ID",
        "client_secret_env": "GITHUB_CLIENT_SECRET",
        "extra_params": {},
    },
}


def _callback_uri(source: str) -> str:
    base = os.getenv("APP_BASE_URL", "http://localhost:8000")
    return f"{base}/mcp/oauth/callback/{source}"


def _make_state(user_id: str, source: str) -> str:
    secret = os.getenv("JWT_SECRET", "changeme")
    return jwt.encode(
        {"user_id": user_id, "source": source, "nonce": secrets.token_hex(8)},
        secret,
        algorithm="HS256",
    )


def _parse_state(state: str) -> tuple[str, str]:
    secret = os.getenv("JWT_SECRET", "changeme")
    try:
        payload = jwt.decode(state, secret, algorithms=["HS256"])
        return payload["user_id"], payload["source"]
    except JWTError:
        raise HTTPException(status_code=400, detail="Invalid OAuth state parameter")


# ── GET /mcp/sources ──────────────────────────────────────────────────────────

@router.get("/sources")
async def list_sources(user_id: str = Depends(get_current_user_id)):
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    mcp_tokens: dict = user.get("mcp_tokens", {})
    enabled: list = user.get("enabled_mcp_sources", ["web"])
    last_indexed: dict = user.get("mcp_last_indexed", {})
    doc_counts: dict = user.get("mcp_doc_counts", {})

    sources = []
    for src in ALL_SOURCES:
        cfg = OAUTH_CONFIG.get(src, {})
        configured = src == "web" or bool(
            os.getenv(cfg.get("client_id_env", "")) and
            os.getenv(cfg.get("client_secret_env", ""))
        )
        sources.append({
            "key": src,
            "label": SOURCE_LABELS.get(src, src.title()),
            "connected": src in mcp_tokens or src == "web",
            "enabled": src in enabled,
            "configured": configured,
            "last_indexed": last_indexed.get(src),
            "doc_count": doc_counts.get(src, 0),
        })
    return {"sources": sources}


# ── POST /mcp/sources/toggle ──────────────────────────────────────────────────

class ToggleRequest(BaseModel):
    source: str
    enabled: bool


@router.post("/sources/toggle")
async def toggle_source(body: ToggleRequest, user_id: str = Depends(get_current_user_id)):
    if body.source not in ALL_SOURCES:
        raise HTTPException(status_code=400, detail="Unknown source")
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    enabled: list = list(user.get("enabled_mcp_sources", ["web"]))
    if body.enabled and body.source not in enabled:
        enabled.append(body.source)
    elif not body.enabled and body.source in enabled:
        enabled.remove(body.source)
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"enabled_mcp_sources": enabled}},
    )
    return {"enabled_mcp_sources": enabled}


# ── OAuth flow ────────────────────────────────────────────────────────────────

@router.get("/oauth/start/{source}")
async def oauth_start(source: str, user_id: str = Depends(get_current_user_id)):
    if source not in OAUTH_CONFIG:
        raise HTTPException(status_code=400, detail="Unknown OAuth source")
    cfg = OAUTH_CONFIG[source]
    client_id = os.getenv(cfg["client_id_env"])
    if not client_id:
        raise HTTPException(status_code=503, detail=f"{source} OAuth not configured on this server")

    state = _make_state(user_id, source)
    params = {
        "client_id": client_id,
        "redirect_uri": _callback_uri(source),
        "scope": cfg["scope"],
        "response_type": "code",
        "state": state,
        **cfg.get("extra_params", {}),
    }
    auth_url = cfg["auth_url"] + "?" + urllib.parse.urlencode(params)
    return {"auth_url": auth_url}


@router.get("/oauth/callback/{source}")
async def oauth_callback(
    source: str,
    code: str = Query(...),
    state: str = Query(...),
    error: Optional[str] = Query(default=None),
):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    if error:
        return RedirectResponse(url=f"{frontend_url}/settings/sources?error={error}")

    if source not in OAUTH_CONFIG:
        raise HTTPException(status_code=400, detail="Unknown source")

    user_id, claimed_source = _parse_state(state)
    if claimed_source != source:
        raise HTTPException(status_code=400, detail="OAuth state mismatch")

    cfg = OAUTH_CONFIG[source]
    client_id = os.getenv(cfg["client_id_env"])
    client_secret = os.getenv(cfg["client_secret_env"])

    async with httpx.AsyncClient() as http:
        resp = await http.post(
            cfg["token_url"],
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": _callback_uri(source),
                "grant_type": "authorization_code",
            },
            headers={"Accept": "application/json"},
        )

    if resp.status_code != 200:
        return RedirectResponse(url=f"{frontend_url}/settings/sources?error=token_exchange_failed")

    token_data = resp.json()
    access_token = (
        token_data.get("access_token")
        or token_data.get("authed_user", {}).get("access_token")
    )
    if not access_token:
        return RedirectResponse(url=f"{frontend_url}/settings/sources?error=no_token")

    try:
        encrypted = encrypt_token(access_token)
    except ValueError:
        return RedirectResponse(url=f"{frontend_url}/settings/sources?error=encryption_not_configured")

    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {f"mcp_tokens.{source}": encrypted},
            "$addToSet": {"enabled_mcp_sources": source},
        },
    )
    return RedirectResponse(url=f"{frontend_url}/settings/sources?connected={source}")


# ── POST /mcp/connect/:source (PAT / manual token) ───────────────────────────

class ConnectRequest(BaseModel):
    token: str


@router.post("/connect/{source}")
async def connect_with_token(
    source: str,
    body: ConnectRequest,
    user_id: str = Depends(get_current_user_id),
):
    if source not in ("gdrive", "notion", "github"):
        raise HTTPException(status_code=400, detail="Cannot manually connect this source")
    try:
        encrypted = encrypt_token(body.token)
    except ValueError:
        raise HTTPException(status_code=503, detail="ENCRYPTION_KEY not configured on server")
    db = get_db()
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$set": {f"mcp_tokens.{source}": encrypted},
            "$addToSet": {"enabled_mcp_sources": source},
        },
    )
    return {"connected": True, "source": source}


# ── DELETE /mcp/disconnect/:source ───────────────────────────────────────────

@router.delete("/disconnect/{source}")
async def disconnect_source(source: str, user_id: str = Depends(get_current_user_id)):
    if source not in ("gdrive", "notion", "github"):
        raise HTTPException(status_code=400, detail="Cannot disconnect this source")
    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    enabled = [s for s in user.get("enabled_mcp_sources", []) if s != source]
    await db.users.update_one(
        {"_id": ObjectId(user_id)},
        {
            "$unset": {
                f"mcp_tokens.{source}": "",
                f"mcp_doc_counts.{source}": "",
                f"mcp_last_indexed.{source}": "",
            },
            "$set": {"enabled_mcp_sources": enabled},
        },
    )
    # Remove indexed chunks from ChromaDB
    pipeline = get_rag_pipeline()
    if pipeline:
        pipeline.delete_source(user_id, source)
    return {"disconnected": True, "source": source}


# ── POST /mcp/index & GET /mcp/index/status ──────────────────────────────────

class IndexRequest(BaseModel):
    source: str
    force: bool = False


@router.post("/index")
async def trigger_index(body: IndexRequest, user_id: str = Depends(get_current_user_id)):
    if body.source not in ("gdrive", "notion", "github"):
        raise HTTPException(status_code=400, detail="Cannot index this source")
    try:
        from workers.indexing import index_source
        task = index_source.delay(user_id, body.source)
        return {"job_id": task.id}
    except Exception:
        raise HTTPException(status_code=503, detail="Celery worker not available — start Redis and the worker first")


@router.get("/index/status")
async def index_status(job_id: str = Query(...), user_id: str = Depends(get_current_user_id)):
    try:
        from workers.celery_app import celery_app
        result = celery_app.AsyncResult(job_id)
        if result.state == "PENDING":
            return {"status": "queued", "progress_pct": 0, "files_indexed": 0}
        if result.state == "STARTED":
            return {"status": "running", "progress_pct": 5, "files_indexed": 0}
        if result.state == "PROGRESS":
            info = result.info or {}
            return {"status": "running", **info}
        if result.state == "SUCCESS":
            info = result.result or {}
            return {"status": "done", "progress_pct": 100, **info}
        if result.state == "FAILURE":
            return {"status": "failed", "error": str(result.info), "progress_pct": 0, "files_indexed": 0}
        return {"status": result.state.lower(), "progress_pct": 0, "files_indexed": 0}
    except Exception:
        raise HTTPException(status_code=503, detail="Cannot reach Celery backend")


# ── GET /mcp/indexed-docs ─────────────────────────────────────────────────────

@router.get("/indexed-docs")
async def indexed_docs(
    source: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, le=50),
    user_id: str = Depends(get_current_user_id),
):
    pipeline = get_rag_pipeline()
    if not pipeline:
        return {"docs": [], "page": page, "total": 0}

    offset = (page - 1) * limit
    docs = pipeline.get_chunks(user_id, source=source, offset=offset, limit=limit)
    total = pipeline.chunk_count(user_id, source=source)
    return {"docs": docs, "page": page, "total": total}
