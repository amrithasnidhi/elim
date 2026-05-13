import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env BEFORE importing other modules
# Check both project root and backend folder
_this_dir = Path(__file__).resolve().parent
_root_env = _this_dir.parent / ".env"
_backend_env = _this_dir / ".env"

if _root_env.exists():
    load_dotenv(_root_env)
if _backend_env.exists():
    load_dotenv(_backend_env)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from database import connect_db, close_db, get_db
from routers import explain, auth, profile, feedback, mcp, voice

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


API_DESCRIPTION = """
## ELIM — Explain Like I'm Me

An adaptive AI learning system that generates personalized explanations based on your learning style and knowledge level.

### Features

- **Adaptive Explanations**: Get explanations in your preferred style (analogy, step-by-step, code-based)
- **Multi-Style Comparison**: Compare explanations across different styles simultaneously
- **Socratic Learning**: Engage in guided discovery through questions
- **Knowledge Sources**: Connect Google Drive, Notion, and GitHub for personalized context
- **Spaced Repetition**: SM-2 algorithm for optimal review scheduling
- **Voice Input/Output**: Transcribe audio and generate TTS for explanations
- **Diagrams**: Auto-generate Mermaid.js diagrams for visual learners

### Authentication

All endpoints except `/auth/*` and `/health` require a Bearer token:
```
Authorization: Bearer <access_token>
```

### LLM Providers

- **Primary**: Anthropic Claude (if `ANTHROPIC_API_KEY` is set)
- **Fallback**: Groq LLaMA (if `GROQ_API_KEY` is set)
"""

TAGS_METADATA = [
    {"name": "auth", "description": "User registration, login, and token management"},
    {"name": "explain", "description": "Generate AI explanations, diagrams, audio, and follow-up chat"},
    {"name": "profile", "description": "User profile, learning history, and preferences"},
    {"name": "feedback", "description": "Rate explanations and view learning analytics"},
    {"name": "mcp", "description": "Connect external knowledge sources (Google Drive, Notion, GitHub)"},
    {"name": "voice", "description": "Voice transcription using Gemini"},
]

app = FastAPI(
    title="ELIM API",
    description=API_DESCRIPTION,
    version="3.0.0",
    lifespan=lifespan,
    openapi_tags=TAGS_METADATA,
    docs_url="/docs",
    redoc_url="/redoc",
    contact={
        "name": "ELIM Support",
        "url": "https://github.com/your-repo/elim",
    },
    license_info={
        "name": "MIT",
    },
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

_static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(os.path.join(_static_dir, "audio"), exist_ok=True)
app.mount("/static", StaticFiles(directory=_static_dir), name="static")


@app.get(
    "/health",
    tags=["system"],
    summary="Health check",
    description="Check API and database connectivity status.",
    response_description="Health status with database connection state",
)
async def health():
    """
    Returns the health status of the API.

    - **status**: Always "ok" if the API is responding
    - **db**: "connected" or "disconnected" based on MongoDB connectivity
    - **version**: Current API version
    """
    db = get_db()
    try:
        await db.command("ping")
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    return {"status": "ok", "db": db_status, "version": "3.0.0"}
