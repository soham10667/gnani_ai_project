import re
from typing import List, Dict, Any, Optional
from backend.services.phonetic_engine import phonetic_engine
from backend.services.confidence_scorer import confidence_scorer

WORD_TO_DIGIT = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
    'oh': '0', 'double': '2x', 'triple': '3x'
}

MONTH_MAP = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12',
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'jun': '06',
    'jul': '07', 'aug': '08', 'sep': '09', 'sept': '09', 'oct': '10', 'nov': '11', 'dec': '12'
}

class AIEntityExtractor:
    @staticmethod
    def normalize_spoken_digits(text: str) -> str:
        words = text.lower().split()
        normalized_words = []
        i = 0
        while i < len(words):
            w = words[i]
            if w == 'double' and i + 1 < len(words) and words[i+1] in WORD_TO_DIGIT:
                digit = WORD_TO_DIGIT[words[i+1]]
                normalized_words.append(digit * 2)
                i += 2
                continue
            elif w == 'triple' and i + 1 < len(words) and words[i+1] in WORD_TO_DIGIT:
                digit = WORD_TO_DIGIT[words[i+1]]
                normalized_words.append(digit * 3)
                i += 2
                continue
            elif w in WORD_TO_DIGIT:
                normalized_words.append(WORD_TO_DIGIT[w])
            else:
                normalized_words.append(w)
            i += 1
        return " ".join(normalized_words)

    @classmethod
    def extract_name(cls, text: str) -> Optional[str]:
        # Patterns like: "My name is Rahul Sharma", "I am Rahul Sharma", "This is Rahul Sharma"
        patterns = [
            r"(?:my name is|i am|this is|name is|call me)\s+([A-Za-z\s\.\-']{2,40})",
            r"name:\s*([A-Za-z\s\.\-']{2,40})",
        ]
        for p in patterns:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                raw_name = match.group(1).strip()
                # Stop at punctuation or transitional words
                raw_name = re.split(r'[,;\.\n]|(?:\band\b|\bmy\b|\bphone\b|\baddress\b)', raw_name, flags=re.IGNORECASE)[0].strip()
                if len(raw_name.split()) >= 1:
                    return raw_name.title()
        return None

    @classmethod
    def extract_phone(cls, text: str) -> Optional[str]:
        norm = cls.normalize_spoken_digits(text)
        # Look for 10 digit Indian number starting with 6,7,8,9
        # Match with optional spaces/hyphens
        match = re.search(r'\b(?:(?:\+?91[\s-]?)?([6-9]\d{9}))\b', re.sub(r'[\s-]', '', norm))
        if match:
            return match.group(1)
            
        # Try finding 10 separated digits
        digits = re.findall(r'\b\d\b', norm)
        if len(digits) >= 10:
            joined = "".join(digits[:10])
            if joined[0] in '6789':
                return joined
        return None

    @classmethod
    def extract_account(cls, text: str) -> Optional[str]:
        norm = cls.normalize_spoken_digits(text)
        # Account pattern like: "account number is 123456789012"
        match = re.search(r'(?:account|acc(?:ount)?\s*no|acct)\s*(?:is|number\s*is|:)?\s*(\d{9,18})', norm, re.IGNORECASE)
        if match:
            return match.group(1)
            
        # Or isolated 11-16 digit numbers that aren't phone
        all_numbers = re.findall(r'\b\d{11,18}\b', norm)
        if all_numbers:
            return all_numbers[0]
        return None

    @classmethod
    def extract_address(cls, text: str) -> Optional[str]:
        # Match patterns like: "address is 24 MG Road, Pune, 411001", "live at ...", "residential address is ..."
        patterns = [
            r'(?:residential\s+address|address|residence|residing at|live at)\s+(?:is|:)?\s*([^;\.\n]+(?:pincode|pin|\b\d{6}\b)[^;\.\n]*)',
            r'(?:residential\s+address|address|residence)\s+(?:is|:)?\s*([^;\.\n]{10,80})',
            r'\b(\d+[\w\s,]+(?:road|rd|street|st|nagar|colony|marg|lane|block)[\w\s,]+(?:pincode|pin|\b\d{6}\b|\b[A-Za-z]+))'
        ]
        for p in patterns:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                addr = match.group(1).strip()
                return addr
        return None

    @classmethod
    def extract_dob(cls, text: str) -> Optional[str]:
        # Formats: 15/08/2002, 15-08-2002, 15th August 2002, August 15, 2002
        # Numeric format DD/MM/YYYY
        num_match = re.search(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b', text)
        if num_match:
            raw = num_match.group(1).replace('-', '/')
            parts = raw.split('/')
            day = parts[0].zfill(2)
            month = parts[1].zfill(2)
            year = parts[2]
            if len(year) == 2:
                year = f"20{year}" if int(year) <= 26 else f"19{year}"
            return f"{day}/{month}/{year}"
            
        # Spoken format like: 15th August 2002 or August 15 2002
        spoken_pattern = r'\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\b'
        match = re.search(spoken_pattern, text, re.IGNORECASE)
        if match:
            day = match.group(1).zfill(2)
            month_str = match.group(2).lower()
            year = match.group(3)
            if month_str in MONTH_MAP:
                return f"{day}/{MONTH_MAP[month_str]}/{year}"
                
        # Alternative: August 15, 2002
        alt_pattern = r'\b([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})\b'
        match_alt = re.search(alt_pattern, text, re.IGNORECASE)
        if match_alt:
            month_str = match_alt.group(1).lower()
            day = match_alt.group(2).zfill(2)
            year = match_alt.group(3)
            if month_str in MONTH_MAP:
                return f"{day}/{MONTH_MAP[month_str]}/{year}"
                
        return None

    @classmethod
    def extract_id_doc(cls, text: str) -> Optional[str]:
        clean = re.sub(r'[\s-]', '', text).upper()
        # Indian PAN: 5 letters, 4 digits, 1 letter
        pan_match = re.search(r'\b([A-Z]{5}[0-9]{4}[A-Z])\b', clean)
        if pan_match:
            return pan_match.group(1)
            
        # If words were separated e.g. "A B C D E 1 2 3 4 F"
        spaced_pan = re.search(r'\b([A-Z]\s+[A-Z]\s+[A-Z]\s+[A-Z]\s+[A-Z]\s+[0-9]\s+[0-9]\s+[0-9]\s+[0-9]\s+[A-Z])\b', text.upper())
        if spaced_pan:
            return re.sub(r'\s+', '', spaced_pan.group(1))
            
        # Check explicit trigger like "PAN is ..." or "ID is ..."
        trigger_match = re.search(r'(?:pan|id|national\s*id|passport)\s*(?:is|number|no)?\s*([A-Za-z0-9]{8,12})', text, re.IGNORECASE)
        if trigger_match:
            return trigger_match.group(1).upper()
            
        return None

    @classmethod
    def extract_all_entities(cls, text: str, acoustic_confidence: float = 90.0, target_id: Optional[str] = None) -> List[Dict[str, Any]]:
        extracted = []
        
        # If targeting a specific entity for correction
        if target_id:
            val = text.strip()
            ent_type_map = {
                "name": ("alpha", "Full Name"),
                "phone": ("numeric", "Phone Number"),
                "address": ("address", "Residential Address"),
                "account": ("numeric", "Account Number"),
                "dob": ("date", "Date of Birth"),
                "id_doc": ("alphanumeric", "National ID / PAN")
            }
            ent_type, label = ent_type_map.get(target_id, ("alpha", target_id.title()))
            score_data = confidence_scorer.calculate_score(target_id, val, acoustic_confidence, is_repeat_attempt=True, correction_attempt=1)
            phonetics = phonetic_engine.get_phonetic_spelling(score_data["normalized_value"])
            summary = phonetic_engine.format_phonetic_summary(score_data["normalized_value"], ent_type)
            
            return [{
                "id": target_id,
                "label": label,
                "value": score_data["normalized_value"],
                "type": ent_type,
                "confidence": score_data["confidence"],
                "status": "corrected",
                "validationStatus": score_data["validation_status"],
                "validationMessage": score_data["validation_message"],
                "phoneticSummary": summary,
                "phoneticDetails": phonetics,
                "history": [val]
            }]

        # Broad extraction
        name_val = cls.extract_name(text)
        if name_val:
            score = confidence_scorer.calculate_score("name", name_val, acoustic_confidence)
            extracted.append({
                "id": "name", "label": "Full Name", "value": score["normalized_value"], "type": "alpha",
                "confidence": score["confidence"], "status": "pending",
                "validationStatus": score["validation_status"], "validationMessage": score["validation_message"],
                "phoneticSummary": phonetic_engine.format_phonetic_summary(score["normalized_value"], "alpha"),
                "phoneticDetails": phonetic_engine.get_phonetic_spelling(score["normalized_value"])
            })

        phone_val = cls.extract_phone(text)
        if phone_val:
            score = confidence_scorer.calculate_score("phone", phone_val, acoustic_confidence)
            extracted.append({
                "id": "phone", "label": "Phone Number", "value": score["normalized_value"], "type": "numeric",
                "confidence": score["confidence"], "status": "pending",
                "validationStatus": score["validation_status"], "validationMessage": score["validation_message"],
                "phoneticSummary": phonetic_engine.format_phonetic_summary(score["normalized_value"], "numeric"),
                "phoneticDetails": phonetic_engine.get_phonetic_spelling(score["normalized_value"])
            })

        addr_val = cls.extract_address(text)
        if addr_val:
            score = confidence_scorer.calculate_score("address", addr_val, acoustic_confidence)
            extracted.append({
                "id": "address", "label": "Residential Address", "value": score["normalized_value"], "type": "address",
                "confidence": score["confidence"], "status": "pending",
                "validationStatus": score["validation_status"], "validationMessage": score["validation_message"],
                "phoneticSummary": phonetic_engine.format_phonetic_summary(score["normalized_value"], "address"),
                "phoneticDetails": phonetic_engine.get_phonetic_spelling(score["normalized_value"])
            })

        acc_val = cls.extract_account(text)
        if acc_val:
            score = confidence_scorer.calculate_score("account", acc_val, acoustic_confidence)
            extracted.append({
                "id": "account", "label": "Account Number", "value": score["normalized_value"], "type": "numeric",
                "confidence": score["confidence"], "status": "pending",
                "validationStatus": score["validation_status"], "validationMessage": score["validation_message"],
                "phoneticSummary": phonetic_engine.format_phonetic_summary(score["normalized_value"], "numeric"),
                "phoneticDetails": phonetic_engine.get_phonetic_spelling(score["normalized_value"])
            })

        dob_val = cls.extract_dob(text)
        if dob_val:
            score = confidence_scorer.calculate_score("dob", dob_val, acoustic_confidence)
            extracted.append({
                "id": "dob", "label": "Date of Birth", "value": score["normalized_value"], "type": "date",
                "confidence": score["confidence"], "status": "pending",
                "validationStatus": score["validation_status"], "validationMessage": score["validation_message"],
                "phoneticSummary": phonetic_engine.format_phonetic_summary(score["normalized_value"], "date"),
                "phoneticDetails": phonetic_engine.get_phonetic_spelling(score["normalized_value"])
            })

        id_val = cls.extract_id_doc(text)
        if id_val:
            score = confidence_scorer.calculate_score("id_doc", id_val, acoustic_confidence)
            extracted.append({
                "id": "id_doc", "label": "National ID / PAN", "value": score["normalized_value"], "type": "alphanumeric",
                "confidence": score["confidence"], "status": "pending",
                "validationStatus": score["validation_status"], "validationMessage": score["validation_message"],
                "phoneticSummary": phonetic_engine.format_phonetic_summary(score["normalized_value"], "alphanumeric"),
                "phoneticDetails": phonetic_engine.get_phonetic_spelling(score["normalized_value"])
            })

        return extracted

entity_extractor = AIEntityExtractor()

