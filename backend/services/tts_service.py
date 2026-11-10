import os
import io
import wave
import math
import struct
from typing import Dict, Any, Optional
from backend.config import settings
from backend.services.phonetic_engine import phonetic_engine

try:
    from gnani.tts import GnaniTTSClient, AudioConfig
    GNANI_TTS_AVAILABLE = True
except ImportError:
    GNANI_TTS_AVAILABLE = False


class TTSService:
    VOICE_ALIAS_MAP = {
        "shivanni": "Shivani",
        "shivani": "Shivani",
        "devansh": "Devansh",
        "yashraj": "Yashraj",
        "shubham": "Shubham",
        "prakash": "Prakash",
        "kaveri": "Kaveri",
        "nalini": "Nalini"
    }

    def __init__(self, provider: str = "gnani"):
        self.provider = provider
        self.api_key = settings.GNANI_API_KEY
        self.default_voice = settings.GNANI_TTS_VOICE or "Shivani"
        self.default_model = settings.GNANI_TTS_MODEL or "timbre-v3.0"
        self.client = None
        self._cache: Dict[str, bytes] = {}

        if GNANI_TTS_AVAILABLE and self.api_key:
            try:
                self.client = GnaniTTSClient(api_key=self.api_key)
                print(f"[EchoTrust TTS] Initialized Official Gnani Timbre v3.0 TTS Client (Voice: {self.default_voice})")
            except Exception as e:
                print(f"[EchoTrust TTS] Failed to initialize GnaniTTSClient: {e}")
        else:
            print("[EchoTrust TTS] Gnani TTS client running in fallback mode")

    def build_speech_prompt(self, entity_label: str, value: str, entity_type: str = "alpha") -> Dict[str, Any]:
        """
        Builds natural speech confirmation prompt with NATO phonetic spelling.
        """
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
            "provider": self.provider
        }

    def _generate_fallback_wav(self, text: str) -> bytes:
        """
        Generates a valid, lightweight PCM WAV tone sequence as a graceful fallback.
        """
        sample_rate = 16000
        duration = 1.0
        num_samples = int(sample_rate * duration)
        
        buf = io.BytesIO()
        with wave.open(buf, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            
            freq = 440.0
            for i in range(num_samples):
                t = float(i) / sample_rate
                envelope = max(0.0, 1.0 - (t / duration))
                sample = int(32767.0 * 0.3 * envelope * math.sin(2.0 * math.pi * freq * t))
                wf.writeframes(struct.pack('<h', sample))
                
        return buf.getvalue()

    def synthesize(
        self,
        text: str,
        voice: Optional[str] = None,
        model: Optional[str] = None,
        language: Optional[str] = None,
        speed: float = 1.0
    ) -> bytes:
        """
        Synthesizes speech using official Gnani Vachana TTS API (Timbre v3.0).
        Selected default voice 'Shubham' matches the calm, confident, natural
        Indian male podcast tone of reference audio (generated-audio.wav).
        """
        if not text or not text.strip():
            return self._generate_fallback_wav("Empty text")

        clean_text = text.strip()
        requested_voice = voice or self.default_voice or "Shivani"
        selected_voice = self.VOICE_ALIAS_MAP.get(requested_voice.lower(), requested_voice)
        selected_model = model or self.default_model or "timbre-v3.0"

        cache_key = f"{clean_text}_{selected_voice}_{selected_model}_{language}_{speed}"
        if cache_key in self._cache:
            return self._cache[cache_key]

        if self.client:
            try:
                valid_speed = max(0.85, min(1.15, float(speed)))
                
                # timbre-v3.0 is cross-lingual multilingual; language is only passed for timbre-v2.5
                kwargs = {
                    "text": clean_text,
                    "voice": selected_voice,
                    "model": selected_model,
                    "audio_config": AudioConfig(
                        container="wav",
                        sample_rate=24000
                    )
                }
                if selected_model == "timbre-v2.5":
                    kwargs["language"] = language or "en-IN"
                    kwargs["speed"] = valid_speed

                audio_bytes = self.client.synthesize(**kwargs)
                if audio_bytes and len(audio_bytes) > 100:
                    self._cache[cache_key] = audio_bytes
                    return audio_bytes
            except Exception as e:
                print(f"[EchoTrust TTS] Gnani synthesis error ({selected_model}/{selected_voice}): {e}")

        # Fallback if synthesis failed
        fallback_audio = self._generate_fallback_wav(clean_text)
        self._cache[cache_key] = fallback_audio
        return fallback_audio

    def get_supported_voices(self) -> Dict[str, Any]:
        return {
            "default_voice": self.default_voice,
            "default_model": self.default_model,
            "reference_audio": "generated-audio.wav",
            "matched_voice": "Shivani (Indian Female - Conversational Hinglish)",
            "voices": [
                {
                    "name": "Shivani",
                    "gender": "Female",
                    "model": "timbre-v3.0",
                    "match": "Reference Audio Match (generated-audio (1).wav)",
                    "description": "Natural Indian Female, clear, warm, confident conversational Hinglish delivery"
                },
                {
                    "name": "Shubham",
                    "gender": "Male",
                    "model": "timbre-v3.0",
                    "match": "Alternate Male",
                    "description": "Natural Indian Male, calm, podcast conversational Hinglish delivery"
                },
                {
                    "name": "Devansh",
                    "gender": "Male",
                    "model": "timbre-v3.0",
                    "match": "Alternate Male",
                    "description": "Warm, friendly Indian Male conversational tone"
                },
                {
                    "name": "Prakash",
                    "gender": "Male",
                    "model": "timbre-v3.0",
                    "match": "Authoritative Male",
                    "description": "Deep, authoritative Indian Male BFSI tone"
                },
                {
                    "name": "Kaveri",
                    "gender": "Female",
                    "model": "timbre-v2.5",
                    "match": "Professional Female",
                    "description": "Indian English Professional BFSI Assistant"
                },
                {
                    "name": "Nalini",
                    "gender": "Female",
                    "model": "timbre-v2.5",
                    "match": "Hindi Female",
                    "description": "Warm Hindi & Indian English tone"
                }
            ]
        }

tts_service = TTSService()
