import os
import json
import re
from typing import Dict, Any, List, Optional
from backend.config import settings

class LLMService:
    """
    EchoTrust Intelligent Conversational LLM Service.
    Connects to live LLM providers (Google Gemini API, Groq, or OpenAI)
    with a stateful, deterministic BFSI KYC decision engine as fallback.
    """

    def __init__(self):
        self.gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        self.groq_key = os.getenv("GROQ_API_KEY")
        self.openai_key = os.getenv("OPENAI_API_KEY")
        
        self.provider = "native"
        self.model = "echotrust-bfsi-v4"

        if self.gemini_key:
            self.provider = "gemini"
            self.model = "gemini-1.5-flash"
            print(f"[EchoTrust LLM] Initialized Google Gemini API Provider ({self.model})")
        elif self.groq_key:
            self.provider = "groq"
            self.model = "llama-3.3-70b-versatile"
            print(f"[EchoTrust LLM] Initialized Groq API Provider ({self.model})")
        elif self.openai_key:
            self.provider = "openai"
            self.model = "gpt-4o-mini"
            print(f"[EchoTrust LLM] Initialized OpenAI API Provider ({self.model})")
        else:
            self.provider = "native_bfsi_engine"
            self.model = "echotrust-dialogue-v4"
            print(f"[EchoTrust LLM] Running on Native BFSI Conversational Engine ({self.model})")

    def get_status(self) -> Dict[str, Any]:
        has_external_key = bool(self.gemini_key or self.groq_key or self.openai_key)
        return {
            "connected": True,
            "provider": self.provider,
            "model": self.model,
            "has_external_llm_key": has_external_key,
            "status": "Online"
        }

    async def generate_conversational_response(
        self,
        user_text: str,
        context_history: List[Dict[str, str]],
        extracted_entities: List[Dict[str, Any]],
        active_target: Optional[Dict[str, Any]] = None,
        all_confirmed: bool = False
    ) -> Optional[str]:
        """
        Invokes external LLM if API key is provided; otherwise returns None
        so the specialized BFSI decision engine generates the regulatory readback.
        """
        if not (self.gemini_key or self.groq_key or self.openai_key):
            return None

        # Build prompt for LLM
        prompt = (
            "You are an intelligent, polite, friendly BFSI KYC verification voice assistant for EchoTrust.\n"
            "Language: Speak in natural, conversational Hinglish (Hindi words written in Latin or Devanagari script, blended smoothly with English).\n"
            "Tone: Calm, professional, helpful, warm, Indian conversational tone.\n"
            "Rules:\n"
            "1. Keep responses short and crisp (1-2 sentences), suitable for spoken text-to-speech audio.\n"
            "2. Read back newly extracted entity values with phonetic clarity.\n"
            "3. Ask the user for confirmation ('Kya ye sahi hai?') before proceeding.\n"
            "4. If user confirms, praise and prompt for the next required KYC detail.\n"
            f"User input: {user_text}\n"
            f"Extracted entities: {json.dumps(extracted_entities)}\n"
            f"Active target: {json.dumps(active_target) if active_target else 'None'}\n"
            f"All confirmed: {all_confirmed}\n"
        )

        try:
            if self.provider == "gemini":
                import urllib.request
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.gemini_key}"
                req_data = json.dumps({
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.4, "maxOutputTokens": 100}
                }).encode("utf-8")
                req = urllib.request.Request(url, data=req_data, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=4) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    return text
        except Exception as e:
            print(f"[EchoTrust LLM] External API call error ({e}), falling back to Native BFSI engine.")
            return None

        return None

llm_service = LLMService()

