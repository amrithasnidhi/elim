"""
Voice transcription using Gemini.
Falls back to return an error if Gemini is not configured.
"""

import os
import tempfile

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

from dependencies import get_current_user_id

router = APIRouter(
    prefix="/voice",
    tags=["voice"],
    responses={401: {"description": "Not authenticated"}, 503: {"description": "Gemini API not configured"}},
)


@router.post(
    "/transcribe",
    summary="Transcribe audio to text",
    description="Convert speech to text using Gemini's audio understanding.",
)
async def transcribe_audio(
    audio: UploadFile = File(..., description="Audio file (webm, mp3, wav, etc.)"),
    user_id: str = Depends(get_current_user_id),
):
    """
    Transcribe audio input to text.

    **Supported formats:** webm, mp3, wav, m4a, ogg

    **Use case:** Voice input for topic queries instead of typing.
    """
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key:
        raise HTTPException(status_code=503, detail="GEMINI_API_KEY not configured")

    try:
        import google.generativeai as genai
    except ImportError:
        raise HTTPException(status_code=503, detail="google-generativeai package not installed")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    try:
        genai.configure(api_key=gemini_key)

        # Save audio to temp file (Gemini requires file path or upload)
        suffix = f".{audio.filename.split('.')[-1]}" if audio.filename and '.' in audio.filename else ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            # Upload file to Gemini
            audio_file = genai.upload_file(tmp_path)

            # Use Gemini to transcribe
            model = genai.GenerativeModel("gemini-2.0-flash")
            response = model.generate_content([
                "Transcribe this audio file. Return ONLY the transcribed text, nothing else.",
                audio_file
            ])

            # Clean up uploaded file
            try:
                audio_file.delete()
            except Exception:
                pass

            transcribed_text = response.text.strip()
            return {"transcribed_text": transcribed_text}

        finally:
            # Clean up temp file
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Transcription failed: {e}")
