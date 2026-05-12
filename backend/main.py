import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from database import connect_db, close_db, get_db
from routers import explain, auth, profile, feedback, mcp, voice

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    db = get_db()
    # Ensure indexes
    await db.users.create_index("email", unique=True)
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)  # TTL index
    await db.history.create_index("user_id")
    yield
    await close_db()


app = FastAPI(
    title="ELIM — Explain Like I'm Me",
    description="Adaptive AI learning system with personalised explanations",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(explain.router)
app.include_router(profile.router)
app.include_router(feedback.router)
app.include_router(mcp.router)
app.include_router(voice.router)

# Serve locally-generated audio files when S3 is not configured
_static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(os.path.join(_static_dir, "audio"), exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_dir), name="static")


@app.get("/health")
async def health():
    db = get_db()
    try:
        await db.command("ping")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    return {"status": "ok", "db": db_status}
