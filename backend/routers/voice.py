"""
Voice transcription using Groq Whisper (whisper-large-v3-turbo).
Free, fast, supports webm/mp3/wav/m4a out of the box.
"""

import os

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from dependencies import get_current_user_id

router = APIRouter(
    prefix="/voice",
    tags=["voice"],
    responses={401: {"description": "Not authenticated"}},
)

_SUPPORTED = {"webm", "mp3", "mp4", "mpeg", "mpga", "m4a", "wav", "ogg"}


@router.post("/transcribe", summary="Transcribe audio to text")
async def transcribe_audio(
    audio: UploadFile = File(...),
    user_id: str = Depends(get_current_user_id),
):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Determine filename/extension — Groq needs a filename to detect format
    filename = audio.filename or "recording.webm"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "webm"
    if ext not in _SUPPORTED:
        ext = "webm"
        filename = "recording.webm"

    content_type = audio.content_type or f"audio/{ext}"

    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=api_key)
        transcription = await client.audio.transcriptions.create(
            file=(filename, audio_bytes, content_type),
            model="whisper-large-v3-turbo",
            response_format="text",
        )
        # response_format="text" returns a plain string
        text = transcription if isinstance(transcription, str) else transcription.text
        return {"transcribed_text": text.strip()}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}")
