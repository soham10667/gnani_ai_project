from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.config import settings
from backend.logger import logger
from backend.database import db
from backend.routers import sessions, voice, entities, analytics, auth
from backend.services.gnani_stt import gnani_stt
from backend.services.tts_service import tts_service
from backend.services.llm_service import llm_service

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Automated BFSI Voice Entity Verification Platform powered by Official Gnani AI STT/TTS and Stateful Conversation Management.",
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
