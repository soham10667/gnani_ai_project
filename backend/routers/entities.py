from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from backend.database import db
from backend.models import ExtractRequest, ConfirmRequest, CorrectRequest, EntityUpdate
from backend.routers.auth import get_current_user
from backend.services.entity_extractor import entity_extractor
from backend.services.phonetic_engine import phonetic_engine
from backend.services.validation_engine import validation_engine
from backend.services.confidence_scorer import confidence_scorer
from backend.services.correction_learner import correction_learner

router = APIRouter(prefix="/api/entities", tags=["Entities & Phonetics"])


@router.post("/extract")
def extract_entities(
    payload: ExtractRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Extracts structured KYC entities and computes confidence + phonetics.
    Unconfirmed values are never returned or saved as 'verified'.
    """
    extracted = entity_extractor.extract_all_entities(
        payload.text,
        acoustic_confidence=payload.acoustic_confidence,
        target_id=payload.target_entity_id,
    )
    return {
        "entities": extracted,
        "count": len(extracted),
    }


@router.post("/confirm")
def confirm_entity(
    payload: ConfirmRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Records explicit customer confirmation and marks entity verified in database.
    """
    if not payload.confirmed_value or not payload.confirmed_value.strip():
        raise HTTPException(status_code=400, detail="Cannot confirm empty entity value.")

    db.ensure_session_exists(payload.session_id, officer_id=current_user.get("id"))
    db_eid = f"{payload.session_id}__{payload.entity_type}"
    sess = db.get_session_by_id(payload.session_id) or {}
    existing_ids = {e["id"] for e in sess.get("entities", [])}

    if db_eid not in existing_ids and payload.entity_id not in existing_ids:
        score = confidence_scorer.calculate_score(payload.entity_type, payload.confirmed_value, payload.confidence)
        db.upsert_entities(
            payload.session_id,
            [{
                "id": payload.entity_type,
                "label": payload.entity_type.replace("_", " ").title(),
                "value": score["normalized_value"],
                "confidence": score["confidence"],
                "status": "pending",
                "validationStatus": score["validation_status"],
                "validationMessage": score["validation_message"],
                "phoneticSummary": phonetic_engine.format_phonetic_summary(score["normalized_value"], payload.entity_type),
                "phoneticDetails": phonetic_engine.get_phonetic_spelling(score["normalized_value"]),
            }],
        )

    db.record_confirmation(
        session_id=payload.session_id,
        entity_id=payload.entity_id,
        entity_type=payload.entity_type,
        confirmed_value=payload.confirmed_value.strip(),
        confidence=payload.confidence,
    )
    updated_session = db.get_session_by_id(payload.session_id)
    return {
        "status": "confirmed",
        "entity_type": payload.entity_type,
        "confirmed_value": payload.confirmed_value.strip(),
        "session": updated_session,
    }


@router.post("/correct")
def correct_entity(
    payload: CorrectRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Applies customer/officer correction, logs substitution to DB, retrains CorrectionLearningModel,
    and keeps corrected status 'pending' until customer/readback confirms it.
    """
    db.ensure_session_exists(payload.session_id, officer_id=current_user.get("id"))
    score = confidence_scorer.calculate_score(
        payload.entity_type,
        payload.corrected_value,
        payload.corrected_conf,
        correction_attempt=1,
    )
    norm_val = score["normalized_value"]
    final_conf = max(float(payload.corrected_conf), float(score["confidence"]))

    db.record_correction(
        session_id=payload.session_id,
        entity_id=payload.entity_id,
        entity_type=payload.entity_type,
        original_val=payload.original_value,
        corrected_val=norm_val,
        original_conf=payload.original_conf,
        corrected_conf=final_conf,
    )
    db.upsert_entities(
        payload.session_id,
        [{
            "id": payload.entity_type,
            "label": payload.entity_type.replace("_", " ").title(),
            "value": norm_val,
            "confidence": final_conf,
            "status": "pending",
            "validationStatus": score["validation_status"],
            "validationMessage": score["validation_message"],
            "phoneticSummary": phonetic_engine.format_phonetic_summary(norm_val, payload.entity_type),
            "phoneticDetails": phonetic_engine.get_phonetic_spelling(norm_val),
        }],
    )
    learning_status = correction_learner.fit_from_logs()
    readback = phonetic_engine.generate_readback_sentence(
        payload.entity_type.replace("_", " ").title(), norm_val, payload.entity_type
    )
    return {
        "status": "corrected_pending_confirmation",
        "entity_type": payload.entity_type,
        "corrected_value": norm_val,
        "confidence": final_conf,
        "readback_prompt": readback,
        "learning_status": learning_status,
    }


@router.get("/phonetic/{entity_type}/{value}")
def get_phonetic_breakdown(
    entity_type: str,
    value: str,
    standard: str = "nato",
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    return {
        "entity_type": entity_type,
        "value": value,
        "phonetic_summary": phonetic_engine.format_phonetic_summary(value, entity_type, standard),
        "phonetic_details": phonetic_engine.get_phonetic_spelling(value, standard),
        "readback_sentence": phonetic_engine.generate_readback_sentence(entity_type.title(), value, entity_type, standard),
    }


@router.patch("/{entity_id}")
def patch_entity(
    entity_id: str,
    payload: EntityUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if updates.get("status") == "verified":
        raise HTTPException(
            status_code=400,
            detail="Direct status='verified' mutation is blocked; use /api/entities/confirm after confirmation.",
        )
    updated = db.update_entity(entity_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Entity '{entity_id}' not found.")
    return updated
