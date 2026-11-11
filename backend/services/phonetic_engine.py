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
    '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine',
    '@': 'At-Sign', '.': 'Dot', '-': 'Dash', '_': 'Underscore'
}

# Indian Banking Colloquial Standard
INDIAN_BANKING_PHONETIC = {
    'A': 'Apple', 'B': 'Bombay', 'C': 'Chennai', 'D': 'Delhi', 'E': 'Elephant',
    'F': 'Faridabad', 'G': 'Gujarat', 'H': 'Haryana', 'I': 'India', 'J': 'Jaipur',
    'K': 'Kolkata', 'L': 'Lucknow', 'M': 'Mumbai', 'N': 'Nagpur', 'O': 'Orissa',
    'P': 'Pune', 'Q': 'Queen', 'R': 'Ranchi', 'S': 'Shimla', 'T': 'Tamil',
    'U': 'Uttar', 'V': 'Varanasi', 'W': 'West', 'X': 'X-ray', 'Y': 'Yamuna', 'Z': 'Zari',
    '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
    '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine',
    '@': 'At-Sign', '.': 'Dot', '-': 'Dash', '_': 'Underscore'
}

DIGIT_WORDS = {
    '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
    '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine'
}

# Clean Devanagari -> Latin phonetic mapping for Indian names, cities & transcripts
DEV_CONSONANTS = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'v', 'श': 'sh',
    'ष': 'sh', 'स': 's', 'ह': 'h', 'ळ': 'l',
    'क़': 'q', 'ख़': 'kh', 'ग़': 'gh', 'ज़': 'z', 'ड़': 'd', 'ढ़': 'dh', 'फ़': 'f'
}

DEV_VOWELS_INDEP = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'am', 'अः': 'ah'
}

DEV_MATRAS = {
    'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo',
    'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॅ': 'e', 'ॉ': 'o'
}

DEV_DIGITS = {
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
    '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
}


def devanagari_to_latin(text: str) -> str:
    """
    Converts Devanagari script words (e.g. 'सोहम शर्मा', 'पुणे') into readable phonetic Latin
    so Hinglish/Hindi speech transcripts generate complete NATO spellings.
    """
    if not text or not re.search(r'[\u0900-\u097F]', text):
        return text

    out = []
    n = len(text)
    i = 0
    while i < n:
        ch = text[i]
        if ch in DEV_DIGITS:
            out.append(DEV_DIGITS[ch])
            i += 1
        elif ch in DEV_VOWELS_INDEP:
            out.append(DEV_VOWELS_INDEP[ch])
            i += 1
        elif ch in DEV_CONSONANTS:
            # Handle nukta combined characters if present
            base = DEV_CONSONANTS[ch]
            next_ch = text[i + 1] if i + 1 < n else ''
            if next_ch == '्':  # Virama (halant) suppresses inherent 'a'
                out.append(base)
                i += 2
            elif next_ch in DEV_MATRAS:
                out.append(base + DEV_MATRAS[next_ch])
                i += 2
            elif next_ch in ('ं', 'ँ'):
                out.append(base + 'an')
                i += 2
            else:
                # Add inherent schwa 'a' if not end of word
                is_word_end = (i + 1 >= n) or not ('\u0900' <= next_ch <= '\u097F') or next_ch in (' ', ',', '.', '।')
                out.append(base if is_word_end else base + 'a')
                i += 1
        elif ch == 'ं' or ch == 'ँ':
            out.append('n')
            i += 1
        elif ch == 'ः':
            out.append('h')
            i += 1
        elif ch == '।':
            out.append('.')
            i += 1
        elif ch in DEV_MATRAS:
            out.append(DEV_MATRAS[ch])
            i += 1
        else:
            out.append(ch)
            i += 1

    result = "".join(out)
    # Clean double-spaces and title case word starts gracefully if pure lowercase latin result
    return re.sub(r'\s+', ' ', result).strip()


class PhoneticEngine:
    @staticmethod
    def get_phonetic_spelling(text: str, standard: str = "nato") -> List[Dict[str, str]]:
        if not text:
            return []

        latin_text = devanagari_to_latin(str(text))
        dict_map = INDIAN_BANKING_PHONETIC if standard == "indian" else NATO_PHONETIC
        clean = re.sub(r'[^A-Za-z0-9@._-]', '', latin_text).upper()

        return [
            {"char": ch, "code": dict_map.get(ch, ch)}
            for ch in clean
        ]

    @staticmethod
    def format_phonetic_summary(text: str, entity_type: str = "alpha", standard: str = "nato") -> str:
        if not text:
            return ""

        if entity_type in ("numeric", "phone", "account") or (str(text).isdigit() and len(str(text)) >= 10):
            digits = list(re.sub(r'\D', '', str(text)))
            return "-".join(digits) + " (Individual Digits)"

        elif entity_type == "amount":
            return f"INR {text} (Verified Currency)"

        elif entity_type == "email":
            parts = str(text).split('@')
            if len(parts) == 2:
                user_ph = " ".join([p['char'] for p in PhoneticEngine.get_phonetic_spelling(parts[0], standard)[:6]])
                return f"{user_ph} @ {parts[1]}"
            return str(text)

        elif entity_type == "address":
            latin = devanagari_to_latin(str(text))
            parts = [p.strip() for p in latin.split(',') if p.strip()]
            formatted_parts = []
            for part in parts:
                digits_match = re.search(r'\b\d{6}\b', part)
                if digits_match:
                    pin = "-".join(list(digits_match.group()))
                    part = re.sub(r'\b\d{6}\b', f"Pin {pin}", part)
                formatted_parts.append(part)
            return ", ".join(formatted_parts)

        else:
            phonetics = PhoneticEngine.get_phonetic_spelling(text, standard)
            if not phonetics:
                return str(text)
            summary_items = [f"{p['char']}-{p['code']}" for p in phonetics[:6]]
            summary = ", ".join(summary_items)
            if len(phonetics) > 6:
                summary += " ..."
            return summary

    @staticmethod
    def generate_readback_sentence(entity_label: str, value: str, entity_type: str = "alpha", standard: str = "nato") -> str:
        if not value:
            return f"Kripya apna {entity_label} batayein."

        if entity_type in ("numeric", "phone", "account") or str(value).isdigit():
            digits = re.sub(r'\D', '', str(value))
            spaced_digits = " ".join(list(digits))
            return f"Maine aapka {entity_label} note kiya hai: {spaced_digits}. Kya ye sahi hai?"

        elif entity_type == "email":
            return f"Maine aapka Email Address {value} note kiya hai. Kya ye bilkul sahi hai?"

        elif entity_type == "amount":
            return f"Maine aapka amount Rupees {value} note kiya hai. Kya ye sahi hai?"

        elif entity_type == "address":
            return f"Maine aapka residential address note kiya hai: {value}. Kya ye address bilkul sahi hai?"

        elif entity_type in ("date", "dob"):
            return f"Maine aapki Date of Birth {value} note ki hai. Kya ye sahi hai?"

        else:
            phonetics = PhoneticEngine.get_phonetic_spelling(value, standard)
            if phonetics:
                spelled_letters = "-".join([p['char'] for p in phonetics[:10]])
                spelled_codes = ", ".join([f"{p['char']} for {p['code']}" for p in phonetics[:5]])
                return f"Achha! Aapka {entity_label} hai {value}, spelling {spelled_letters} ({spelled_codes}). Kya ye sahi hai?"
            return f"Maine aapka {entity_label} note kiya hai: {value}. Kya ye bilkul sahi hai?"


phonetic_engine = PhoneticEngine()
