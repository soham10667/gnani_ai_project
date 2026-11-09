from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from typing import Optional
from backend.services.gnani_stt import gnani_stt
from backend.services.entity_extractor import entity_extractor
from backend.services.tts_service import tts_service
from backend.services.phonetic_engine import phonetic_engine

router = APIRouter(prefix="/api/voice", tags=["Voice & STT"])

@router.post("/transcribe")
async def transcribe_voice(
    audio: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
    active_target_id: Optional[str] = Form(None)
):
    try:
        audio_bytes = await audio.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Empty audio payload received")
            
        stt_result = await gnani_stt.transcribe_audio(
            audio_bytes=audio_bytes,
            filename=audio.filename or "recording.wav",
            mime_type=audio.content_type or "audio/wav"
        )
        
        transcript = stt_result.get("transcript", "")
        acoustic_conf = stt_result.get("confidence", 90.0)
        
        # Automatically extract entities from the transcribed text
        extracted_entities = entity_extractor.extract_all_entities(
            text=transcript,
            acoustic_confidence=acoustic_conf,
            target_id=active_target_id
        )
        
        return {
            "status": "success",
            "transcript": transcript,
            "confidence": acoustic_conf,
            "stt_engine": stt_result.get("model", "EchoTrust-BFSI-v4.2"),
            "mode": stt_result.get("mode", "mock_simulation"),
            "extracted_entities": extracted_entities,
            "session_id": session_id
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice transcription failed: {str(e)}")

@router.post("/prompt")
def get_phonetic_prompt(
    label: str = Form(...),
    value: str = Form(...),
    entity_type: str = Form("alpha")
):
    prompt_data = tts_service.build_speech_prompt(label, value, entity_type)
    return prompt_data

