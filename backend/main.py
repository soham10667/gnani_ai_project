from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.routers import sessions, voice, entities, analytics
from backend.services.gnani_stt import gnani_stt
from backend.database import db

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Enterprise BFSI Voice Entity Verification with Phonetic NATO Read-Back & Correction Learning"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API Routers
app.include_router(sessions.router)
app.include_router(voice.router)
app.include_router(entities.router)
app.include_router(analytics.router)

@app.get("/")
def root():
    return {
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "stt_engine": "Gnani-BFSI-v4.2",
        "stt_mode": "production" if gnani_stt.is_configured else "mock_simulation",
        "database": "Supabase PostgreSQL" if db.use_supabase else "Resilient SQLite Local/Fallback",
        "docs_url": "/docs"
    }

@app.get("/health")
def health():
    return {"status": "healthy", "service": "verivoice-backend"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)

