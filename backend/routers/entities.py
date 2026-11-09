from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from backend.models import (
    ExtractionRequest, ValidationRequest, ValidationResponse,
    ConfirmationRequest, CorrectionRequest, PhoneticGenerateRequest
)
from backend.services.entity_extractor import entity_extractor
from backend.services.validation_engine import validation_engine
from backend.services.confidence_scorer import confidence_scorer
from backend.services.phonetic_engine import phonetic_engine
from backend.services.correction_learner import correction_learner
from backend.database import db

router = APIRouter(prefix="/api/entities", tags=["Entities & Verification"])

@router.post("/extract")
def extract_entities(req: ExtractionRequest):
    entities = entity_extractor.extract_all_entities(
        text=req.text,
        acoustic_confidence=req.acoustic_confidence or 92.0,
        target_id=req.active_target_id
    )
    
    if req.session_id and entities:
        # Sync newly extracted entities to session
        db.upsert_entities(req.session_id, entities)
        
    return {
        "status": "success",
        "entities": entities,
        "count": len(entities),
        "input_text": req.text
    }

@router.post("/validate", response_model=ValidationResponse)
def validate_entity(req: ValidationRequest):
    res = validation_engine.validate_entity(req.entity_type, req.value)
    return ValidationResponse(
        is_valid=res.get("is_valid", False),
        status=res.get("status", "invalid"),
        message=res.get("message", ""),
        normalized_value=res.get("normalized", req.value),
        confidence_modifier=res.get("modifier", 0.0)
    )

@router.post("/confirm")
def confirm_entity(req: ConfirmationRequest):
    try:
        # Record verified confirmation in database audit trail
        db.record_confirmation(
            session_id=req.session_id,
            entity_id=req.entity_id,
            entity_type=req.entity_type,
            confirmed_value=req.confirmed_value,
            confidence=req.confidence or 96.0
        )
        return {
            "status": "success",
            "message": f"Entity '{req.entity_id}' affirmed by customer and confirmed in audit database",
            "entity_id": req.entity_id,
            "session_id": req.session_id,
            "verified_value": req.confirmed_value,
            "confidence": max(req.confidence or 96.0, 96.0)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Confirmation failed: {str(e)}")

@router.post("/correct")
def correct_entity(req: CorrectionRequest):
    try:
        # Validate corrected value
        val_res = validation_engine.validate_entity(req.entity_type, req.corrected_value)
        normalized = val_res.get("normalized", req.corrected_value)
        
        # Calculate new boosted confidence score post human guidance
        score_data = confidence_scorer.calculate_score(
            entity_type=req.entity_type,
            value=normalized,
            acoustic_confidence=92.0,
            is_repeat_attempt=True,
            correction_attempt=1
        )
        
        # Generate new NATO phonetics
        phonetics = phonetic_engine.get_phonetic_spelling(normalized)
        summary = phonetic_engine.format_phonetic_summary(normalized, req.entity_type)
        readback_prompt = phonetic_engine.generate_readback_sentence(
            entity_label=req.entity_type.replace('_', ' ').title(),
            value=normalized,
            entity_type=req.entity_type
        )
        
        # Log to database for audit & ML model
        db.record_correction(
            session_id=req.session_id,
            entity_id=req.entity_id,
            entity_type=req.entity_type,
            original_val=req.original_value,
            corrected_val=normalized,
            original_conf=req.original_confidence or 70.0,
            corrected_conf=score_data["confidence"]
        )
        
        # Update entity in extracted_entities table
        updated_entity = db.update_entity(req.entity_id, {
            "value": normalized,
            "confidence": score_data["confidence"],
            "status": "corrected",
            "validation_status": score_data["validation_status"],
            "validation_message": score_data["validation_message"],
            "phonetic_summary": summary
        })
        
        # Incrementally update correction ML model
        ml_status = correction_learner.fit_from_logs()
        
        return {
            "status": "success",
            "message": "Correction recorded and synthesized for read-back verification",
            "corrected_entity": {
                "id": req.entity_id,
                "value": normalized,
                "confidence": score_data["confidence"],
                "status": "corrected",
                "validationStatus": score_data["validation_status"],
                "validationMessage": score_data["validation_message"],
                "phoneticSummary": summary,
                "phoneticDetails": phonetics,
                "readbackPrompt": readback_prompt
            },
            "ml_model_status": ml_status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Correction update failed: {str(e)}")

@router.post("/phonetics")
def generate_phonetics(req: PhoneticGenerateRequest):
    phonetics = phonetic_engine.get_phonetic_spelling(req.text, standard=req.standard or "nato")
    summary = phonetic_engine.format_phonetic_summary(req.text, entity_type=req.entity_type or "alpha", standard=req.standard or "nato")
    sentence = phonetic_engine.generate_readback_sentence("Entity", req.text, req.entity_type or "alpha", standard=req.standard or "nato")
    return {
        "text": req.text,
        "phonetics": phonetics,
        "summary": summary,
        "readback_sentence": sentence
    }

