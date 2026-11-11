import os
import secrets
from pathlib import Path
from typing import List
from dotenv import load_dotenv

# Load .env or env file from project root or backend
root_dir = Path(__file__).resolve().parent.parent
env_dot = root_dir / ".env"
env_nodot = root_dir / "env"

if env_dot.exists():
    load_dotenv(dotenv_path=env_dot, override=False)
elif env_nodot.exists():
    load_dotenv(dotenv_path=env_nodot, override=False)
else:
    load_dotenv()


class Settings:
    PROJECT_NAME: str = "EchoTrust AI Voice Verification API"
    VERSION: str = "2.0.0"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Strict CORS origins (never wildcard with allow_credentials=True)
    CORS_ORIGINS: List[str] = [
        o.strip()
        for o in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if o.strip()
    ]

    # Supabase Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "").strip()

    # SQLite fallback path if Supabase is not configured
    SQLITE_DB_PATH: str = str(Path(__file__).resolve().parent / "verivoice.db")

    # EchoTrust / Gnani AI STT & TTS Credentials
    GNANI_API_KEY: str = os.getenv("GNANI_API_KEY", os.getenv("ECHOTRUST_API_KEY", "")).strip()
    GNANI_TOKEN: str = os.getenv("GNANI_TOKEN", os.getenv("ECHOTRUST_TOKEN", "")).strip()
    GNANI_ACCESS_TOKEN: str = os.getenv("GNANI_ACCESS_TOKEN", os.getenv("ECHOTRUST_ACCESS_TOKEN", "")).strip()
    GNANI_CUSTOMER_ID: str = os.getenv("GNANI_CUSTOMER_ID", os.getenv("ECHOTRUST_CUSTOMER_ID", "ApexBank-BFSI"))
    GNANI_LANG_CODE: str = os.getenv("GNANI_LANG_CODE", "indic-auto")
    GNANI_LANG_CANDIDATES: List[str] = [
        c.strip()
        for c in os.getenv("GNANI_LANG_CANDIDATES", "hi-IN,en-IN").split(",")
        if c.strip()
    ]
    GNANI_STT_FORMAT: str = os.getenv("GNANI_STT_FORMAT", "transcribe")
    GNANI_MODEL: str = os.getenv("GNANI_MODEL", os.getenv("GNANI_STT_MODEL", "prisma-v3.0"))
    GNANI_STT_API_URL: str = os.getenv("GNANI_STT_API_URL", os.getenv("GNANI_STT_ENDPOINT", "https://api.vachana.ai/stt/v3"))
    GNANI_STT_ENDPOINT: str = GNANI_STT_API_URL

    # Gnani TTS (Timbre v3.0 — Selected Conversational Male Voice: Devansh)
    GNANI_TTS_API_URL: str = os.getenv("GNANI_TTS_API_URL", "https://api.vachana.ai")
    GNANI_TTS_MODEL: str = os.getenv("GNANI_TTS_MODEL", "timbre-v3.0")
    GNANI_TTS_VOICE: str = os.getenv("GNANI_TTS_VOICE", "Devansh")

    # External LLM API Credentials (Never expose to frontend)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", os.getenv("GOOGLE_API_KEY", "")).strip()
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "").strip()
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "").strip()
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    # Verification & Confidence Thresholds
    THRESHOLD_HIGH: float = float(os.getenv("THRESHOLD_HIGH", "90.0"))
    THRESHOLD_MEDIUM: float = float(os.getenv("THRESHOLD_MEDIUM", "70.0"))
    THRESHOLD_AUTO_PASS: float = float(os.getenv("THRESHOLD_AUTO_PASS", "90.0"))
    THRESHOLD_MANDATORY_READBACK: float = float(os.getenv("THRESHOLD_MANDATORY_READBACK", "75.0"))
    THRESHOLD_AUTO_REJECT: float = float(os.getenv("THRESHOLD_AUTO_REJECT", "60.0"))

    # Phonetic Standard: "indian" | "nato"
    PHONETIC_STANDARD: str = os.getenv("PHONETIC_STANDARD", "indian")
    DEFAULT_FLOW_ENTITIES: List[str] = ["name", "phone", "pan", "email", "pincode", "address"]

    # Security / Audio Limits
    MAX_AUDIO_UPLOAD_MB: int = int(os.getenv("MAX_AUDIO_UPLOAD_MB", "15"))

    # JWT Authentication Configuration
    JWT_SECRET: str = os.getenv("JWT_SECRET", "").strip() or secrets.token_urlsafe(48)
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7


settings = Settings()
