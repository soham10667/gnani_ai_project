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

# Indian-Friendly Phonetic Standard ("A se Amit, B se Babu")
INDIAN_FRIENDLY_PHONETIC = {
    'A': 'Amit', 'B': 'Babu', 'C': 'Chandra', 'D': 'Deepak', 'E': 'Ekta',
    'F': 'Farid', 'G': 'Gopal', 'H': 'Hari', 'I': 'Indira', 'J': 'Jatin',
    'K': 'Kiran', 'L': 'Lal', 'M': 'Mohan', 'N': 'Neha', 'O': 'Om',
    'P': 'Pooja', 'Q': 'Qadir', 'R': 'Ram', 'S': 'Sita', 'T': 'Tara',
    'U': 'Umesh', 'V': 'Vijay', 'W': 'Waseem', 'X': 'X-ray', 'Y': 'Yash', 'Z': 'Zoya',
    '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
    '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine',
    '@': 'At', '.': 'Dot', '-': 'Dash', '_': 'Underscore'
}
# Alias for backwards compatibility
INDIAN_BANKING_PHONETIC = INDIAN_FRIENDLY_PHONETIC

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
    def _connector(standard: str) -> str:
        return "for" if (standard or "").lower() == "nato" else "se"

    @staticmethod
    def get_phonetic_spelling(text: str, standard: str = "indian") -> List[Dict[str, str]]:
        if not text:
            return []

        latin_text = devanagari_to_latin(str(text))
        use_nato = (standard or "indian").lower() == "nato"
        dict_map = NATO_PHONETIC if use_nato else INDIAN_FRIENDLY_PHONETIC
        clean = re.sub(r'[^A-Za-z0-9@._-]', '', latin_text).upper()

        return [
            {"char": ch, "code": dict_map.get(ch, ch)}
            for ch in clean
        ]

    @staticmethod
    def format_phonetic_summary(text: str, entity_type: str = "alpha", standard: str = "indian") -> str:
        if not text:
            return ""

        conn = PhoneticEngine._connector(standard)
        etype = (entity_type or "").lower()

        if etype in ("numeric", "phone", "account", "pincode") or (str(text).isdigit() and len(str(text)) >= 6):
            digits = list(re.sub(r'\D', '', str(text)))
            return " ".join(digits)

        if etype == "email":
            parts = str(text).split('@')
            if len(parts) == 2:
                local_ph = ", ".join([f"{p['char']} {conn} {p['code']}" for p in PhoneticEngine.get_phonetic_spelling(parts[0], standard)])
                return f"{local_ph} @ {parts[1]}"
            return str(text)

        if etype == "address":
            latin = devanagari_to_latin(str(text))
            parts = [p.strip() for p in latin.split(',') if p.strip()]
            formatted_parts = []
            for part in parts:
                digits_match = re.search(r'\b\d{6}\b', part)
                if digits_match:
                    pin = " ".join(list(digits_match.group()))
                    part = re.sub(r'\b\d{6}\b', f"PIN {pin}", part)
                formatted_parts.append(part)
            return ", ".join(formatted_parts)

        phonetics = PhoneticEngine.get_phonetic_spelling(text, standard)
        if not phonetics:
            return str(text)
        return ", ".join([f"{p['char']} {conn} {p['code']}" for p in phonetics])

    @staticmethod
    def generate_readback_sentence(entity_label: str, value: str, entity_type: str = "alpha", standard: str = "indian") -> str:
        if not value:
            return f"Kripya apna {entity_label} batayein."

        scheme = (standard or "indian").lower()
        conn = PhoneticEngine._connector(scheme)
        etype = (entity_type or "").lower()

        if etype in ("numeric", "phone", "account", "pincode") or str(value).isdigit():
            digits = re.sub(r'\D', '', str(value))
            spaced_digits = " ".join(list(digits))
            return f"Maine aapka {entity_label} note kiya hai: {spaced_digits}. Kya ye sahi hai?"

        if etype == "email":
            parts = str(value).split('@')
            if len(parts) == 2:
                phonetics = PhoneticEngine.get_phonetic_spelling(parts[0], scheme)
                spelled = ", ".join([f"{p['char']} {conn} {p['code']}" for p in phonetics])
                domain_spoken = parts[1].replace(".", " dot ")
                return f"Maine aapka Email Address {value} note kiya hai — {spelled}, at {domain_spoken}. Kya ye sahi hai?"
            return f"Maine aapka Email Address {value} note kiya hai. Kya ye sahi hai?"

        if etype == "amount":
            return f"Maine aapka amount Rupees {value} note kiya hai. Kya ye sahi hai?"

        if etype == "address":
            formatted_addr = PhoneticEngine.format_phonetic_summary(value, "address", scheme)
            return f"Maine aapka Residential Address note kiya hai: {formatted_addr}. Kya ye sahi hai?"

        if etype in ("date", "dob"):
            return f"Maine aapki Date of Birth {value} note ki hai. Kya ye sahi hai?"

        phonetics = PhoneticEngine.get_phonetic_spelling(value, scheme)
        if phonetics:
            spelled_codes = ", ".join(
                [f"{p['char']} {conn} {p['code']}" if p['char'].isalpha() else p['code'] for p in phonetics]
            )
            return f"Maine aapka {entity_label} {value} note kiya hai: {spelled_codes}. Kya ye sahi hai?"
        return f"Maine aapka {entity_label} {value} note kiya hai. Kya ye sahi hai?"


phonetic_engine = PhoneticEngine()
