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

# Response models for better Swagger docs
from typing import Dict, Any

DEFAULT_STYLE_WEIGHTS = {"analogy": 0.33, "step-by-step": 0.33, "code-based": 0.34}


class RegisterRequest(BaseModel):
    """User registration request."""
    email: EmailStr = Field(..., description="User's email address", examples=["user@example.com"])
    password: str = Field(..., min_length=8, description="Password (min 8 characters)")
    name: str = Field(..., min_length=1, max_length=100, description="Display name", examples=["John Doe"])

    model_config = {"json_schema_extra": {"examples": [{"email": "user@example.com", "password": "securepassword123", "name": "John Doe"}]}}


class LoginRequest(BaseModel):
    """User login request."""
    email: EmailStr = Field(..., description="Registered email address")
    password: str = Field(..., description="Account password")

    model_config = {"json_schema_extra": {"examples": [{"email": "user@example.com", "password": "securepassword123"}]}}


class RefreshRequest(BaseModel):
    """Token refresh request."""
    refresh_token: str = Field(..., description="Valid refresh token from login/register")


class LogoutRequest(BaseModel):
    """Logout request."""
    refresh_token: str = Field(..., description="Refresh token to invalidate")


class AuthResponse(BaseModel):
    """Authentication response with tokens and user info."""
    access_token: str = Field(..., description="JWT access token (expires in 15 min)")
    refresh_token: str = Field(..., description="Refresh token (expires in 7 days)")
    user: Dict[str, Any] = Field(..., description="User profile information")


def _user_response(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user["name"],
        "preferred_style": user["preferred_style"],
        "difficulty_level": user["difficulty_level"],
        "style_weights": user["style_weights"],
    }


@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=AuthResponse,
    summary="Register new user",
    description="Create a new user account and return authentication tokens.",
)
async def register(body: RegisterRequest):
    """
    Register a new user account.

    - Creates user with default preferences (auto style, difficulty level 2)
    - Returns access token (15 min) and refresh token (7 days)
    - Initializes empty MCP sources and learning history
    """
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


@router.post(
    "/login",
    response_model=AuthResponse,
    summary="User login",
    description="Authenticate with email and password to receive access tokens.",
)
async def login(body: LoginRequest, request: Request):
    """
    Authenticate a user and return tokens.

    - Validates email and password
    - Creates new session with device info
    - Returns access token (15 min) and refresh token (7 days)
    """
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


@router.post(
    "/refresh",
    summary="Refresh access token",
    description="Exchange a valid refresh token for a new access token.",
)
async def refresh(body: RefreshRequest):
    """
    Get a new access token using a refresh token.

    - Validates refresh token and checks session exists
    - Returns new access token (15 min expiry)
    - Refresh token remains valid until logout or expiration
    """
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


@router.post(
    "/logout",
    summary="Logout user",
    description="Invalidate the refresh token and end the session.",
)
async def logout(body: LogoutRequest):
    """
    Logout by invalidating the refresh token.

    - Deletes the session from database
    - Access token remains valid until expiration (15 min max)
    """
    db = get_db()
    token_hash = hash_refresh_token(body.refresh_token)
    await db.sessions.delete_one({"refresh_token": token_hash})
    return {"message": "Logged out"}
