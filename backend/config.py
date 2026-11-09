import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from project root or backend
env_path = Path(__file__).resolve().parent.parent / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

class Settings:
    PROJECT_NAME: str = "VeriVoice AI Read-Back API"
    VERSION: str = "1.0.0"
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # Supabase Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    
    # SQLite fallback path if Supabase is not configured
    SQLITE_DB_PATH: str = str(Path(__file__).resolve().parent / "verivoice.db")
    
    # Gnani STT API Credentials
    GNANI_API_KEY: str = os.getenv("GNANI_API_KEY", "")
    GNANI_TOKEN: str = os.getenv("GNANI_TOKEN", "")
    GNANI_ACCESS_TOKEN: str = os.getenv("GNANI_ACCESS_TOKEN", "")
    GNANI_CUSTOMER_ID: str = os.getenv("GNANI_CUSTOMER_ID", "ApexBank-BFSI")
    GNANI_LANG_CODE: str = os.getenv("GNANI_LANG_CODE", "en-IN")
    GNANI_MODEL: str = os.getenv("GNANI_MODEL", "prisma-v3.0")
    GNANI_STT_ENDPOINT: str = os.getenv("GNANI_STT_ENDPOINT", "https://api.vachana.ai/stt/v3")
    
    # Verification & Confidence Thresholds
    THRESHOLD_HIGH: float = float(os.getenv("THRESHOLD_HIGH", "90.0"))
    THRESHOLD_MEDIUM: float = float(os.getenv("THRESHOLD_MEDIUM", "70.0"))
    THRESHOLD_AUTO_PASS: float = float(os.getenv("THRESHOLD_AUTO_PASS", "90.0"))
    THRESHOLD_MANDATORY_READBACK: float = float(os.getenv("THRESHOLD_MANDATORY_READBACK", "75.0"))
    THRESHOLD_AUTO_REJECT: float = float(os.getenv("THRESHOLD_AUTO_REJECT", "60.0"))
    
    # Phonetic Standard: "nato" | "indian" | "digit_grouped"
    PHONETIC_STANDARD: str = os.getenv("PHONETIC_STANDARD", "nato")

settings = Settings()

