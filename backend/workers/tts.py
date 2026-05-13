"""
TTS Worker with fallback logic:
- Primary: ElevenLabs (if ELEVENLABS_API_KEY is set)
- Fallback: Gemini TTS (if GEMINI_API_KEY is set)
"""

import asyncio
import os

import pymongo
from bson import ObjectId

from workers.celery_app import celery_app


def _sync_db():
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "elim")
    return pymongo.MongoClient(uri)[db_name]


def _upload_audio(audio_bytes: bytes, history_id: str, file_ext: str = "mp3") -> str:
    """Upload audio to S3 if configured, otherwise save to local static dir."""
    bucket = os.getenv("S3_BUCKET_NAME", "")
    if bucket:
        try:
            import boto3
            s3 = boto3.client(
                "s3",
                aws_access_key_id=os.getenv("S3_ACCESS_KEY"),
                aws_secret_access_key=os.getenv("S3_SECRET_KEY"),
                endpoint_url=os.getenv("S3_ENDPOINT_URL") or None,
            )
            content_type = "audio/mpeg" if file_ext == "mp3" else "audio/wav"
            key = f"audio/{history_id}.{file_ext}"
            s3.put_object(Bucket=bucket, Key=key, Body=audio_bytes, ContentType=content_type)
            endpoint = os.getenv("S3_ENDPOINT_URL", "")
            if endpoint:
                return f"{endpoint.rstrip('/')}/{bucket}/{key}"
            return f"https://{bucket}.s3.amazonaws.com/{key}"
        except Exception:
            pass  # Fall through to local storage

    # Local fallback
    static_dir = os.path.join(os.path.dirname(__file__), "..", "static", "audio")
    os.makedirs(static_dir, exist_ok=True)
    file_path = os.path.join(static_dir, f"{history_id}.{file_ext}")
    with open(file_path, "wb") as f:
        f.write(audio_bytes)
    base_url = os.getenv("APP_BASE_URL", "http://localhost:8000")
    return f"{base_url}/static/audio/{history_id}.{file_ext}"


async def _tts_elevenlabs(text: str) -> bytes:
    """Generate TTS using ElevenLabs API."""
    from elevenlabs import AsyncElevenLabs

    api_key = os.getenv("ELEVENLABS_API_KEY")
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY not configured")

    client = AsyncElevenLabs(api_key=api_key)

    # Use streaming to get all audio chunks
    audio_chunks = []
    async for chunk in await client.text_to_speech.convert(
        voice_id="21m00Tcm4TlvDq8ikWAM",  # Rachel voice
        text=text[:5000],  # ElevenLabs limit
        model_id="eleven_monolingual_v1",
        output_format="mp3_44100_128",
    ):
        audio_chunks.append(chunk)

    return b"".join(audio_chunks)


async def _tts_gemini(text: str) -> bytes:
    """Generate TTS using Gemini API (fallback)."""
    import google.generativeai as genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not configured")

    genai.configure(api_key=api_key)

    # Gemini doesn't have direct TTS, but we can use their text-to-speech through
    # the generative model with audio output capability
    # For now, we'll use a workaround with httpx to call Google Cloud TTS
    # or return an error if neither is available

    # Actually, Google's generativeai doesn't have TTS built-in
    # We need to use Google Cloud Text-to-Speech or alternative
    # For the fallback, let's use a simple approach with httpx

    import httpx

    # Use Google Cloud TTS API directly (requires API key)
    url = f"https://texttospeech.googleapis.com/v1/text:synthesize?key={api_key}"

    payload = {
        "input": {"text": text[:5000]},
        "voice": {
            "languageCode": "en-US",
            "name": "en-US-Neural2-F",
            "ssmlGender": "FEMALE"
        },
        "audioConfig": {
            "audioEncoding": "MP3",
            "speakingRate": 1.0,
            "pitch": 0.0
        }
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=payload, timeout=60.0)
        response.raise_for_status()
        data = response.json()

        import base64
        audio_content = base64.b64decode(data["audioContent"])
        return audio_content


async def _generate_tts(text: str) -> tuple[bytes, str]:
    """
    Generate TTS with fallback logic.
    Returns (audio_bytes, file_extension).
    """
    elevenlabs_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    gemini_key = os.getenv("GEMINI_API_KEY", "").strip()

    # Try ElevenLabs first
    if elevenlabs_key:
        try:
            audio = await _tts_elevenlabs(text)
            return audio, "mp3"
        except Exception as e:
            if not gemini_key:
                raise RuntimeError(f"ElevenLabs failed and no Gemini fallback: {e}")
            # Fall through to Gemini

    # Fallback to Gemini/Google Cloud TTS
    if gemini_key:
        try:
            audio = await _tts_gemini(text)
            return audio, "mp3"
        except Exception as e:
            raise RuntimeError(f"Gemini TTS failed: {e}")

    raise RuntimeError("No TTS provider configured. Set ELEVENLABS_API_KEY or GEMINI_API_KEY.")


@celery_app.task(bind=True, name="workers.tts.generate_audio")
def generate_audio(self, history_id: str, user_id: str):
    self.update_state(state="PROGRESS", meta={"status": "fetching"})

    db = _sync_db()
    history = db.history.find_one({"_id": ObjectId(history_id)})
    if not history:
        return {"error": "History not found"}
    if str(history.get("user_id", "")) != user_id:
        return {"error": "Unauthorised"}

    # Return cached URL if already generated
    if history.get("audio_url"):
        return {"audio_url": history["audio_url"], "status": "done"}

    explanation = history.get("explanation", "")
    if not explanation:
        return {"error": "No explanation text found"}

    self.update_state(state="PROGRESS", meta={"status": "generating"})

    try:
        audio_bytes, file_ext = asyncio.run(_generate_tts(explanation))
    except Exception as e:
        return {"error": f"TTS generation failed: {e}"}

    self.update_state(state="PROGRESS", meta={"status": "uploading"})

    try:
        audio_url = _upload_audio(audio_bytes, history_id, file_ext)
    except Exception as e:
        return {"error": f"Upload failed: {e}"}

    db.history.update_one(
        {"_id": ObjectId(history_id)},
        {"$set": {"audio_url": audio_url}},
    )

    return {"audio_url": audio_url, "status": "done"}
