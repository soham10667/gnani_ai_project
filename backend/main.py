import asyncio
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.config import settings
from backend.logger import logger
from backend.database import db
from backend.routers import sessions, voice, entities, analytics, auth
from backend.routers.auth import get_user_from_token
from backend.services.gnani_stt import gnani_stt
from backend.services.tts_service import tts_service
from backend.services.llm_service import llm_service
from backend.services.conversation_agent import conversation_agent
from backend.services.realtime import realtime_hub


@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    realtime_hub.set_event_loop(asyncio.get_running_loop())
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Automated BFSI Voice Entity Verification Platform powered by Official Gnani AI STT/TTS and Stateful Conversation Management.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"[API] Unhandled server exception on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal verification engine error. Details logged for diagnostics."},
    )


app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(voice.router)
app.include_router(entities.router)
app.include_router(analytics.router)


@app.get("/")
def root():
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "running",
        "health_endpoint": "/api/health",
    }


@app.get("/health")
@app.get("/api/health")
def health_check():
    db_health = db.check_health()
    stt_status = gnani_stt.get_status()
    tts_status = tts_service.get_status()
    llm_status = llm_service.get_status()

    core_healthy = bool(db_health.get("connected"))
    return {
        "status": "healthy" if core_healthy else "degraded",
        "service": "echotrust-backend",
        "version": settings.VERSION,
        "backend": {"status": "Online", "connected": True},
        "database": db_health,
        "stt": stt_status,
        "tts": tts_status,
        "llm": llm_status,
    }


@app.websocket("/api/ws/sessions/{session_id}")
async def session_realtime_ws(
    websocket: WebSocket,
    session_id: str,
    token: Optional[str] = Query(None),
):
    """Real-time session state push channel (Zero-polling Live Verification console)."""
    try:
        get_user_from_token(token)
    except Exception:
        await websocket.close(code=4401)
        return

    sess = db.get_session_by_id(session_id)
    if not sess:
        await websocket.close(code=4404)
        return

    realtime_hub.set_event_loop(asyncio.get_running_loop())
    await realtime_hub.connect_ws(session_id, websocket)
    try:
        snapshot = conversation_agent._build_response(
            sid=session_id,
            action="session_snapshot",
            target_id=sess.get("active_target_id"),
            reply="",
            newly_extracted=[],
        )
        await websocket.send_json({"type": "session_snapshot", "data": snapshot})

        while True:
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug(f"[WS] Session {session_id} stream ended: {exc}")
    finally:
        realtime_hub.disconnect_ws(session_id, websocket)
