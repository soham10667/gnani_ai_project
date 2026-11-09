from typing import Dict, Any
from backend.services.phonetic_engine import phonetic_engine

class TTSService:
    def __init__(self, provider: str = "web_speech"):
        self.provider = provider

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
            "rate": 0.95,
            "pitch": 1.0,
            "provider": self.provider
        }

tts_service = TTSService()

