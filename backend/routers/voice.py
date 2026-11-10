import os
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query, Response
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from backend.config import settings
from backend.services.gnani_stt import gnani_stt
from backend.services.entity_extractor import entity_extractor
from backend.services.tts_service import tts_service
from backend.services.phonetic_engine import phonetic_engine
from backend.services.conversation_agent import conversation_agent

router = APIRouter(prefix="/api/voice", tags=["Voice & STT"])


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "Shivani"
    language: Optional[str] = "hi-IN"
    speed: Optional[float] = 1.0
    model: Optional[str] = "timbre-v3.0"


class DialogueRequest(BaseModel):
    text: str
    session_id: Optional[str] = None
    active_target_id: Optional[str] = None
    acoustic_confidence: Optional[float] = 95.0


@router.get("/status")
def get_voice_status():
    """
    Returns official Gnani AI STT & TTS connection status,
    active models, and selected reference voice configuration.
    """
    return {
        "stt": {
            "connected": gnani_stt.is_configured,
            "provider": "Gnani AI (Vachana)",
            "model": settings.GNANI_MODEL,
            "endpoint": settings.GNANI_STT_API_URL,
            "language_code": settings.GNANI_LANG_CODE,
            "status": "Online" if gnani_stt.is_configured else "Unconfigured"
        },
        "tts": {
            "connected": bool(tts_service.client),
            "provider": "Gnani AI (Timbre)",
            "model": settings.GNANI_TTS_MODEL,
            "voice": settings.GNANI_TTS_VOICE,
            "voice_gender": "Female",
            "voice_style": "Natural Conversational Hinglish (Matching generated-audio (1).wav - Shivani Voice)",
            "status": "Online" if tts_service.client else "Fallback"
        },
        "reference_audio": {
            "filename": "generated-audio.wav",
            "tone": "Indian Female, clear, warm, conversational Hinglish (Shivani)",
            "matched_gnani_voice": "Shivani (timbre-v3.0)"
        }
    }


@router.get("/sample-audio")
async def get_sample_audio():
    audio_path = os.path.join(os.getcwd(), "generated-audio.wav")
    if os.path.exists(audio_path):
        return FileResponse(audio_path, media_type="audio/wav", filename="generated-audio.wav")
    public_path = os.path.join(os.getcwd(), "public", "generated-audio.wav")
    if os.path.exists(public_path):
        return FileResponse(public_path, media_type="audio/wav", filename="generated-audio.wav")
    raise HTTPException(status_code=404, detail="generated-audio.wav not found")


@router.post("/transcribe-sample")
async def transcribe_sample_audio(
    session_id: Optional[str] = Form(None),
    active_target_id: Optional[str] = Form(None)
):
    """
    Transcribes the user's reference audio file (generated-audio.wav)
    via official Gnani STT API (prisma-v3.0) and processes through AI conversation agent.
    """
    try:
        audio_path = os.path.join(os.getcwd(), "generated-audio.wav")
        if not os.path.exists(audio_path):
            audio_path = os.path.join(os.getcwd(), "public", "generated-audio.wav")
        if not os.path.exists(audio_path):
            raise HTTPException(status_code=404, detail="generated-audio.wav not found on server")
            
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
            
        stt_result = await gnani_stt.transcribe_audio(
            audio_bytes=audio_bytes,
            filename="generated-audio.wav",
            mime_type="audio/wav",
            language_code=settings.GNANI_LANG_CODE or "hi-IN"
        )
        
        if stt_result.get("status") == "error":
            return {
                "status": "error",
                "error": stt_result.get("error", "Gnani STT busy or unavailable."),
                "transcript": "",
                "confidence": 0.0,
                "ai_response_text": "Kripya ek pal ruk kar dobara bolein.",
                "action": "prompt_retry",
                "stt_engine": settings.GNANI_MODEL,
                "tts_engine": f"Gnani Timbre-v3.0 ({settings.GNANI_TTS_VOICE})",
                "voice": settings.GNANI_TTS_VOICE,
                "extracted_entities": []
            }

        transcript = stt_result.get("transcript", "")
        acoustic_conf = stt_result.get("confidence", 94.5)
        
        # Process through intelligent conversational agent
        turn_result = conversation_agent.process_turn(
            user_text=transcript,
            acoustic_confidence=acoustic_conf,
            active_target_id=active_target_id
        )
        
        return {
            "status": "success",
            "transcript": transcript,
            "confidence": acoustic_conf,
            "ai_response_text": turn_result["ai_response_text"],
            "action": turn_result["action"],
            "stt_engine": stt_result.get("model", "prisma-v3.0"),
            "tts_engine": f"Gnani Timbre-v3.0 ({settings.GNANI_TTS_VOICE})",
            "voice": settings.GNANI_TTS_VOICE,
            "mode": stt_result.get("mode", "production"),
            "extracted_entities": turn_result["extracted_entities"],
            "session_id": session_id,
            "audio_url": "/generated-audio.wav"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sample audio transcription failed: {str(e)}")


@router.post("/transcribe")
async def transcribe_voice(
    audio: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    active_target_id: Optional[str] = Form(None),
    language_code: Optional[str] = Form("hi-IN")
):
    """
    Captures live audio from browser microphone, sends to official Gnani STT API (hi-IN / en-IN),
    processes natural Hinglish response through conversation agent, and provides audio stream.
    """
    try:
        audio_bytes = await audio.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio payload received")
            
        stt_result = await gnani_stt.transcribe_audio(
            audio_bytes=audio_bytes,
            filename=audio.filename or "recording.wav",
            mime_type=audio.content_type or "audio/wav",
            language_code=language_code or settings.GNANI_LANG_CODE or "hi-IN"
        )
        
        if stt_result.get("status") == "error":
            return {
                "status": "error",
                "error": stt_result.get("error", "Gnani STT busy or unavailable."),
                "transcript": "",
                "confidence": 0.0,
                "ai_response_text": "Kripya ek pal ruk kar dobara bolein.",
                "action": "prompt_retry",
                "stt_engine": settings.GNANI_MODEL,
                "tts_engine": f"Gnani Timbre-v3.0 ({settings.GNANI_TTS_VOICE})",
                "voice": settings.GNANI_TTS_VOICE,
                "extracted_entities": []
            }

        transcript = stt_result.get("transcript", "")
        acoustic_conf = stt_result.get("confidence", 92.0)
        
        # Complete Voice Pipeline: Pass to Conversational AI Agent
        turn_result = conversation_agent.process_turn(
            user_text=transcript,
            acoustic_confidence=acoustic_conf,
            active_target_id=active_target_id
        )
        
        return {
            "status": "success",
            "transcript": transcript,
            "confidence": acoustic_conf,
            "ai_response_text": turn_result["ai_response_text"],
            "action": turn_result["action"],
            "stt_engine": stt_result.get("model", "prisma-v3.0"),
            "tts_engine": f"Gnani Timbre-v3.0 ({settings.GNANI_TTS_VOICE})",
            "voice": settings.GNANI_TTS_VOICE,
            "mode": "production",
            "extracted_entities": turn_result["extracted_entities"],
            "session_id": session_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice pipeline error: {str(e)}")


@router.post("/process-dialogue")
def process_dialogue(payload: DialogueRequest):
    """
    Processes typed or simulated dialogue through the conversational AI agent,
    generating natural Hinglish response text and entity updates.
    """
    try:
        turn_result = conversation_agent.process_turn(
            user_text=payload.text,
            acoustic_confidence=payload.acoustic_confidence or 95.0,
            active_target_id=payload.active_target_id
        )
        return {
            "status": "success",
            "transcript": payload.text,
            "ai_response_text": turn_result["ai_response_text"],
            "action": turn_result["action"],
            "extracted_entities": turn_result["extracted_entities"],
            "stt_engine": "Gnani Prisma-v3.0",
            "tts_engine": f"Gnani Timbre-v3.0 ({settings.GNANI_TTS_VOICE})",
            "voice": settings.GNANI_TTS_VOICE,
            "session_id": payload.session_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dialogue processing error: {str(e)}")


@router.get("/tts/voices")
def get_tts_voices():
    """Returns available Gnani TTS voices and models."""
    return tts_service.get_supported_voices()


@router.get("/tts")
def stream_tts_audio(
    text: str = Query(..., description="Text to synthesize"),
    voice: Optional[str] = Query(None, description="Voice ID (e.g. Shubham)"),
    language: Optional[str] = Query(None, description="Language code"),
    speed: float = Query(1.0, description="Speech rate (0.85 - 1.15)"),
    model: Optional[str] = Query(None, description="TTS Model (timbre-v3.0)")
):
    """
    Synthesizes speech using official Gnani Vachana TTS API (Timbre v3.0 - Shivani female voice).
    Streams clean WAV audio directly to browser.
    """
    try:
        audio_bytes = tts_service.synthesize(
            text=text,
            voice=voice or settings.GNANI_TTS_VOICE or "Shivani",
            model=model or settings.GNANI_TTS_MODEL or "timbre-v3.0",
            language=language,
            speed=speed
        )
        return Response(content=audio_bytes, media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")


@router.post("/tts")
def synthesize_tts_audio(payload: TTSRequest):
    """
    POST endpoint for speech synthesis with Gnani Vachana TTS API.
    """
    try:
        audio_bytes = tts_service.synthesize(
            text=payload.text,
            voice=payload.voice or settings.GNANI_TTS_VOICE or "Shivani",
            model=payload.model or settings.GNANI_TTS_MODEL or "timbre-v3.0",
            language=payload.language,
            speed=payload.speed or 1.0
        )
        return Response(content=audio_bytes, media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS synthesis failed: {str(e)}")


@router.post("/prompt")
def get_phonetic_prompt(
    label: str = Form(...),
    value: str = Form(...),
    entity_type: str = Form("alpha")
):
    prompt_data = tts_service.build_speech_prompt(label, value, entity_type)
    return prompt_data
