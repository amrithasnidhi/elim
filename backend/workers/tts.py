import asyncio
import io
import os

import pymongo
from bson import ObjectId

from workers.celery_app import celery_app


def _sync_db():
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    return pymongo.MongoClient(uri)["elim"]


def _upload_audio(audio_bytes: bytes, history_id: str) -> str:
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
            key = f"audio/{history_id}.mp3"
            s3.put_object(Bucket=bucket, Key=key, Body=audio_bytes, ContentType="audio/mpeg")
            endpoint = os.getenv("S3_ENDPOINT_URL", "")
            if endpoint:
                return f"{endpoint.rstrip('/')}/{bucket}/{key}"
            return f"https://{bucket}.s3.amazonaws.com/{key}"
        except Exception as e:
            pass  # Fall through to local storage

    # Local fallback
    static_dir = os.path.join(os.path.dirname(__file__), "..", "static", "audio")
    os.makedirs(static_dir, exist_ok=True)
    file_path = os.path.join(static_dir, f"{history_id}.mp3")
    with open(file_path, "wb") as f:
        f.write(audio_bytes)
    base_url = os.getenv("APP_BASE_URL", "http://localhost:8000")
    return f"{base_url}/static/audio/{history_id}.mp3"


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

    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        return {"error": "OPENAI_API_KEY not configured"}

    explanation = history.get("explanation", "")
    if not explanation:
        return {"error": "No explanation text found"}

    self.update_state(state="PROGRESS", meta={"status": "generating"})

    async def _tts():
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise RuntimeError("openai package not installed")
        client = AsyncOpenAI(api_key=openai_key)
        response = await client.audio.speech.create(
            model="tts-1",
            voice="nova",
            input=explanation[:4096],  # TTS limit
            response_format="mp3",
        )
        return response.content

    try:
        audio_bytes = asyncio.run(_tts())
    except Exception as e:
        return {"error": f"TTS generation failed: {e}"}

    self.update_state(state="PROGRESS", meta={"status": "uploading"})

    try:
        audio_url = _upload_audio(audio_bytes, history_id)
    except Exception as e:
        return {"error": f"Upload failed: {e}"}

    db.history.update_one(
        {"_id": ObjectId(history_id)},
        {"$set": {"audio_url": audio_url}},
    )

    return {"audio_url": audio_url, "status": "done"}
