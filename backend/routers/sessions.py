from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query, Depends
from backend.database import db
from backend.models import SessionCreate, SessionUpdate
from backend.routers.auth import get_current_user

router = APIRouter(prefix="/api/sessions", tags=["Verification Sessions"])


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
    return updated
