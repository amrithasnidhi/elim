#!/usr/bin/env python3
"""
ELIM Setup Verification Script
Checks if all environment variables, dependencies, and connections are properly configured.
"""

import asyncio
import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv

# Load .env - check project root first, then backend folder
_root_env = Path(__file__).parent.parent / ".env"
_backend_env = Path(__file__).parent / ".env"
load_dotenv(_root_env)
load_dotenv(_backend_env)

# ANSI colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
BLUE = "\033[94m"
RESET = "\033[0m"
BOLD = "\033[1m"


def ok(msg: str) -> None:
    print(f"  {GREEN}[OK]{RESET} {msg}")


def fail(msg: str) -> None:
    print(f"  {RED}[FAIL]{RESET} {msg}")


def warn(msg: str) -> None:
    print(f"  {YELLOW}[WARN]{RESET} {msg}")


def info(msg: str) -> None:
    print(f"  {BLUE}[INFO]{RESET} {msg}")


def section(title: str) -> None:
    print(f"\n{BOLD}=== {title} ==={RESET}")


# Track overall status
all_checks_passed = True
critical_failures = []


def check_env_var(name: str, required: bool = True, secret: bool = False) -> bool:
    global all_checks_passed
    value = os.getenv(name, "").strip()
    if value:
        display = f"{value[:8]}..." if secret and len(value) > 8 else value
        if secret:
            display = f"{value[:4]}***{value[-4:]}" if len(value) > 8 else "***"
        ok(f"{name} = {display}")
        return True
    elif required:
        fail(f"{name} is NOT SET (required)")
        all_checks_passed = False
        critical_failures.append(name)
        return False
    else:
        warn(f"{name} is not set (optional)")
        return False


def check_module(module_name: str, package_name: str = None) -> bool:
    global all_checks_passed
    try:
        __import__(module_name)
        ok(f"{package_name or module_name} installed")
        return True
    except ImportError as e:
        fail(f"{package_name or module_name} NOT installed: {e}")
        all_checks_passed = False
        return False


async def check_mongodb() -> bool:
    global all_checks_passed
    try:
        from motor.motor_asyncio import AsyncIOMotorClient
        uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        db_name = os.getenv("DATABASE_NAME", "elim")
        client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=5000)
        await client.admin.command("ping")
        ok(f"MongoDB connected at {uri}")

        # Check if database exists
        db = client[db_name]
        collections = await db.list_collection_names()
        info(f"Database '{db_name}' has {len(collections)} collections")
        return True
    except Exception as e:
        fail(f"MongoDB connection failed: {e}")
        all_checks_passed = False
        critical_failures.append("MongoDB")
        return False


async def check_redis() -> bool:
    global all_checks_passed
    try:
        import redis.asyncio as aioredis
        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        r = aioredis.from_url(url, socket_connect_timeout=5)
        await r.ping()
        await r.aclose()
        ok(f"Redis connected at {url}")
        return True
    except Exception as e:
        warn(f"Redis connection failed: {e} (needed for Celery workers)")
        return False


async def check_anthropic() -> bool:
    key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not key:
        warn("ANTHROPIC_API_KEY not set - will use Groq fallback")
        return False
    try:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=key)
        # Just validate key format, don't make actual API call
        if len(key) > 20:
            ok("ANTHROPIC_API_KEY format looks valid")
            return True
        else:
            warn("ANTHROPIC_API_KEY seems too short")
            return False
    except Exception as e:
        warn(f"Anthropic setup issue: {e}")
        return False


async def check_groq() -> bool:
    key = os.getenv("GROQ_API_KEY", "").strip()
    if not key:
        warn("GROQ_API_KEY not set")
        return False
    try:
        import groq
        if len(key) > 20:
            ok("GROQ_API_KEY format looks valid")
            return True
        else:
            warn("GROQ_API_KEY seems too short")
            return False
    except Exception as e:
        warn(f"Groq setup issue: {e}")
        return False


async def check_gemini() -> bool:
    global all_checks_passed
    key = os.getenv("GEMINI_API_KEY", "").strip()
    if not key:
        fail("GEMINI_API_KEY not set (required for embeddings)")
        all_checks_passed = False
        critical_failures.append("GEMINI_API_KEY")
        return False
    try:
        import google.generativeai as genai
        genai.configure(api_key=key)
        # Test embedding with new model
        result = genai.embed_content(
            model="models/gemini-embedding-001",
            content="test",
            task_type="retrieval_document",
            output_dimensionality=768,
        )
        if len(result["embedding"]) == 768:
            ok(f"Gemini embeddings working (768 dimensions)")
            return True
        else:
            warn(f"Gemini embedding dimension mismatch: {len(result['embedding'])}")
            return False
    except Exception as e:
        fail(f"Gemini API error: {e}")
        all_checks_passed = False
        critical_failures.append("GEMINI_API_KEY")
        return False


async def check_elevenlabs() -> bool:
    key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not key:
        warn("ELEVENLABS_API_KEY not set - will use Gemini TTS fallback")
        return False
    try:
        if len(key) > 20:
            ok("ELEVENLABS_API_KEY format looks valid")
            return True
        else:
            warn("ELEVENLABS_API_KEY seems too short")
            return False
    except Exception as e:
        warn(f"ElevenLabs setup issue: {e}")
        return False


def check_llm_available() -> bool:
    global all_checks_passed
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    groq_key = os.getenv("GROQ_API_KEY", "").strip()

    if anthropic_key:
        ok("LLM available: Anthropic (primary)")
        return True
    elif groq_key:
        ok("LLM available: Groq (fallback)")
        return True
    else:
        fail("NO LLM CONFIGURED! Set ANTHROPIC_API_KEY or GROQ_API_KEY")
        all_checks_passed = False
        critical_failures.append("LLM (ANTHROPIC or GROQ)")
        return False


def check_tts_available() -> bool:
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()

    if elevenlabs_key:
        ok("TTS available: ElevenLabs (primary)")
        return True
    elif gemini_key:
        ok("TTS available: Gemini/Google Cloud (fallback)")
        return True
    else:
        warn("No TTS configured - audio features won't work")
        return False


def check_encryption_key() -> bool:
    global all_checks_passed
    key = os.getenv("ENCRYPTION_KEY", "").strip()
    if not key or key == "replace_with_fernet_key":
        fail("ENCRYPTION_KEY not set or using placeholder")
        info("Generate with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"")
        all_checks_passed = False
        critical_failures.append("ENCRYPTION_KEY")
        return False
    try:
        from cryptography.fernet import Fernet
        Fernet(key.encode())
        ok("ENCRYPTION_KEY is valid Fernet key")
        return True
    except Exception as e:
        fail(f"ENCRYPTION_KEY is invalid: {e}")
        all_checks_passed = False
        critical_failures.append("ENCRYPTION_KEY")
        return False


def check_jwt_secrets() -> bool:
    global all_checks_passed
    jwt_secret = os.getenv("JWT_SECRET", "").strip()
    jwt_refresh = os.getenv("JWT_REFRESH_SECRET", "").strip()

    ok_count = 0
    if jwt_secret and jwt_secret != "replace_with_64_char_hex" and len(jwt_secret) >= 32:
        ok("JWT_SECRET is set")
        ok_count += 1
    else:
        fail("JWT_SECRET not set or too short (need 32+ chars)")
        all_checks_passed = False
        critical_failures.append("JWT_SECRET")

    if jwt_refresh and jwt_refresh != "replace_with_different_64_char_hex" and len(jwt_refresh) >= 32:
        ok("JWT_REFRESH_SECRET is set")
        ok_count += 1
    else:
        fail("JWT_REFRESH_SECRET not set or too short (need 32+ chars)")
        all_checks_passed = False
        critical_failures.append("JWT_REFRESH_SECRET")

    return ok_count == 2


def check_chromadb() -> bool:
    try:
        import chromadb
        host = os.getenv("CHROMADB_HOST", "")
        path = os.getenv("CHROMADB_PATH", "./chromadb_data")

        if host and host not in ("localhost", "embedded"):
            info(f"ChromaDB configured for remote: {host}")
        else:
            # Test local persistent client
            client = chromadb.PersistentClient(path=path)
            ok(f"ChromaDB local storage: {path}")
        return True
    except Exception as e:
        warn(f"ChromaDB issue: {e}")
        return False


def check_file_structure() -> bool:
    required_files = [
        "backend/main.py",
        "backend/database.py",
        "backend/dependencies.py",
        "backend/services/llm_service.py",
        "backend/services/rag_pipeline.py",
        "backend/services/mcp_manager.py",
        "backend/routers/explain.py",
        "backend/routers/mcp.py",
        "backend/workers/tts.py",
        "backend/workers/indexing.py",
        "frontend/package.json",
        "frontend/src/main.jsx",
    ]

    base = Path(__file__).parent.parent
    missing = []
    for f in required_files:
        if not (base / f).exists():
            missing.append(f)

    if missing:
        for f in missing:
            fail(f"Missing file: {f}")
        return False
    else:
        ok(f"All {len(required_files)} required files present")
        return True


async def main():
    global all_checks_passed

    print(f"\n{BOLD}ELIM Setup Verification{RESET}")
    print("=" * 50)

    # 1. Check Python modules
    section("Python Dependencies")
    check_module("fastapi")
    check_module("uvicorn")
    check_module("motor")
    check_module("anthropic")
    check_module("groq")
    check_module("google.generativeai", "google-generativeai")
    check_module("chromadb")
    check_module("tiktoken")
    check_module("celery")
    check_module("redis")
    check_module("elevenlabs")
    check_module("sentry_sdk", "sentry-sdk")

    # 2. Check environment variables
    section("Environment Variables - Core")
    check_env_var("APP_BASE_URL", required=False)
    check_env_var("FRONTEND_URL", required=False)
    check_env_var("DATABASE_NAME", required=False)

    section("Environment Variables - Security")
    check_jwt_secrets()
    check_encryption_key()

    section("Environment Variables - AI Providers")
    check_env_var("ANTHROPIC_API_KEY", required=False, secret=True)
    check_env_var("GROQ_API_KEY", required=False, secret=True)
    check_env_var("GEMINI_API_KEY", required=True, secret=True)
    check_env_var("ELEVENLABS_API_KEY", required=False, secret=True)

    # 3. Check service availability
    section("Service Availability")
    check_llm_available()
    check_tts_available()

    # 4. Check connections
    section("Database Connections")
    await check_mongodb()
    await check_redis()

    # 5. Check API connectivity
    section("API Connectivity")
    await check_gemini()
    await check_anthropic()
    await check_groq()
    await check_elevenlabs()

    # 6. Check ChromaDB
    section("Vector Store")
    check_chromadb()

    # 7. Check file structure
    section("File Structure")
    check_file_structure()

    # Summary
    print("\n" + "=" * 50)
    if all_checks_passed:
        print(f"{GREEN}{BOLD}ALL CRITICAL CHECKS PASSED!{RESET}")
        print(f"\nYou can start the application:")
        print(f"  Backend:  cd backend && uvicorn main:app --reload")
        print(f"  Frontend: cd frontend && npm run dev")
        print(f"  Workers:  cd backend && celery -A workers.celery_app worker --loglevel=info")
    else:
        print(f"{RED}{BOLD}SOME CRITICAL CHECKS FAILED!{RESET}")
        print(f"\nFix these issues before running the application:")
        for item in critical_failures:
            print(f"  - {item}")

    print()
    return 0 if all_checks_passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
