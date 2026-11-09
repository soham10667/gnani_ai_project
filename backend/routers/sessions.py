from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from backend.database import db
from backend.models import SessionCreateRequest, SessionUpdateRequest

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])

@router.get("")
def list_sessions(
    search: Optional[str] = Query(None, description="Search by customer name, customer ID, or session ID"),
    status: Optional[str] = Query(None, description="Filter by session status"),
    channel: Optional[str] = Query(None, description="Filter by channel"),
    limit: int = Query(50, ge=1, le=200)
):
    sessions = db.get_sessions(search=search or "", status=status or "", channel=channel or "", limit=limit)
    return {"sessions": sessions, "count": len(sessions)}

@router.post("")
def create_session(req: SessionCreateRequest):
    new_session = db.create_session(req.dict())
    return {"session": new_session, "message": "Verification session initialized"}

@router.get("/{session_id}")
def get_session(session_id: str):
    session = db.get_session_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return {"session": session}

@router.patch("/{session_id}")
def update_session(session_id: str, req: SessionUpdateRequest):
    updates = {k: v for k, v in req.dict().items() if v is not None}
    updated = db.update_session(session_id, updates)
    if not updated:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    return {"session": updated, "message": "Session updated successfully"}

