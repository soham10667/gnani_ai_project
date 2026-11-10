import re
from typing import Dict, Any, List, Optional
from backend.config import settings
from backend.services.entity_extractor import entity_extractor
from backend.services.phonetic_engine import phonetic_engine
from backend.services.tts_service import tts_service
from backend.services.llm_service import llm_service


class EchoTrustConversationAgent:
    """
    Intelligent Conversational AI agent for EchoTrust.
    Manages multi-turn BFSI KYC voice verification, understands intent,
    maintains slot-filling progression across all 6 KYC entities,
    and formulates natural, friendly Hinglish dialogue.
    """

    AFFIRMATIVE_WORDS = {
        'haan', 'ha', 'sahi', 'correct', 'yes', 'theek', 'thik', 'bilkul',
        'yep', 'yeah', 'right', 'ok', 'okay', 'confirmed', 'done', 'accha',
        'हाँ', 'हा', 'सही', 'बिलकुल', 'ठीक', 'हां'
    }

    NEGATIVE_WORDS = {
        'nahi', 'nahin', 'no', 'galat', 'wrong', 'incorrect', 'change',
        'badlo', 'na', 'nope', 'never', 'cancel', 'गलत', 'नहीं', 'ना'
    }

    GREETING_WORDS = {
        'hello', 'namaste', 'hi', 'hey', 'pranam', 'swagat', 'kya karna hai',
        'kaise ho', 'start', 'begin', 'help', 'madad', 'नमस्ते', 'नमस्कार',
        'प्रणाम', 'स्वागत', 'मदद', 'कैसे', 'हेलो', 'हाय'
    }

    ENTITY_ORDER = [
        {"id": "name", "label": "Full Name", "prompt": "Kripya apna poora naam batayein."},
        {"id": "phone", "label": "Phone Number", "prompt": "Ab kripya apna 10 digit ka mobile number batayein."},
        {"id": "address", "label": "Residential Address", "prompt": "Kripya apna current residential address bolkar batayein."},
        {"id": "account", "label": "Account Number", "prompt": "Kripya apna bank account number batayein."},
        {"id": "dob", "label": "Date of Birth", "prompt": "Kripya apni Date of Birth ya janm tithi batayein."},
        {"id": "id_doc", "label": "National ID / PAN", "prompt": "Aakhri step: kripya apna 10 digit ka PAN card number batayein."}
    ]

    def get_next_entity_prompt(self, current_target_id: Optional[str]) -> Optional[Dict[str, str]]:
        if not current_target_id:
            return self.ENTITY_ORDER[0]
        for idx, item in enumerate(self.ENTITY_ORDER):
            if item["id"] == current_target_id:
                if idx + 1 < len(self.ENTITY_ORDER):
                    return self.ENTITY_ORDER[idx + 1]
                return None
        return self.ENTITY_ORDER[0]

    def process_turn(
        self,
        user_text: str,
        acoustic_confidence: float = 94.0,
        current_entities: Optional[List[Dict[str, Any]]] = None,
        active_target_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processes one conversational turn:
        1. Analyzes intent (greeting, affirmation, negation/correction, entity statement).
        2. Automatically updates entity model and progression.
        3. Generates natural Hinglish AI response.
        4. Decides what question to ask next.
        """
        text = (user_text or "").strip()
        lower_text = text.lower()
        clean_words = set(re.findall(r'\b[a-z\u0900-\u097F]+\b', lower_text))

        # 1. Entity extraction first
        extracted_entities = entity_extractor.extract_all_entities(
            text=text,
            acoustic_confidence=acoustic_confidence,
            target_id=active_target_id
        )

        ai_response_text = ""
        action = "dialogue"
        next_target_id = active_target_id
        is_all_confirmed = False

        # Greeting Intent
        if any(w in clean_words for w in self.GREETING_WORDS) and not extracted_entities:
            ai_response_text = (
                "Namaste! EchoTrust voice verification system mein aapka swagat hai. "
                "Main aapki identity details verify karne mein help karungi. Kripya apna poora naam batayein."
            )
            action = "greeting"
            next_target_id = "name"

        # Affirmation / Confirmation Intent (e.g. "Haan bilkul", "Sahi hai")
        elif any(w in clean_words for w in self.AFFIRMATIVE_WORDS) and not extracted_entities:
            target_label = "detail"
            ent_type_map = {e["id"]: e["label"] for e in self.ENTITY_ORDER}
            if active_target_id:
                target_label = ent_type_map.get(active_target_id, active_target_id.title())

            next_step = self.get_next_entity_prompt(active_target_id)
            if next_step:
                ai_response_text = (
                    f"Boht badhiya! Aapka {target_label} successfully verify aur confirm ho gaya hai. "
                    f"{next_step['prompt']}"
                )
                action = "confirm_entity"
                next_target_id = next_step["id"]
            else:
                ai_response_text = (
                    f"Boht boht shukriya! Aapke sabhi 6 KYC identity details successfully verify aur confirm ho chuke hain. "
                    "Session complete aur approved ho chuka hai."
                )
                action = "all_confirmed"
                next_target_id = None
                is_all_confirmed = True

        # Negation / Correction Request (e.g. "Nahi, galat hai")
        elif any(w in clean_words for w in self.NEGATIVE_WORDS) and not extracted_entities:
            ai_response_text = (
                "Koi baat nahi, samajh gaya. Kripya apna sahi detail clear aawaz mein bolkar batayein, "
                "main abhi update kar deti hoon."
            )
            action = "request_correction"

        # Direct Entity Capture Turn
        elif extracted_entities:
            first_ent = extracted_entities[0]
            eid = first_ent.get("id") or "name"
            label = first_ent.get("label", "Detail")
            val = first_ent.get("value", "")
            phonetics_list = phonetic_engine.get_phonetic_spelling(val)
            
            # Format friendly phonetic spelling for read-back
            if first_ent.get("type") == "numeric":
                spelled = " - ".join(list(val))
            else:
                spelled = ", ".join([f"{p['char']} as in {p['code']}" for p in phonetics_list[:6]])

            ai_response_text = (
                f"Shukriya! Maine aapka {label} note kiya hai: '{val}'. "
                f"Ek baar spelling verify kar lijiye: {spelled}. "
                "Kya ye information bilkul sahi hai?"
            )
            action = "entity_captured"
            next_target_id = eid

        # General conversational response
        else:
            clean_text = re.sub(r'[\u0C00-\u0C7F\u0B80-\u0BFF\u0C80-\u0CFF\u0D00-\u0D7F]', '', text).strip()
            ai_response_text = (
                f"Maine suna: '{clean_text}'. "
                "Kripya apna poora naam, phone number, ya address bolkar batayein taaki KYC verification complete ho sake."
            )
            action = "prompt_input"

        return {
            "transcript": text,
            "ai_response_text": ai_response_text,
            "action": action,
            "extracted_entities": extracted_entities,
            "active_target_id": next_target_id,
            "is_all_confirmed": is_all_confirmed,
            "confidence": acoustic_confidence,
            "stt_engine": f"Gnani Prisma-v3.0 ({settings.GNANI_LANG_CODE})",
            "tts_engine": f"Gnani Timbre-v3.0 ({settings.GNANI_TTS_VOICE})",
            "voice": settings.GNANI_TTS_VOICE,
            "llm_provider": llm_service.provider,
            "model": settings.GNANI_TTS_MODEL
        }

conversation_agent = EchoTrustConversationAgent()
