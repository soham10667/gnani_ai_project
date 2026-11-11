import re
from datetime import datetime, date
from typing import Dict, Any, List
from backend.services.phonetic_engine import devanagari_to_latin


NAME_INTENT_STOPWORDS = {
    "confirm", "confirmed", "kar", "karo", "karna", "karein", "kijiye",
    "sakta", "sakti", "sakte", "hoon", "hu", "hun", "hai", "hain",
    "haan", "ha", "han", "nahi", "nahin", "nhi", "na", "naa",
    "bolo", "bol", "batao", "batayein", "bata", "bataiye", "batana",
    "sahi", "galat", "theek", "thik", "bilkul", "ok", "okay", "yes", "no",
    "nope", "yeah", "yep", "wrong", "right", "correct", "incorrect",
    "change", "badlo", "update", "fix", "repeat", "dobara", "phir",
    "please", "kripya", "shukriya", "dhanyawad", "thank", "thanks",
    "hello", "namaste", "namaskar", "mera", "meri", "mere", "naam", "name",
    "phone", "mobile", "number", "pan", "email", "address", "pincode", "pin",
    "verify", "verification", "agent", "officer", "call", "wait", "ruko",
    "sun", "suno", "kya", "kaise", "kyon", "kyu", "chahiye", "chahta",
    "chahti", "ho", "gaya", "gayi", "rakh", "rakho", "de", "do", "dena",
    "lena", "is", "am", "are", "was", "were", "can", "could", "will",
    "would", "shall", "should", "may", "might", "does", "did", "have",
    "has", "had", "my", "your", "this", "that", "it", "the", "for", "with",
    "not", "ji",
}


class BFSIValidationEngine:
    @staticmethod
    def validate_name(value: str) -> Dict[str, Any]:
        val = (value or "").strip()
        if not val:
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 0.0,
                "message": "Name cannot be empty",
                "failed_rule": "name_empty",
                "invalid_indices": [],
                "normalized": "",
                "modifier": -60.0,
            }

        if re.search(r"[\d\u0966-\u096F]", val):
            bad_idx = [i for i, c in enumerate(val) if c.isdigit()]
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 20.0,
                "message": "Name must not contain digits",
                "failed_rule": "name_digits",
                "invalid_indices": bad_idx,
                "normalized": val,
                "modifier": -55.0,
            }

        if not re.match(r"^[A-Za-z\u0900-\u097F\s\.\-']+$", val):
            bad_idx = [i for i, c in enumerate(val) if not re.match(r"[A-Za-z\u0900-\u097F\s\.\-']", c)]
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 22.0,
                "message": "Name contains invalid non-alphabetic characters",
                "failed_rule": "name_invalid_chars",
                "invalid_indices": bad_idx,
                "normalized": val,
                "modifier": -50.0,
            }

        norm = devanagari_to_latin(val).title() if re.search(r"[\u0900-\u097F]", val) else re.sub(r"\s+", " ", val).title()

        raw_tokens = re.findall(r"[A-Za-z\u0900-\u097F']+", val.lower())
        norm_tokens = re.findall(r"[a-z']+", norm.lower())
        all_tokens = set(raw_tokens) | set(norm_tokens)
        hit_intents = sorted(t for t in all_tokens if t in NAME_INTENT_STOPWORDS)
        if hit_intents:
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 18.0,
                "message": "Name contains verbs/intent words",
                "failed_rule": "name_intent_words",
                "invalid_indices": list(range(len(norm))),
                "normalized": norm,
                "modifier": -60.0,
            }

        letter_count = len(re.sub(r"[^A-Za-z\u0900-\u097F]", "", norm))
        if letter_count < 2:
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 25.0,
                "message": "Name must be at least 2 characters",
                "failed_rule": "name_min_length",
                "invalid_indices": list(range(len(norm))),
                "normalized": norm,
                "modifier": -50.0,
            }

        parts = norm.split()
        if len(parts) < 2:
            return {
                "is_valid": True,
                "status": "valid",
                "validator_confidence": 88.0,
                "message": "Valid first name (phonetic read-back recommended)",
                "failed_rule": None,
                "invalid_indices": [],
                "normalized": norm,
                "modifier": 0.0,
            }

        return {
            "is_valid": True,
            "status": "valid",
            "validator_confidence": 96.0,
            "message": "Valid full name",
            "failed_rule": None,
            "invalid_indices": [],
            "normalized": norm,
            "modifier": 5.0,
        }

    @staticmethod
    def validate_phone(value: str) -> Dict[str, Any]:
        raw = (value or "").strip()
        digits = re.sub(r"\D", "", raw)
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        elif digits.startswith("0") and len(digits) == 11:
            digits = digits[1:]

        if len(digits) != 10:
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 20.0,
                "message": "Phone must be 10 digits",
                "failed_rule": "phone_length",
                "invalid_indices": list(range(len(digits or raw))),
                "normalized": digits or raw,
                "modifier": -55.0,
            }

        if digits[0] not in ("6", "7", "8", "9"):
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 25.0,
                "message": "Phone must start with 6-9",
                "failed_rule": "phone_prefix",
                "invalid_indices": [0],
                "normalized": digits,
                "modifier": -50.0,
            }

        if len(set(digits)) <= 2:
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 30.0,
                "message": "Phone number contains repetitive digits",
                "failed_rule": "phone_repetitive",
                "invalid_indices": [],
                "normalized": digits,
                "modifier": -45.0,
            }

        return {
            "is_valid": True,
            "status": "valid",
            "validator_confidence": 97.0,
            "message": "Valid 10-digit mobile number",
            "failed_rule": None,
            "invalid_indices": [],
            "normalized": digits,
            "modifier": 5.0,
        }

    @staticmethod
    def validate_pincode(value: str) -> Dict[str, Any]:
        raw = (value or "").strip()
        digits = re.sub(r"\D", "", raw)
        if not re.match(r"^[1-9][0-9]{5}$", digits):
            reason = (
                "Pincode cannot start with 0"
                if len(digits) == 6 and digits.startswith("0")
                else "Pincode must be 6 digits"
            )
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 20.0,
                "message": reason,
                "failed_rule": "pincode_format",
                "invalid_indices": [0] if len(digits) == 6 else list(range(len(digits or raw))),
                "normalized": digits or raw,
                "modifier": -55.0,
            }

        return {
            "is_valid": True,
            "status": "valid",
            "validator_confidence": 97.0,
            "message": f"Valid 6-digit Indian PIN code ({digits})",
            "failed_rule": None,
            "invalid_indices": [],
            "normalized": digits,
            "modifier": 5.0,
        }

    @staticmethod
    def validate_email(value: str) -> Dict[str, Any]:
        val = re.sub(r"\s+", "", (value or "").strip().lower())
        if re.match(r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$", val):
            return {
                "is_valid": True,
                "status": "valid",
                "validator_confidence": 96.0,
                "message": "Valid email format",
                "failed_rule": None,
                "invalid_indices": [],
                "normalized": val,
                "modifier": 5.0,
            }
        return {
            "is_valid": False,
            "status": "invalid",
            "validator_confidence": 24.0,
            "message": "Email must match valid user@domain.tld format",
            "failed_rule": "email_format",
            "invalid_indices": [],
            "normalized": val,
            "modifier": -50.0,
        }

    @staticmethod
    def validate_amount(value: str) -> Dict[str, Any]:
        clean = re.sub(r"[^\d.]", "", str(value or "").replace(",", ""))
        if not clean:
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 20.0,
                "message": "Amount must be numeric",
                "failed_rule": "amount_parse",
                "invalid_indices": [],
                "normalized": str(value or ""),
                "modifier": -50.0,
            }
        try:
            num = float(clean)
        except ValueError:
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 20.0,
                "message": "Invalid numeric amount format",
                "failed_rule": "amount_parse",
                "invalid_indices": [],
                "normalized": str(value or ""),
                "modifier": -50.0,
            }
        if num <= 0:
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 20.0,
                "message": "Amount must be greater than zero",
                "failed_rule": "amount_positive",
                "invalid_indices": [],
                "normalized": str(value or ""),
                "modifier": -50.0,
            }
        formatted = f"{int(num):,}" if num.is_integer() else f"{num:,.2f}"
        return {
            "is_valid": True,
            "status": "valid",
            "validator_confidence": 95.0,
            "message": f"Valid currency amount (INR {formatted})",
            "failed_rule": None,
            "invalid_indices": [],
            "normalized": formatted,
            "modifier": 5.0,
        }

    @staticmethod
    def validate_address(value: str) -> Dict[str, Any]:
        raw = (value or "").strip()
        val = devanagari_to_latin(raw).title() if re.search(r"[\u0900-\u097F]", raw) else re.sub(r"\s+", " ", raw)

        tokens = re.findall(r"[A-Za-z0-9\u0900-\u097F]+", val.lower())
        if tokens and all(t in NAME_INTENT_STOPWORDS for t in tokens):
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 18.0,
                "message": "Address contains conversational filler only",
                "failed_rule": "address_intent_words",
                "invalid_indices": [],
                "normalized": val,
                "modifier": -55.0,
            }

        if len(val) < 6 or len(tokens) < 2:
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 28.0,
                "message": "Address incomplete: include house/street and city",
                "failed_rule": "address_incomplete",
                "invalid_indices": [],
                "normalized": val,
                "modifier": -45.0,
            }

        pin_match = re.search(r"\b[1-9][0-9]{5}\b", val)
        has_street = bool(
            re.search(
                r"\b(road|rd|street|st|nagar|colony|lane|flat|house|sector|block|marg|plot|apt|floor|cross|main|phase|chowk|bazar|vihar|enclave|society|layout)\b",
                val,
                re.IGNORECASE,
            )
            or re.search(r"\b\d+[A-Za-z\-\/]*\b", val)
        )

        if has_street or pin_match:
            return {
                "is_valid": True,
                "status": "valid",
                "validator_confidence": 96.0 if pin_match else 90.0,
                "message": (
                    f"Complete residential address verified (PIN {pin_match.group()})"
                    if pin_match
                    else "Complete street/locality address captured"
                ),
                "failed_rule": None,
                "invalid_indices": [],
                "normalized": val,
                "modifier": 5.0,
            }

        return {
            "is_valid": True,
            "status": "warning",
            "validator_confidence": 72.0,
            "message": "Address lacks house/street number or landmark",
            "failed_rule": "address_specificity",
            "invalid_indices": [],
            "normalized": val,
            "modifier": -10.0,
        }

    @staticmethod
    def validate_account(value: str) -> Dict[str, Any]:
        digits = re.sub(r"\D", "", value or "")
        if not digits or len(digits) < 9 or len(digits) > 18:
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 25.0,
                "message": "Account number must be 9-18 numeric digits",
                "failed_rule": "account_length",
                "invalid_indices": [],
                "normalized": digits or (value or ""),
                "modifier": -50.0,
            }
        return {
            "is_valid": True,
            "status": "valid",
            "validator_confidence": 96.0,
            "message": f"Valid {len(digits)}-digit bank account format",
            "failed_rule": None,
            "invalid_indices": [],
            "normalized": digits,
            "modifier": 5.0,
        }

    @staticmethod
    def validate_dob(value: str) -> Dict[str, Any]:
        val = (value or "").strip()
        parsed_date = None
        for fmt in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"):
            try:
                parsed_date = datetime.strptime(val, fmt).date()
                break
            except ValueError:
                pass
        if not parsed_date:
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 22.0,
                "message": "Date of birth must match DD/MM/YYYY",
                "failed_rule": "dob_format",
                "invalid_indices": [],
                "normalized": val,
                "modifier": -50.0,
            }
        today = date.today()
        age = today.year - parsed_date.year - ((today.month, today.day) < (parsed_date.month, parsed_date.day))
        if parsed_date > today or age < 18 or age > 110:
            return {
                "is_valid": False,
                "status": "invalid",
                "validator_confidence": 25.0,
                "message": "Applicant must be at least 18 years old",
                "failed_rule": "dob_age",
                "invalid_indices": [],
                "normalized": parsed_date.strftime("%d/%m/%Y"),
                "modifier": -50.0,
            }
        return {
            "is_valid": True,
            "status": "valid",
            "validator_confidence": 96.0,
            "message": f"Verified applicant DOB (age {age})",
            "failed_rule": None,
            "invalid_indices": [],
            "normalized": parsed_date.strftime("%d/%m/%Y"),
            "modifier": 5.0,
        }

    @staticmethod
    def validate_pan(value: str, allow_alt_id: bool = False) -> Dict[str, Any]:
        val = re.sub(r"[^A-Za-z0-9]", "", value or "").upper()
        pan_pattern = r"^[A-Z]{5}[0-9]{4}[A-Z]$"
        if re.match(pan_pattern, val):
            return {
                "is_valid": True,
                "status": "valid",
                "validator_confidence": 98.0,
                "message": "Valid PAN format (AAAAA9999A)",
                "failed_rule": None,
                "invalid_indices": [],
                "normalized": val,
                "modifier": 5.0,
            }

        if allow_alt_id:
            if len(val) == 12 and val.isdigit():
                return {
                    "is_valid": True,
                    "status": "valid",
                    "validator_confidence": 95.0,
                    "message": "Valid 12-digit Aadhaar format",
                    "failed_rule": None,
                    "invalid_indices": [],
                    "normalized": val,
                    "modifier": 4.0,
                }
            if re.match(r"^[A-Z][0-9]{7}$", val):
                return {
                    "is_valid": True,
                    "status": "valid",
                    "validator_confidence": 95.0,
                    "message": "Valid Indian Passport format",
                    "failed_rule": None,
                    "invalid_indices": [],
                    "normalized": val,
                    "modifier": 4.0,
                }

        # Identify exact positions violating AAAAA9999A
        bad_indices: List[int] = []
        for idx, ch in enumerate(val[:10]):
            if idx < 5 or idx == 9:
                if not ch.isalpha():
                    bad_indices.append(idx)
            elif 5 <= idx <= 8:
                if not ch.isdigit():
                    bad_indices.append(idx)
        if len(val) != 10 and not bad_indices:
            bad_indices = list(range(len(val)))

        return {
            "is_valid": False,
            "status": "invalid",
            "validator_confidence": 25.0,
            "message": "PAN must match AAAAA9999A",
            "failed_rule": "pan_format",
            "invalid_indices": bad_indices,
            "normalized": val,
            "modifier": -55.0,
        }

    @classmethod
    def validate_entity(cls, entity_type: str, value: str) -> Dict[str, Any]:
        type_clean = (entity_type or "").lower()
        if type_clean in ("name", "fullname", "alpha"):
            return cls.validate_name(value)
        elif type_clean in ("phone", "mobile", "tel"):
            return cls.validate_phone(value)
        elif type_clean in ("pan",):
            return cls.validate_pan(value, allow_alt_id=False)
        elif type_clean in ("id_doc", "national_id", "id", "alphanumeric"):
            return cls.validate_pan(value, allow_alt_id=True)
        elif type_clean in ("email", "mail"):
            return cls.validate_email(value)
        elif type_clean in ("pincode", "pin", "postal_code"):
            return cls.validate_pincode(value)
        elif type_clean in ("address", "residential_address"):
            return cls.validate_address(value)
        elif type_clean in ("amount", "loan_amount", "currency"):
            return cls.validate_amount(value)
        elif type_clean in ("account", "account_number", "acc"):
            return cls.validate_account(value)
        elif type_clean in ("dob", "date", "date_of_birth", "birthdate"):
            return cls.validate_dob(value)
        else:
            return {
                "is_valid": True,
                "status": "valid",
                "validator_confidence": 85.0,
                "message": "Entity passed validation",
                "failed_rule": None,
                "invalid_indices": [],
                "normalized": value,
                "modifier": 0.0,
            }


validation_engine = BFSIValidationEngine()
