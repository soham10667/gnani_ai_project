import asyncio
import re
import uuid
from pathlib import Path
from typing import Optional, Dict, Any
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Query, Header
from fastapi.responses import Response, FileResponse
from backend.config import settings
from backend.logger import logger
from backend.models import TTSRequest, DialogueRequest
from backend.routers.auth import get_current_user, get_user_from_token
from backend.services.gnani_stt import gnani_stt
from backend.services.tts_service import tts_service
from backend.services.llm_service import llm_service
from backend.services.conversation_agent import conversation_agent

router = APIRouter(prefix="/api/voice", tags=["Voice & Audio Processing"])

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
AUDIO_CLIPS_DIR = ROOT_DIR / "backend" / "audio_clips"
AUDIO_CLIPS_DIR.mkdir(parents=True, exist_ok=True)
SAFE_CLIP_RE = re.compile(r"^clip-[A-Za-z0-9_-]+\.(wav|webm|ogg)$")

SAMPLE_AUDIO_CANDIDATES = [
    ROOT_DIR / "backend" / "assets" / "generated-audio.wav",
    ROOT_DIR / "generated-audio (1).wav",
    ROOT_DIR / "generated-audio.wav",
    ROOT_DIR / "public" / "generated-audio.wav",
]


def _find_sample_audio() -> Optional[Path]:
    for p in SAMPLE_AUDIO_CANDIDATES:
        if p.exists() and p.is_file():
            return p
    return None


def _save_audio_clip(audio_bytes: bytes, session_id: Optional[str], orig_filename: Optional[str]) -> str:
    safe_sid = re.sub(r"[^A-Za-z0-9_-]", "", session_id or "auto")[:24] or "auto"
    ext = ".wav"
    if orig_filename:
        lower = orig_filename.lower()
        if lower.endswith(".webm"):
            ext = ".webm"
        elif lower.endswith(".ogg"):
            ext = ".ogg"
    clip_name = f"clip-{safe_sid}-{uuid.uuid4().hex[:8]}{ext}"
    (AUDIO_CLIPS_DIR / clip_name).write_bytes(audio_bytes)
    return clip_name


@router.get("/status")
def voice_api_status(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Returns real-time connection status and latency telemetry for STT, TTS, and LLM services."""
    return {
        "stt": gnani_stt.get_status(),
        "tts": tts_service.get_status(),
        "llm": llm_service.get_status(),
    }


@router.get("/voices")
def get_supported_voices(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Returns supported Gnani Timbre voices with Devansh vs Yashraj evaluation notes."""
    return tts_service.get_supported_voices()


@router.get("/clips/{clip_ref}")
def get_recorded_audio_clip(
    clip_ref: str,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    """Serves a safely stored customer verification audio clip for audit-trail playback."""
    raw_token = token
    if not raw_token and authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split(" ", 1)[1]
    get_user_from_token(raw_token)

    if not SAFE_CLIP_RE.match(clip_ref):
        raise HTTPException(status_code=400, detail="Invalid audio clip reference.")

    clip_path = (AUDIO_CLIPS_DIR / clip_ref).resolve()
    if not clip_path.is_file() or clip_path.parent != AUDIO_CLIPS_DIR.resolve():
        raise HTTPException(status_code=404, detail="Audio clip not found.")

    media_type = "audio/wav"
    if clip_ref.endswith(".webm"):
        media_type = "audio/webm"
    elif clip_ref.endswith(".ogg"):
        media_type = "audio/ogg"
    return FileResponse(str(clip_path), media_type=media_type, filename=clip_ref)


@router.post("/transcribe")
async def transcribe_voice_audio(
    audio: UploadFile = File(...),
    language: str = Form("indic-auto"),
    session_id: Optional[str] = Form(None),
    target_id: Optional[str] = Form(None),
    previous_text: Optional[str] = Form(None),
    phonetic_scheme: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Captures uploaded user audio, persists an audit clip, transcribes via Official Gnani Prisma-v3.0 STT,
    runs Automated Conversation & Entity Validation on the server, and returns full real-time state.
    """
    audio_bytes = await audio.read()
    if not audio_bytes or len(audio_bytes) < 250:
        raise HTTPException(
            status_code=400,
            detail="Low audio quality: empty or too short recording received. Please speak clearly into the microphone.",
        )

    max_bytes = settings.MAX_AUDIO_UPLOAD_MB * 1024 * 1024
    if len(audio_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Audio upload exceeds {settings.MAX_AUDIO_UPLOAD_MB} MB limit.",
        )

    clip_ref = _save_audio_clip(audio_bytes, session_id, audio.filename)

    stt_res = await gnani_stt.transcribe_audio(
        audio_bytes=audio_bytes,
        filename=audio.filename or "audio.wav",
        mime_type=audio.content_type or "audio/wav",
        language_code=language,
        previous_text=previous_text,
    )

    if stt_res.get("status") != "success":
        err_msg = stt_res.get("error") or "Gnani STT API transcription failed."
        status_code = 400 if stt_res.get("mode") == "invalid_audio" else 502
        logger.warning(f"[VOICE] STT failed for user={current_user.get('id')}: {err_msg}")
        raise HTTPException(status_code=status_code, detail=f"Transcription error: {err_msg}")

    transcript = stt_res.get("transcript", "")
    confidence = float(stt_res.get("confidence", 90.0))

    turn_res = await conversation_agent.process_turn(
        text=transcript,
        session_id=session_id,
        active_target_id=target_id,
        acoustic_confidence=confidence,
        officer_id=current_user.get("id"),
        phonetic_scheme=phonetic_scheme,
        stt_meta=stt_res,
        audio_clip_ref=clip_ref,
    )

    stt_payload = {
        "transcript": transcript,
        "per_word_confidence": stt_res.get("per_word_confidence", []),
        "language": stt_res.get("language", language),
        "timestamp": stt_res.get("timestamp"),
        "role": "customer",
        "confidence": confidence,
        "audio_clip_ref": clip_ref,
    }

    return {
        **stt_res,
        **turn_res,
        "audio_clip_ref": clip_ref,
        "stt_result": stt_payload,
        "dialogue_turn": turn_res,
        "extracted_entities": turn_res.get("extracted", []),
    }


@router.post("/process-dialogue")
async def process_conversational_turn(
    payload: DialogueRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Processes text or speech transcript through Automated Conversation Management,
    Entity Validation, Database persistence, and WebSocket broadcast.
    """
    turn_res = await conversation_agent.process_turn(
        text=payload.text,
        session_id=payload.session_id,
        active_target_id=payload.active_target_id,
        existing_entities=payload.entities,
        acoustic_confidence=payload.acoustic_confidence,
        officer_id=current_user.get("id"),
        phonetic_scheme=payload.phonetic_scheme,
    )
    return turn_res


@router.post("/tts")
async def synthesize_voice_speech(
    payload: TTSRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Synthesizes Hinglish / Hindi / English conversational speech via Official Gnani Timbre v3.0 TTS.
    Raises explicit 400/502 error on failure rather than returning silent fallback audio.
    """
    try:
        audio_bytes = await asyncio.to_thread(
            tts_service.synthesize,
            text=payload.text,
            voice=payload.voice,
            model=payload.model,
            language=payload.language,
            speed=payload.speed,
        )
        return Response(
            content=audio_bytes,
            media_type="audio/wav",
            headers={
                "X-TTS-Voice": str(payload.voice or tts_service.default_voice),
                "X-TTS-Model": str(payload.model or tts_service.default_model),
            },
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as exc:
        logger.error(f"[VOICE] TTS synthesis error: {exc}")
        raise HTTPException(status_code=502, detail=f"Gnani TTS synthesis failed: {exc}")


@router.get("/sample-audio")
def get_sample_audio(current_user: Dict[str, Any] = Depends(get_current_user)):
    sample_path = _find_sample_audio()
    if not sample_path:
        raise HTTPException(status_code=404, detail="Sample reference audio file not found in workspace.")
    return FileResponse(str(sample_path), media_type="audio/wav", filename="generated-audio.wav")


@router.post("/transcribe-sample")
async def transcribe_reference_sample(
    language: str = Form("indic-auto"),
    session_id: Optional[str] = Form(None),
    target_id: Optional[str] = Form(None),
    phonetic_scheme: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    sample_path = _find_sample_audio()
    if not sample_path:
        raise HTTPException(status_code=404, detail="Sample reference audio file not found.")

    audio_bytes = sample_path.read_bytes()
    clip_ref = _save_audio_clip(audio_bytes, session_id, sample_path.name)
    stt_res = await gnani_stt.transcribe_audio(
        audio_bytes=audio_bytes,
        filename=sample_path.name,
        language_code=language,
    )
    if stt_res.get("status") != "success":
        raise HTTPException(status_code=502, detail=stt_res.get("error") or "Sample transcription failed")

    turn_res = await conversation_agent.process_turn(
        text=stt_res.get("transcript", ""),
        session_id=session_id,
        active_target_id=target_id,
        acoustic_confidence=float(stt_res.get("confidence", 90.0)),
        officer_id=current_user.get("id"),
        phonetic_scheme=phonetic_scheme,
        stt_meta=stt_res,
        audio_clip_ref=clip_ref,
    )
    return {
        **stt_res,
        **turn_res,
        "audio_clip_ref": clip_ref,
        "dialogue_turn": turn_res,
        "extracted_entities": turn_res.get("extracted", []),
    }
