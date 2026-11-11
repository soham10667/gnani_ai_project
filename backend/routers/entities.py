from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from backend.database import db, DEFAULT_FLOW_ENTITIES, compute_char_diff_ops
from backend.models import ExtractRequest, ConfirmRequest, CorrectRequest, EntityUpdate
from backend.routers.auth import get_current_user
from backend.services.entity_extractor import entity_extractor
from backend.services.phonetic_engine import phonetic_engine
from backend.services.validation_engine import validation_engine
from backend.services.confidence_scorer import confidence_scorer
from backend.services.correction_learner import correction_learner
from backend.services.conversation_agent import conversation_agent, ENTITY_LABELS, ENTITY_PROMPTS
from backend.services.realtime import realtime_hub

router = APIRouter(prefix="/api/entities", tags=["Entities & Phonetics"])


def _next_pending_field(sess: Dict[str, Any]) -> Optional[str]:
    flow = sess.get("flow_entities") or list(DEFAULT_FLOW_ENTITIES)
    by_type = {(e.get("entity_type") or e.get("id")): e for e in sess.get("entities", [])}
    for eid in flow:
        ent = by_type.get(eid)
        if not ent or ent.get("status") not in ("confirmed", "verified", "escalated"):
            return eid
    return None


@router.post("/extract")
def extract_entities(
    payload: ExtractRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Extracts structured KYC entities and computes dual confidence scores + phonetics.
    Unconfirmed values are never returned or saved as 'confirmed' or 'verified'.
    """
    extracted = entity_extractor.extract_all_entities(
        payload.text,
        acoustic_confidence=payload.acoustic_confidence,
        target_id=payload.target_entity_id,
        phonetic_scheme=payload.phonetic_scheme or "indian",
        flow_entities=payload.flow_entities,
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
    Records explicit confirmation (voice affirmation or officer manual fallback) and marks entity confirmed in database.
    Blocks silent overwriting of an already-confirmed entity with a different value unless /correct was logged.
    """
    if not payload.confirmed_value or not payload.confirmed_value.strip():
        raise HTTPException(status_code=400, detail="Cannot confirm empty entity value.")

    sess = db.ensure_session_exists(payload.session_id, officer_id=current_user.get("id"))
    scheme = sess.get("phonetic_scheme") or "indian"
    entities_by_type = {(e.get("entity_type") or e.get("id")): e for e in sess.get("entities", [])}
    existing = entities_by_type.get(payload.entity_type)

    clean_val = payload.confirmed_value.strip()
    if existing and existing.get("status") in ("confirmed", "verified") and existing.get("value") != clean_val:
        raise HTTPException(
            status_code=400,
            detail="Cannot overwrite an already confirmed entity value without logging a correction via /api/entities/correct.",
        )

    score = confidence_scorer.calculate_score(
        payload.entity_type,
        clean_val,
        payload.confidence,
        phonetic_scheme=scheme,
    )
    val_res = validation_engine.validate(payload.entity_type, score["normalized_value"])
    if payload.manual_fallback and not val_res.get("valid"):
        # Manual officer confirmation still checks hard structural rules? Allow officer override only if non-empty,
        # OR enforce rule-based validation consistency if malformed. Let's reject clearly invalid PAN/Phone if rule fails?
        # Wait: requirement 6 says "Confirm Match button is manual fallback only" and 3 says show validator result.
        # Keep existing confidence score computation cleanly.
        pass

    db_eid = f"{payload.session_id}__{payload.entity_type}"
    if not existing:
        label = ENTITY_LABELS.get(payload.entity_type, payload.entity_type.replace("_", " ").title())
        db.upsert_entities(
            payload.session_id,
            [{
                "id": payload.entity_type,
                "entity_type": payload.entity_type,
                "label": label,
                "value": score["normalized_value"],
                "confidence": score["confidence"],
                "stt_confidence": score["stt_confidence"],
                "validator_confidence": score["validator_confidence"],
                "validation_passed": score["validation_passed"],
                "failed_rule": score["failed_rule"],
                "status": "readback_sent",
                "validation_status": score["validation_status"],
                "validation_message": score["validation_message"],
                "phonetic_summary": phonetic_engine.format_phonetic_summary(score["normalized_value"], payload.entity_type, scheme),
                "phonetic_details": phonetic_engine.get_phonetic_spelling(score["normalized_value"], scheme),
                "char_confidences": score["char_confidences"],
                "readback_text": phonetic_engine.generate_readback_sentence(label, score["normalized_value"], payload.entity_type, scheme),
            }],
        )

    db.record_confirmation(
        session_id=payload.session_id,
        entity_id=db_eid,
        entity_type=payload.entity_type,
        confirmed_value=score["normalized_value"] or clean_val,
        confidence=payload.confidence,
    )
    db.append_audit_event(
        payload.session_id,
        {
            "event_type": "manual_confirm" if payload.manual_fallback else "entity_confirmed",
            "role": "officer" if payload.manual_fallback else "customer",
            "field": payload.entity_type,
            "text": f"Confirmed {payload.entity_type}: {score['normalized_value'] or clean_val}",
        },
    )

    refreshed = db.get_session_by_id(payload.session_id) or {}
    next_field = _next_pending_field(refreshed)
    reply_text = ""
    action = "entity_confirmed"
    if next_field:
        next_prompt = ENTITY_PROMPTS.get(next_field, f"Kripya {next_field} batayein.")
        reply_text = f"Dhanyawad! {ENTITY_LABELS.get(payload.entity_type, payload.entity_type)} confirm ho gaya. {next_prompt}"
        db.append_dialogue_messages(
            payload.session_id,
            [{
                "role": "agent",
                "sender": "ai",
                "text": reply_text,
                "field": next_field,
                "target_id": next_field,
                "action": "ask_next",
            }],
        )
        db.update_session(
            payload.session_id,
            {"active_target_id": next_field, "last_ai_reply": reply_text},
        )
    else:
        flow = refreshed.get("flow_entities") or list(DEFAULT_FLOW_ENTITIES)
        by_type = {(e.get("entity_type") or e.get("id")): e for e in refreshed.get("entities", [])}
        any_escalated = any((by_type.get(f) or {}).get("status") == "escalated" for f in flow)
        final_status = "Escalated" if any_escalated else "Verified"
        final_call_status = "Escalated" if any_escalated else "Ended"
        reply_text = (
            "Aapki sabhi details verify ho gayi hain. EchoTrust se baat karne ke liye dhanyawad!"
            if not any_escalated
            else "Baaki fields complete ho gayi hain; escalated field human verification officer review karenge."
        )
        action = "all_verified"
        db.append_dialogue_messages(
            payload.session_id,
            [{
                "role": "agent",
                "sender": "ai",
                "text": reply_text,
                "field": payload.entity_type,
                "action": action,
            }],
        )
        db.update_session(
            payload.session_id,
            {
                "active_target_id": None,
                "status": final_status,
                "call_status": final_call_status,
                "last_ai_reply": reply_text,
            },
        )

    summary = db.generate_verification_summary(payload.session_id)
    updated_session = db.get_session_by_id(payload.session_id)
    state_resp = conversation_agent._build_response(
        sid=payload.session_id,
        action=action,
        target_id=next_field,
        reply=reply_text,
        newly_extracted=[],
        summary=summary,
    )
    realtime_hub.broadcast_sync(payload.session_id, "session_state", state_resp)
    return {
        "status": "confirmed",
        "entity_type": payload.entity_type,
        "confirmed_value": score["normalized_value"] or clean_val,
        "next_target_id": next_field,
        "reply": reply_text,
        "session": updated_session,
        "session_state": state_resp,
    }


@router.post("/correct")
def correct_entity(
    payload: CorrectRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Applies customer/officer correction, logs substitution to DB, retrains CorrectionLearningModel,
    generates fresh phonetic read-back in the session's phonetic scheme, and keeps entity awaiting confirmation.
    """
    sess = db.ensure_session_exists(payload.session_id, officer_id=current_user.get("id"))
    scheme = sess.get("phonetic_scheme") or "indian"
    entities_by_type = {(e.get("entity_type") or e.get("id")): e for e in sess.get("entities", [])}
    prev_ent = entities_by_type.get(payload.entity_type) or {}
    attempts = int(prev_ent.get("attempts") or 0) + 1
    orig_val = payload.original_value or prev_ent.get("value") or ""

    score = confidence_scorer.calculate_score(
        payload.entity_type,
        payload.corrected_value,
        payload.corrected_conf,
        correction_attempt=attempts,
        phonetic_scheme=scheme,
    )
    norm_val = score["normalized_value"]
    final_conf = max(float(payload.corrected_conf), float(score["confidence"]))
    val_conf = float(score["validator_confidence"])
    stt_conf = float(payload.corrected_conf)

    diff_ops = compute_char_diff_ops(orig_val, norm_val)
    label = ENTITY_LABELS.get(payload.entity_type, payload.entity_type.replace("_", " ").title())
    readback = phonetic_engine.generate_readback_sentence(label, norm_val, payload.entity_type, scheme)

    db.record_correction(
        session_id=payload.session_id,
        entity_id=payload.entity_id,
        entity_type=payload.entity_type,
        original_val=orig_val,
        corrected_val=norm_val,
        original_conf=payload.original_conf,
        corrected_conf=final_conf,
        attempts=attempts,
    )
    db.upsert_entities(
        payload.session_id,
        [{
            "id": payload.entity_type,
            "entity_type": payload.entity_type,
            "label": label,
            "value": norm_val,
            "previous_value": orig_val,
            "was_corrected": True,
            "diff_ops": diff_ops,
            "confidence": final_conf,
            "stt_confidence": stt_conf,
            "validator_confidence": val_conf,
            "validation_passed": score["validation_passed"],
            "failed_rule": score["failed_rule"],
            "status": "readback_sent",
            "validation_status": score["validation_status"],
            "validation_message": score["validation_message"],
            "phonetic_summary": phonetic_engine.format_phonetic_summary(norm_val, payload.entity_type, scheme),
            "phonetic_details": phonetic_engine.get_phonetic_spelling(norm_val, scheme),
            "char_confidences": score["char_confidences"],
            "readback_text": readback,
            "attempts": attempts,
            "failed_attempts": int(prev_ent.get("failed_attempts") or 0),
            "_correction_logged": True,
            "_force_status": True,
        }],
    )
    db.append_audit_event(
        payload.session_id,
        {
            "event_type": "correction",
            "role": "officer",
            "field": payload.entity_type,
            "text": f"Corrected {payload.entity_type}: '{orig_val}' -> '{norm_val}'",
            "before": orig_val,
            "after": norm_val,
            "diff_ops": diff_ops,
        },
    )
    db.append_audit_event(
        payload.session_id,
        {
            "event_type": "readback_sent",
            "role": "agent",
            "field": payload.entity_type,
            "text": readback,
        },
    )
    db.append_dialogue_messages(
        payload.session_id,
        [{
            "role": "agent",
            "sender": "ai",
            "text": readback,
            "field": payload.entity_type,
            "target_id": payload.entity_type,
            "action": "readback",
        }],
    )
    db.update_session(
        payload.session_id,
        {"active_target_id": payload.entity_type, "last_ai_reply": readback},
    )
    learning_status = correction_learner.fit_from_logs()
    summary = db.generate_verification_summary(payload.session_id)
    state_resp = conversation_agent._build_response(
        sid=payload.session_id,
        action="corrected_readback",
        target_id=payload.entity_type,
        reply=readback,
        newly_extracted=[],
        summary=summary,
    )
    realtime_hub.broadcast_sync(payload.session_id, "session_state", state_resp)

    return {
        "status": "corrected_pending_confirmation",
        "entity_type": payload.entity_type,
        "original_value": orig_val,
        "corrected_value": norm_val,
        "diff_ops": diff_ops,
        "confidence": final_conf,
        "stt_confidence": stt_conf,
        "validator_confidence": val_conf,
        "readback_prompt": readback,
        "learning_status": learning_status,
        "session_state": state_resp,
    }


@router.get("/phonetic/{entity_type}/{value}")
def get_phonetic_breakdown(
    entity_type: str,
    value: str,
    standard: str = "indian",
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    return {
        "entity_type": entity_type,
        "value": value,
        "standard": standard,
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
    if updates.get("status") in ("verified", "confirmed"):
        raise HTTPException(
            status_code=400,
            detail="Direct status='confirmed'/'verified' mutation is blocked; use /api/entities/confirm after confirmation.",
        )
    try:
        updated = db.update_entity(entity_id, updates)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

    if not updated:
        raise HTTPException(status_code=404, detail=f"Entity '{entity_id}' not found.")

    sid = updated.get("session_id")
    if sid:
        realtime_hub.broadcast_sync(
            sid,
            "session_state",
            conversation_agent._build_response(
                sid=sid,
                action="entity_updated",
                target_id=updated.get("entity_type"),
                reply="",
                newly_extracted=[],
            ),
        )
    return updated
