import re
from typing import List, Dict, Any

# ICAO / NATO Phonetic Alphabet
NATO_PHONETIC = {
    'A': 'Alpha', 'B': 'Bravo', 'C': 'Charlie', 'D': 'Delta', 'E': 'Echo',
    'F': 'Foxtrot', 'G': 'Golf', 'H': 'Hotel', 'I': 'India', 'J': 'Juliet',
    'K': 'Kilo', 'L': 'Lima', 'M': 'Mike', 'N': 'November', 'O': 'Oscar',
    'P': 'Papa', 'Q': 'Quebec', 'R': 'Romeo', 'S': 'Sierra', 'T': 'Tango',
    'U': 'Uniform', 'V': 'Victor', 'W': 'Whiskey', 'X': 'X-ray', 'Y': 'Yankee', 'Z': 'Zulu',
    '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
    '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine'
}

# Indian Banking Colloquial Standard
INDIAN_BANKING_PHONETIC = {
    'A': 'Apple', 'B': 'Bombay', 'C': 'Chennai', 'D': 'Delhi', 'E': 'Elephant',
    'F': 'Faridabad', 'G': 'Gujarat', 'H': 'Haryana', 'I': 'India', 'J': 'Jaipur',
    'K': 'Kolkata', 'L': 'Lucknow', 'M': 'Mumbai', 'N': 'Nagpur', 'O': 'Orissa',
    'P': 'Pune', 'Q': 'Queen', 'R': 'Ranchi', 'S': 'Shimla', 'T': 'Tamil',
    'U': 'Uttar', 'V': 'Varanasi', 'W': 'West', 'X': 'X-ray', 'Y': 'Yamuna', 'Z': 'Zari',
    '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
    '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine'
}

DIGIT_WORDS = {
    '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
    '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine'
}

class PhoneticEngine:
    @staticmethod
    def get_phonetic_spelling(text: str, standard: str = "nato") -> List[Dict[str, str]]:
        if not text:
            return []
        
        dict_map = INDIAN_BANKING_PHONETIC if standard == "indian" else NATO_PHONETIC
        clean = re.sub(r'[^A-Za-z0-9]', '', str(text)).upper()
        
        return [
            {"char": ch, "code": dict_map.get(ch, ch)}
            for ch in clean
        ]

    @staticmethod
    def format_phonetic_summary(text: str, entity_type: str = "alpha", standard: str = "nato") -> str:
        if not text:
            return ""
        
        if entity_type == "numeric" or (text.isdigit() and len(text) >= 10):
            # Read as individual digits
            digits = list(re.sub(r'\D', '', text))
            return "-".join(digits) + " (Individual Digits)"
            
        elif entity_type == "address":
            # Structured address breakdown
            parts = [p.strip() for p in text.split(',') if p.strip()]
            formatted_parts = []
            for part in parts:
                digits_match = re.search(r'\b\d{6}\b', part) # PIN code
                if digits_match:
                    pin = "-".join(list(digits_match.group()))
                    part = re.sub(r'\b\d{6}\b', f"Pin {pin}", part)
                formatted_parts.append(part)
            return ", ".join(formatted_parts)
            
        else:
            phonetics = PhoneticEngine.get_phonetic_spelling(text, standard)
            if not phonetics:
                return text
            summary_items = [f"{p['char']}-{p['code']}" for p in phonetics[:5]]
            summary = ", ".join(summary_items)
            if len(phonetics) > 5:
                summary += " ..."
            return summary

    @staticmethod
    def generate_readback_sentence(entity_label: str, value: str, entity_type: str = "alpha", standard: str = "nato") -> str:
        if not value:
            return f"Please state your {entity_label}."
            
        if entity_type == "numeric" or value.isdigit():
            spaced_digits = ", ".join([DIGIT_WORDS.get(d, d) for d in str(value)])
            return f"I captured your {entity_label} as: {spaced_digits}. Is this correct?"
            
        elif entity_type == "address":
            return f"I captured your residential address as: {value}. Please confirm if this house, street, city, and PIN code are exact."
            
        elif entity_type == "date":
            return f"I captured your Date of Birth as {value}. Please verify if this matches your official identification."
            
        else:
            # Alpha / Alphanumeric NATO spelling
            phonetics = PhoneticEngine.get_phonetic_spelling(value, standard)
            spelled_out = ", ".join([f"{p['char']} as in {p['code']}" for p in phonetics])
            return f"I captured your {entity_label} as {value}. Let me confirm the spelling: {spelled_out}. Is this correct?"

phonetic_engine = PhoneticEngine()

