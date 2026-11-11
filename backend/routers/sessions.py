import asyncio
import json
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Query, Depends, Header, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from backend.database import db
from backend.models import SessionCreate, SessionUpdate
from backend.routers.auth import get_current_user, get_user_from_token
from backend.services.conversation_agent import conversation_agent
from backend.services.phonetic_engine import phonetic_engine
from backend.services.realtime import realtime_hub

router = APIRouter(prefix="/api/sessions", tags=["Verification Sessions"])


class StartCallBody(BaseModel):
    flow_entities: Optional[List[str]] = None
    phonetic_scheme: Optional[str] = Field(default="indian", max_length=20)


class SchemeUpdateBody(BaseModel):
    phonetic_scheme: str = Field(..., pattern="^(indian|nato)$")


@router.get("/")
def list_sessions(
    search: str = Query("", max_length=100),
    status: str = Query("", max_length=40),
    channel: str = Query("", max_length=60),
    limit: int = Query(50, ge=1, le=200),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    sessions = db.get_sessions(search=search, status=status, channel=channel, limit=limit)
    return {"sessions": sessions, "count": len(sessions)}


@router.get("/{session_id}")
def get_session(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    session = db.get_session_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Verification session '{session_id}' not found.")
    return session


@router.post("/")
def create_session(
    payload: SessionCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    data = payload.model_dump()
    data["officer_id"] = current_user.get("id", "USR-1")
    created = db.create_session(data)
    realtime_hub.broadcast_sync(
        created["id"],
        "session_state",
        conversation_agent._build_response(
            sid=created["id"],
            action="session_created",
            target_id=created.get("active_target_id"),
            reply="",
            newly_extracted=[],
        ),
    )
    return created


@router.patch("/{session_id}")
def update_session(
    session_id: str,
    payload: SessionUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updated = db.update_session(session_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    realtime_hub.broadcast_sync(
        session_id,
        "session_state",
        conversation_agent._build_response(
            sid=session_id,
            action="session_updated",
            target_id=updated.get("active_target_id"),
            reply="",
            newly_extracted=[],
        ),
    )
    return updated


@router.post("/{session_id}/start")
async def start_verification_call(
    session_id: str,
    payload: Optional[StartCallBody] = Body(None),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Starts or restarts a live automated voice verification call and returns initial greeting state."""
    target_sid = None if session_id in ("new", "auto") else session_id
    resp = await conversation_agent.start_call(
        session_id=target_sid,
        flow_entities=payload.flow_entities if payload else None,
        phonetic_scheme=(payload.phonetic_scheme if payload and payload.phonetic_scheme else "indian"),
        officer_id=current_user.get("id"),
    )
    return resp


@router.post("/{session_id}/end")
async def end_verification_call(
    session_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Ends a live verification call cleanly, appends audit event, and broadcasts state."""
    sess = db.get_session_by_id(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    next_status = sess.get("status", "In Progress")
    if next_status == "In Progress":
        next_status = "Ended"

    db.update_session(session_id, {"call_status": "Ended", "status": next_status})
    db.append_audit_event(
        session_id,
        {
            "event_type": "call_ended",
            "role": "officer",
            "field": sess.get("active_target_id"),
            "text": f"Verification call ended by {current_user.get('name', 'Officer')}.",
        },
    )
    summary = db.generate_verification_summary(session_id)
    resp = conversation_agent._build_response(
        sid=session_id,
        action="call_ended",
        target_id=sess.get("active_target_id"),
        reply="",
        newly_extracted=[],
        summary=summary,
    )
    await realtime_hub.broadcast(session_id, "session_state", resp)
    return resp


@router.post("/{session_id}/scheme")
async def set_session_phonetic_scheme(
    session_id: str,
    payload: SchemeUpdateBody,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Switches phonetic scheme ('indian' or 'nato') and refreshes active phonetic summaries."""
    sess = db.get_session_by_id(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    scheme = payload.phonetic_scheme
    db.update_session(session_id, {"phonetic_scheme": scheme})

    recomputed: List[Dict[str, Any]] = []
    for ent in sess.get("entities", []):
        val = ent.get("value") or ""
        if not val:
            continue
        etype = ent.get("entity_type") or ent.get("id")
        label = ent.get("label") or etype.title()
        details = phonetic_engine.get_phonetic_spelling(val, scheme)
        summary_str = phonetic_engine.format_phonetic_summary(val, etype, scheme)
        readback = phonetic_engine.generate_readback_sentence(label, val, etype, scheme)
        recomputed.append({
            "id": etype,
            "entity_type": etype,
            "label": label,
            "value": val,
            "confidence": ent.get("confidence", 0.0),
            "stt_confidence": ent.get("stt_confidence", ent.get("confidence", 0.0)),
            "validator_confidence": ent.get("validator_confidence", ent.get("confidence", 0.0)),
            "validation_passed": bool(ent.get("validation_passed", 1)),
            "failed_rule": ent.get("failed_rule", ""),
            "status": ent.get("status", "captured"),
            "validation_status": ent.get("validation_status", "valid"),
            "validation_message": ent.get("validation_message", ""),
            "phonetic_summary": summary_str,
            "phonetic_details": details,
            "char_confidences": ent.get("char_confidences", []),
            "diff_ops": ent.get("diff_ops", []),
            "readback_text": readback,
            "attempts": ent.get("attempts", 1),
            "failed_attempts": ent.get("failed_attempts", 0),
        })
    if recomputed:
        db.upsert_entities(session_id, recomputed)

    db.append_audit_event(
        session_id,
        {
            "event_type": "scheme_changed",
            "role": "officer",
            "field": sess.get("active_target_id"),
            "text": f"Phonetic scheme switched to '{scheme}'.",
            "phonetic_scheme": scheme,
        },
    )
    resp = conversation_agent._build_response(
        sid=session_id,
        action="scheme_changed",
        target_id=sess.get("active_target_id"),
        reply="",
        newly_extracted=[],
    )
    await realtime_hub.broadcast(session_id, "session_state", resp)
    return resp


@router.get("/{session_id}/events")
async def stream_session_events(
    session_id: str,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
):
    """Server-Sent Events fallback stream pushing real-time session snapshots without polling."""
    raw_token = token
    if not raw_token and authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split(" ", 1)[1]
    get_user_from_token(raw_token)

    sess = db.get_session_by_id(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    queue = realtime_hub.subscribe_sse(session_id)

    async def event_generator():
        try:
            initial = conversation_agent._build_response(
                sid=session_id,
                action="session_snapshot",
                target_id=sess.get("active_target_id"),
                reply="",
                newly_extracted=[],
            )
            yield f"event: session_snapshot\ndata: {json.dumps({'type': 'session_snapshot', 'data': initial})}\n\n"
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=25.0)
                    parsed = json.loads(msg) if isinstance(msg, str) else msg
                    raw_data = msg if isinstance(msg, str) else json.dumps(msg)
                    evt_name = (parsed.get("type") or "session_state") if isinstance(parsed, dict) else "session_state"
                    yield f"event: {evt_name}\ndata: {raw_data}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            realtime_hub.unsubscribe_sse(session_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
