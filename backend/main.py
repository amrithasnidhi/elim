import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from dotenv import load_dotenv

from database import connect_db, close_db, get_db
from routers import explain, auth, profile, feedback, mcp, voice, images

load_dotenv()

# Sentry — no-op if SENTRY_DSN is not set
_sentry_dsn = os.getenv("SENTRY_DSN_BACKEND", "")
if _sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration
    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.getenv("ENV", "production"),
        traces_sample_rate=0.2,
        integrations=[StarletteIntegration(), FastApiIntegration()],
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    db = get_db()
    await db.users.create_index("email", unique=True)
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.history.create_index("user_id")
    await db.spaced_rep.create_index([("user_id", 1), ("topic", 1)], unique=True)
    await db.spaced_rep.create_index("next_review")
    yield
    await close_db()


app = FastAPI(
    title="ELIM — Explain Like I'm Me",
    description="Adaptive AI learning system with personalised explanations",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(explain.router)
app.include_router(profile.router)
app.include_router(feedback.router)
app.include_router(mcp.router)
app.include_router(voice.router)
app.include_router(images.router)

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
    return {"status": "ok", "db": db_status, "version": "3.0.0"}
