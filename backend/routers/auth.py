from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Request
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId

from database import get_db
from services.auth import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_refresh_token, hash_refresh_token, refresh_token_expires_at,
)

router = APIRouter(prefix="/auth", tags=["auth"])

DEFAULT_STYLE_WEIGHTS = {"analogy": 0.33, "step-by-step": 0.33, "code-based": 0.34}


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    name: str = Field(..., min_length=1, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


def _user_response(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "preferred_style": user["preferred_style"],
        "difficulty_level": user["difficulty_level"],
        "style_weights": user["style_weights"],
    }


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest):
    db = get_db()
    if await db.users.find_one({"email": body.email}):
        raise HTTPException(status_code=400, detail="Email already registered")

    now = datetime.now(timezone.utc)
    user_doc = {
        "email": body.email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "preferred_style": "auto",
        "difficulty_level": 2,
        "style_weights": DEFAULT_STYLE_WEIGHTS.copy(),
        "enabled_mcp_sources": [],
        "mcp_tokens": {},
        "topic_history": [],
        "spaced_rep_queue": [],
        "created_at": now,
        "last_active": now,
    }
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)

    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)

    await db.sessions.insert_one({
        "user_id": result.inserted_id,
        "refresh_token": hash_refresh_token(refresh_token),
        "device_info": "",
        "expires_at": refresh_token_expires_at(),
    })

    user_doc["_id"] = result.inserted_id
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": _user_response(user_doc),
    }


@router.post("/login")
async def login(body: LoginRequest, request: Request):
    db = get_db()
    user = await db.users.find_one({"email": body.email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user_id = str(user["_id"])
    access_token = create_access_token(user_id)
    refresh_token = create_refresh_token(user_id)

    device_info = request.headers.get("user-agent", "")[:200]
    await db.sessions.insert_one({
        "user_id": user["_id"],
        "refresh_token": hash_refresh_token(refresh_token),
        "device_info": device_info,
        "expires_at": refresh_token_expires_at(),
    })

    await db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"last_active": datetime.now(timezone.utc)}},
    )

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "user": _user_response(user),
    }


@router.post("/refresh")
async def refresh(body: RefreshRequest):
    db = get_db()
    user_id = decode_refresh_token(body.refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    token_hash = hash_refresh_token(body.refresh_token)
    session = await db.sessions.find_one({"refresh_token": token_hash})
    if not session:
        raise HTTPException(status_code=401, detail="Session not found or already revoked")

    new_access = create_access_token(user_id)
    return {"access_token": new_access}


@router.post("/logout")
async def logout(body: LogoutRequest):
    db = get_db()
    token_hash = hash_refresh_token(body.refresh_token)
    await db.sessions.delete_one({"refresh_token": token_hash})
    return {"message": "Logged out"}
