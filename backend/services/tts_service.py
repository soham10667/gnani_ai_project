import time
from typing import Dict, Any, Optional
from backend.config import settings
from backend.logger import logger
from backend.services.phonetic_engine import phonetic_engine

try:
    from gnani.tts import GnaniTTSClient, AudioConfig, APIError as TTSAPIError, AuthenticationError as TTSAuthError
    GNANI_TTS_AVAILABLE = True
except ImportError:
    GNANI_TTS_AVAILABLE = False
    TTSAPIError = Exception
    TTSAuthError = Exception


class TTSService:
    """
    Official Gnani AI Timbre v3.0 Text-to-Speech Service.
    Voice benchmark evaluation (Hindi / English / Hinglish):
      - Devansh (timbre-v3.0): avg 6.96s latency, clear warm natural conversational Hinglish male tone -> SELECTED DEFAULT
      - Yashraj (timbre-v3.0): avg 31.32s latency, deeper slow delivery -> supported as selectable option
      - Shivani / Shubham / Prakash also available in Timbre v3.0.
    """

    VOICE_ALIAS_MAP = {
        "devansh": "Devansh",
        "yashraj": "Yashraj",
        "shivanni": "Shivani",
        "shivani": "Shivani",
        "shubham": "Shubham",
        "prakash": "Prakash",
        "kaveri": "Kaveri",
        "nalini": "Nalini",
    }

    V25_ONLY_VOICES = {"Kaveri", "Nalini"}

    def __init__(self, provider: str = "gnani"):
        self.provider = provider
        self.api_key = settings.GNANI_API_KEY
        self.base_url = settings.GNANI_TTS_API_URL.replace("/api/v1/tts/inference", "").rstrip("/") or "https://api.vachana.ai"
        self.default_voice = settings.GNANI_TTS_VOICE or "Devansh"
        self.default_model = settings.GNANI_TTS_MODEL or "timbre-v3.0"
        self.client: Optional[Any] = None
        self._cache: Dict[str, bytes] = {}

        # Real telemetry for health check & dashboard
        self.is_configured = bool(GNANI_TTS_AVAILABLE and self.api_key)
        self.last_status: str = "Ready" if self.is_configured else "Missing Credentials"
        self.last_error: Optional[str] = None
        self.last_latency_ms: Optional[float] = None
        self.total_requests: int = 0
        self.failed_requests: int = 0

        if self.is_configured:
            try:
                self.client = GnaniTTSClient(api_key=self.api_key, base_url=self.base_url, timeout=45)
                logger.info(
                    f"[TTS] Initialized Official Gnani Timbre Client ({self.base_url}, model={self.default_model}, voice={self.default_voice})"
                )
            except Exception as e:
                logger.error(f"[TTS] Failed to initialize GnaniTTSClient: {e}")
                self.is_configured = False
                self.last_status = "Initialization Error"
                self.last_error = str(e)
        else:
            logger.warning("[TTS] Missing GNANI_API_KEY or gnani-vachana SDK.")

    def get_status(self) -> Dict[str, Any]:
        return {
            "connected": bool(self.client and self.is_configured),
            "provider": "Gnani AI (Timbre)",
            "model": self.default_model,
            "voice": self.default_voice,
            "voice_gender": "Male" if self.default_voice in ("Devansh", "Yashraj", "Shubham", "Prakash") else "Female",
            "voice_style": "Conversational Indian Male Hinglish (Devansh selected from Devansh vs Yashraj evaluation)",
            "status": self.last_status if self.is_configured else "Missing Credentials",
            "last_latency_ms": self.last_latency_ms,
            "last_error": self.last_error,
            "total_requests": self.total_requests,
            "failed_requests": self.failed_requests,
        }

    def build_speech_prompt(self, entity_label: str, value: str, entity_type: str = "alpha") -> Dict[str, Any]:
        sentence = phonetic_engine.generate_readback_sentence(entity_label, value, entity_type)
        phonetics = phonetic_engine.get_phonetic_spelling(value)
        return {
            "prompt_text": sentence,
            "entity_label": entity_label,
            "entity_value": value,
            "phonetics": phonetics,
            "voice": self.default_voice,
            "model": self.default_model,
            "rate": 1.0,
            "provider": self.provider,
        }

    def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        model: Optional[str] = None,
        language: Optional[str] = None,
        speed: float = 1.0,
    ) -> bytes:
        """
        Synthesizes speech using official Gnani Vachana TTS API (Timbre v3.0).
        Retries transient errors explicitly and raises RuntimeError on failure (never silent mock beep).
        """
        if not text or not text.strip():
            raise ValueError("Cannot synthesize empty speech text.")

        if not self.client or not self.is_configured:
            self.last_status = "Unconfigured"
            self.last_error = "GNANI_API_KEY is missing or GnaniTTSClient unavailable."
            raise RuntimeError(self.last_error)

        clean_text = text.strip()
        requested_voice = voice or self.default_voice or "Devansh"
        selected_voice = self.VOICE_ALIAS_MAP.get(requested_voice.lower(), requested_voice)
        selected_model = "timbre-v2.5" if selected_voice in self.V25_ONLY_VOICES else (model or self.default_model or "timbre-v3.0")

        cache_key = f"{clean_text}_{selected_voice}_{selected_model}_{language}_{speed}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        self.total_requests += 1
        max_retries = 3
        last_err_msg = ""

        for attempt in range(max_retries):
            t0 = time.perf_counter()
            try:
                valid_speed = max(0.85, min(1.15, float(speed)))
                kwargs: Dict[str, Any] = {
                    "text": clean_text,
                    "voice": selected_voice,
                    "model": selected_model,
                    "audio_config": AudioConfig(container="wav", sample_rate=24000),
                }
                if selected_model == "timbre-v2.5":
                    kwargs["language"] = language or "hi-IN"
                    kwargs["speed"] = valid_speed

                audio_bytes = self.client.synthesize(**kwargs)
                latency_ms = round((time.perf_counter() - t0) * 1000, 1)

                if not audio_bytes or len(audio_bytes) <= 100:
                    raise RuntimeError("Gnani TTS returned invalid or truncated WAV payload.")

                self.last_status = "Online"
                self.last_error = None
                self.last_latency_ms = latency_ms
                self._cache[cache_key] = audio_bytes
                logger.info(
                    f"[TTS] OK voice={selected_voice} model={selected_model} ({latency_ms}ms, {len(audio_bytes)} bytes)"
                )
                return audio_bytes

            except TTSAuthError as auth_err:
                last_err_msg = f"Gnani TTS Authentication Error: {auth_err}"
                logger.error(f"[TTS] {last_err_msg}")
                break

            except TTSAPIError as api_err:
                status_code = getattr(api_err, "status_code", 500)
                last_err_msg = f"Gnani TTS API HTTP {status_code}: {api_err}"
                if status_code in (429, 502, 503, 504) and attempt < max_retries - 1:
                    wait_sec = 1.0 * (attempt + 1)
                    logger.warning(f"[TTS] Transient HTTP {status_code}, retrying in {wait_sec:.1f}s")
                    time.sleep(wait_sec)
                    continue
                logger.error(f"[TTS] {last_err_msg}")
                break

            except Exception as exc:
                last_err_msg = f"Gnani TTS synthesis error ({selected_model}/{selected_voice}): {exc}"
                if attempt < max_retries - 1:
                    wait_sec = 1.0 * (attempt + 1)
                    logger.warning(f"[TTS] Retrying after error ({exc}) in {wait_sec:.1f}s")
                    time.sleep(wait_sec)
                    continue
                logger.exception(f"[TTS] {last_err_msg}")
                break

        self.failed_requests += 1
        self.last_status = "Error"
        self.last_error = last_err_msg or "Unknown Gnani TTS error"
        raise RuntimeError(self.last_error)

    def get_supported_voices(self) -> Dict[str, Any]:
        return {
            "default_voice": self.default_voice,
            "default_model": self.default_model,
            "benchmark_note": "Devansh selected as primary conversational male voice (avg 6.96s latency vs Yashraj 31.32s across Hindi/English/Hinglish).",
            "voices": [
                {
                    "name": "Devansh",
                    "gender": "Male",
                    "model": "timbre-v3.0",
                    "recommended": True,
                    "description": "Selected Default Male — Warm, fast, clear Hinglish BFSI conversational tone"
                },
                {
                    "name": "Yashraj",
                    "gender": "Male",
                    "model": "timbre-v3.0",
                    "recommended": False,
                    "description": "Evaluated Male Option — Deep conversational Hinglish voice"
                },
                {
                    "name": "Shubham",
                    "gender": "Male",
                    "model": "timbre-v3.0",
                    "recommended": False,
                    "description": "Calm Indian Male conversational delivery"
                },
                {
                    "name": "Prakash",
                    "gender": "Male",
                    "model": "timbre-v3.0",
                    "recommended": False,
                    "description": "Deep, authoritative Indian Male BFSI tone"
                },
                {
                    "name": "Shivani",
                    "gender": "Female",
                    "model": "timbre-v3.0",
                    "recommended": False,
                    "description": "Natural Indian Female conversational Hinglish delivery"
                },
                {
                    "name": "Kaveri",
                    "gender": "Female",
                    "model": "timbre-v2.5",
                    "recommended": False,
                    "description": "Indian English Professional Assistant (Timbre v2.5)"
                },
                {
                    "name": "Nalini",
                    "gender": "Female",
                    "model": "timbre-v2.5",
                    "recommended": False,
                    "description": "Warm Hindi & Indian English tone (Timbre v2.5)"
                }
            ]
        }


tts_service = TTSService()
