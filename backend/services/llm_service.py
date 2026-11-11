import json
import time
import asyncio
from typing import Dict, Any, List, Optional
import httpx
from backend.config import settings
from backend.logger import logger


class LLMService:
    """
    EchoTrust Conversational LLM Service.
    Connects via official HTTPS endpoints to Google Gemini, Groq, or OpenAI when API keys
    are provided in environment variables. Honestly reports missing credentials when unconfigured
    while providing structured multi-turn intent assistance.
    """

    def __init__(self):
        self.gemini_key = settings.GEMINI_API_KEY
        self.groq_key = settings.GROQ_API_KEY
        self.openai_key = settings.OPENAI_API_KEY

        self.provider: str = "unconfigured"
        self.model: str = "none"
        self.configured: bool = False
        self.last_status: str = "Missing Credentials"
        self.last_error: Optional[str] = None
        self.last_latency_ms: Optional[float] = None

        if self.gemini_key:
            self.provider = "gemini"
            self.model = settings.GEMINI_MODEL
            self.configured = True
            self.last_status = "Ready"
            logger.info(f"[LLM] Configured Google Gemini API ({self.model})")
        elif self.groq_key:
            self.provider = "groq"
            self.model = settings.GROQ_MODEL
            self.configured = True
            self.last_status = "Ready"
            logger.info(f"[LLM] Configured Groq API ({self.model})")
        elif self.openai_key:
            self.provider = "openai"
            self.model = settings.OPENAI_MODEL
            self.configured = True
            self.last_status = "Ready"
            logger.info(f"[LLM] Configured OpenAI API ({self.model})")
        else:
            self.last_error = "No external LLM key found (GEMINI_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY)."
            logger.warning(f"[LLM] {self.last_error} Using deterministic BFSI NLU engine.")

    def get_status(self) -> Dict[str, Any]:
        return {
            "connected": self.configured,
            "configured": self.configured,
            "provider": self.provider if self.configured else "none (Missing Credentials)",
            "model": self.model if self.configured else "deterministic-nlu-fallback",
            "has_external_llm_key": self.configured,
            "status": self.last_status,
            "last_latency_ms": self.last_latency_ms,
            "last_error": self.last_error,
        }

    def _build_system_prompt(
        self,
        entities_state: List[Dict[str, Any]],
        active_target_id: Optional[str],
        next_prompt_hint: str,
    ) -> str:
        entities_summary = [
            {
                "id": e.get("entity_type") or e.get("id"),
                "label": e.get("label"),
                "value": e.get("value"),
                "status": e.get("status"),
                "confidence": e.get("confidence"),
            }
            for e in entities_state
        ]
        return (
            "You are EchoTrust, an intelligent, warm, conversational Indian Male BFSI voice verification assistant (voice: Devansh).\n"
            "Speak naturally in crisp Hinglish (simple everyday Hindi + English words in Latin script so Indian TTS sounds natural).\n"
            "Keep spoken replies brief (1-2 sentences, max 35 words) with phonetic clarity when verifying names/IDs/numbers.\n"
            "Return ONLY a JSON object with keys:\n"
            '  "intent": one of ["greeting", "provide_entity", "confirm", "reject_or_correct", "follow_up_question", "other"],\n'
            '  "reply": "natural crisp Hinglish response for voice synthesis"\n'
            f"Current KYC Entities in DB: {json.dumps(entities_summary)}\n"
            f"Currently Awaiting Confirmation For: {active_target_id or 'None'}\n"
            f"Suggested Next Step Prompt: {next_prompt_hint}\n"
            "NEVER say an unconfirmed value is permanently verified unless user affirmed it."
        )

    async def analyze_and_respond(
        self,
        user_text: str,
        dialogue_history: List[Dict[str, Any]],
        entities_state: List[Dict[str, Any]],
        active_target_id: Optional[str] = None,
        next_prompt_hint: str = "",
    ) -> Optional[Dict[str, str]]:
        """
        Invokes the configured live LLM provider asynchronously with retries.
        Returns parsed {"intent": ..., "reply": ...} or None if unconfigured/unavailable.
        """
        if not self.configured:
            return None

        system_prompt = self._build_system_prompt(entities_state, active_target_id, next_prompt_hint)
        recent_turns = [
            {"role": "assistant" if m.get("sender") == "ai" else "user", "content": str(m.get("text", ""))}
            for m in (dialogue_history or [])[-6:]
            if m.get("text")
        ]

        max_retries = 2
        for attempt in range(max_retries):
            t0 = time.perf_counter()
            try:
                async with httpx.AsyncClient(timeout=12.0) as client:
                    if self.provider == "gemini":
                        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.gemini_key}"
                        history_text = "\n".join([f"{t['role']}: {t['content']}" for t in recent_turns])
                        payload = {
                            "contents": [
                                {
                                    "parts": [
                                        {
                                            "text": f"{system_prompt}\n\nConversation History:\n{history_text}\nUser just said: {user_text}"
                                        }
                                    ]
                                }
                            ],
                            "generationConfig": {
                                "temperature": 0.3,
                                "maxOutputTokens": 180,
                                "responseMimeType": "application/json",
                            },
                        }
                        resp = await client.post(url, json=payload)
                        if resp.status_code == 200:
                            data = resp.json()
                            raw = data["candidates"][0]["content"]["parts"][0]["text"]
                        else:
                            raise RuntimeError(f"Gemini HTTP {resp.status_code}: {resp.text[:200]}")

                    elif self.provider in ("groq", "openai"):
                        endpoint = (
                            "https://api.groq.com/openai/v1/chat/completions"
                            if self.provider == "groq"
                            else "https://api.openai.com/v1/chat/completions"
                        )
                        api_key = self.groq_key if self.provider == "groq" else self.openai_key
                        messages = [{"role": "system", "content": system_prompt}] + recent_turns + [
                            {"role": "user", "content": user_text}
                        ]
                        resp = await client.post(
                            endpoint,
                            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                            json={
                                "model": self.model,
                                "messages": messages,
                                "temperature": 0.3,
                                "max_tokens": 180,
                                "response_format": {"type": "json_object"},
                            },
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            raw = data["choices"][0]["message"]["content"]
                        else:
                            raise RuntimeError(f"{self.provider} HTTP {resp.status_code}: {resp.text[:200]}")
                    else:
                        return None

                self.last_latency_ms = round((time.perf_counter() - t0) * 1000, 1)
                self.last_status = "Connected"
                self.last_error = None

                parsed = json.loads(raw)
                if isinstance(parsed, dict) and parsed.get("reply"):
                    return {
                        "intent": str(parsed.get("intent", "other")),
                        "reply": str(parsed["reply"]).strip(),
                    }
                return None

            except Exception as e:
                self.last_error = str(e)
                if attempt < max_retries - 1:
                    await asyncio.sleep(0.8)
                    continue
                self.last_status = "Error"
                logger.warning(f"[LLM] {self.provider} request failed ({e}), falling back to BFSI NLU engine.")
                return None

        return None


llm_service = LLMService()
