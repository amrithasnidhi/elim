import io
import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from dependencies import get_current_user_id

router = APIRouter(prefix="/voice", tags=["voice"])


@router.post("/transcribe")
async def transcribe_audio(
    audio: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    openai_key = os.getenv("OPENAI_API_KEY")
    if not openai_key:
        raise HTTPException(status_code=503, detail="OPENAI_API_KEY not configured")

    try:
        from openai import AsyncOpenAI
    except ImportError:
        raise HTTPException(status_code=503, detail="openai package not installed")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    try:
        client = AsyncOpenAI(api_key=openai_key)
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = audio.filename or "recording.webm"
        transcript = await client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
        )
        return {"transcribed_text": transcript.text}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}")
