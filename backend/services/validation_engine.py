import re
from datetime import datetime, date
from typing import Dict, Any
from backend.services.phonetic_engine import devanagari_to_latin


class BFSIValidationEngine:
    @staticmethod
    def validate_name(value: str) -> Dict[str, Any]:
        val = value.strip()
        if not val:
            return {"is_valid": False, "status": "invalid", "message": "Name cannot be empty", "normalized": "", "modifier": -30.0}

        # Check allowed characters (letters, spaces, dots, hyphens, and Devanagari)
        if not re.match(r"^[A-Za-z\u0900-\u097F\s\.\-']+$", val):
            return {"is_valid": False, "status": "invalid", "message": "Name contains invalid non-alphabetic characters", "normalized": val, "modifier": -25.0}

        # Provide clean Latinized display when STT returned Devanagari
        norm = devanagari_to_latin(val).title() if re.search(r"[\u0900-\u097F]", val) else val.title()

        parts = norm.split()
        if len(parts) < 2:
            return {
                "is_valid": True,
                "status": "warning",
                "message": "Single name captured. Phonetic read-back confirmation recommended.",
                "normalized": norm,
                "modifier": -8.0,
            }

        if len(norm) < 3:
            return {"is_valid": False, "status": "invalid", "message": "Name is too short for verification", "normalized": norm, "modifier": -25.0}

        return {"is_valid": True, "status": "valid", "message": "Valid full name according to BFSI KYC guidelines", "normalized": norm, "modifier": 5.0}

    @staticmethod
    def validate_phone(value: str) -> Dict[str, Any]:
        digits = re.sub(r"\D", "", value)
        if digits.startswith("91") and len(digits) == 12:
            digits = digits[2:]
        elif digits.startswith("0") and len(digits) == 11:
            digits = digits[1:]

        if len(digits) != 10:
            return {
                "is_valid": False,
                "status": "invalid",
                "message": f"Expected 10-digit mobile number, received {len(digits)} digits",
                "normalized": digits or value,
                "modifier": -30.0,
            }

        if digits[0] not in ("6", "7", "8", "9"):
            return {
                "is_valid": False,
                "status": "warning",
                "message": "Indian mobile numbers must start with digits 6, 7, 8, or 9",
                "normalized": digits,
                "modifier": -20.0,
            }

        if len(set(digits)) <= 2:
            return {
                "is_valid": False,
                "status": "warning",
                "message": "Suspicious repetitive phone number pattern detected",
                "normalized": digits,
                "modifier": -25.0,
            }

        return {
            "is_valid": True,
            "status": "valid",
            "message": "Valid 10-digit Indian mobile number",
            "normalized": digits,
            "modifier": 5.0,
        }

    @staticmethod
    def validate_email(value: str) -> Dict[str, Any]:
        val = re.sub(r"\s+", "", value.strip().lower())
        if re.match(r"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$", val):
            return {
                "is_valid": True,
                "status": "valid",
                "message": "Valid email address format verified",
                "normalized": val,
                "modifier": 5.0,
            }
        return {
            "is_valid": False,
            "status": "invalid",
            "message": "Email format appears incomplete or missing @ / domain suffix",
            "normalized": val,
            "modifier": -25.0,
        }

    @staticmethod
    def validate_amount(value: str) -> Dict[str, Any]:
        clean = re.sub(r"[^\d.]", "", str(value).replace(",", ""))
        if not clean:
            return {
                "is_valid": False,
                "status": "invalid",
                "message": "Amount could not be parsed numerically",
                "normalized": str(value),
                "modifier": -25.0,
            }
        try:
            num = float(clean)
        except ValueError:
            return {
                "is_valid": False,
                "status": "invalid",
                "message": "Invalid numeric amount format",
                "normalized": str(value),
                "modifier": -25.0,
            }

        if num <= 0:
            return {
                "is_valid": False,
                "status": "invalid",
                "message": "Transaction/loan amount must be greater than zero",
                "normalized": str(value),
                "modifier": -30.0,
            }
        if num > 1000000000:
            return {
                "is_valid": False,
                "status": "warning",
                "message": "Unusually high amount requires mandatory supervisor read-back",
                "normalized": f"{int(num):,}" if num.is_integer() else f"{num:,.2f}",
                "modifier": -15.0,
            }
        formatted = f"{int(num):,}" if num.is_integer() else f"{num:,.2f}"
        return {
            "is_valid": True,
            "status": "valid",
            "message": f"Valid BFSI financial amount (INR {formatted})",
            "normalized": formatted,
            "modifier": 5.0,
        }

    @staticmethod
    def validate_address(value: str) -> Dict[str, Any]:
        raw = value.strip()
        val = devanagari_to_latin(raw).title() if re.search(r"[\u0900-\u097F]", raw) else raw
        if len(val) < 2:
            return {"is_valid": False, "status": "invalid", "message": "Address is too brief for policy dispatch or KYC verification", "normalized": val, "modifier": -25.0}

        pin_match = re.search(r"\b[1-9][0-9]{5}\b", val)
        has_pin = bool(pin_match)
        has_street = bool(re.search(r"\b(road|rd|street|st|nagar|colony|lane|flat|house|sector|block|marg|plot|apt)\b", val, re.IGNORECASE))

        if has_pin and has_street:
            return {
                "is_valid": True,
                "status": "valid",
                "message": f"Complete residential address verified with postal PIN {pin_match.group()}",
                "normalized": val,
                "modifier": 6.0,
            }
        elif has_pin:
            return {
                "is_valid": True,
                "status": "valid",
                "message": f"Residential location verified with postal PIN {pin_match.group()}",
                "normalized": val,
                "modifier": 4.0,
            }
        else:
            return {
                "is_valid": True,
                "status": "warning" if len(val.split()) < 2 else "valid",
                "message": "City/locality captured; postal PIN read-back recommended" if len(val.split()) < 2 else "Residential locality captured",
                "normalized": val,
                "modifier": -5.0 if len(val.split()) < 2 else 2.0,
            }

    @staticmethod
    def validate_account(value: str) -> Dict[str, Any]:
        digits = re.sub(r"\D", "", value)
        if not digits:
            return {"is_valid": False, "status": "invalid", "message": "Account number must contain numeric digits only", "normalized": value, "modifier": -30.0}

        if len(digits) < 9 or len(digits) > 18:
            return {
                "is_valid": False,
                "status": "invalid",
                "message": f"Account number length ({len(digits)}) out of BFSI core banking range (9-18 digits)",
                "normalized": digits,
                "modifier": -25.0,
            }

        return {
            "is_valid": True,
            "status": "valid",
            "message": f"Valid {len(digits)}-digit core banking account format",
            "normalized": digits,
            "modifier": 5.0,
        }

    @staticmethod
    def validate_dob(value: str) -> Dict[str, Any]:
        val = value.strip()
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
                "message": "Unrecognized date format. Please use DD/MM/YYYY",
                "normalized": val,
                "modifier": -25.0,
            }

        today = date.today()
        if parsed_date > today:
            return {
                "is_valid": False,
                "status": "invalid",
                "message": "Date of Birth cannot be in the future",
                "normalized": parsed_date.strftime("%d/%m/%Y"),
                "modifier": -30.0,
            }

        age = today.year - parsed_date.year - ((today.month, today.day) < (parsed_date.month, parsed_date.day))

        if age < 18:
            return {
                "is_valid": False,
                "status": "invalid",
                "message": f"Applicant age is {age} years. KYC requires applicant to be at least 18 years old",
                "normalized": parsed_date.strftime("%d/%m/%Y"),
                "modifier": -35.0,
            }

        if age > 110:
            return {
                "is_valid": False,
                "status": "warning",
                "message": f"Applicant age ({age} years) exceeds typical demographic threshold",
                "normalized": parsed_date.strftime("%d/%m/%Y"),
                "modifier": -15.0,
            }

        return {
            "is_valid": True,
            "status": "valid",
            "message": f"Verified applicant age: {age} years. Meets BFSI adult eligibility.",
            "normalized": parsed_date.strftime("%d/%m/%Y"),
            "modifier": 5.0,
        }

    @staticmethod
    def validate_id_doc(value: str) -> Dict[str, Any]:
        val = re.sub(r"[^A-Za-z0-9]", "", value).upper()

        pan_pattern = r"^[A-Z]{5}[0-9]{4}[A-Z]$"
        if re.match(pan_pattern, val):
            status_char = val[3]
            entity_type_desc = "Individual" if status_char == "P" else f"Entity type '{status_char}'"
            return {
                "is_valid": True,
                "status": "valid",
                "message": f"Valid Income Tax PAN ({entity_type_desc}) format",
                "normalized": val,
                "modifier": 5.0,
            }

        if len(val) == 12 and val.isdigit():
            return {
                "is_valid": True,
                "status": "valid",
                "message": "Valid 12-digit National UID / Aadhaar format",
                "normalized": val,
                "modifier": 5.0,
            }

        if re.match(r"^[A-Z][0-9]{7}$", val):
            return {
                "is_valid": True,
                "status": "valid",
                "message": "Valid Indian Passport format",
                "normalized": val,
                "modifier": 5.0,
            }

        return {
            "is_valid": False,
            "status": "invalid",
            "message": "ID document format does not match PAN (e.g. ABCDE1234F), Aadhaar, or Passport",
            "normalized": val,
            "modifier": -20.0,
        }

    @classmethod
    def validate_entity(cls, entity_type: str, value: str) -> Dict[str, Any]:
        type_clean = entity_type.lower()
        if type_clean in ("name", "fullname", "alpha"):
            return cls.validate_name(value)
        elif type_clean in ("phone", "mobile", "tel"):
            return cls.validate_phone(value)
        elif type_clean in ("email", "mail"):
            return cls.validate_email(value)
        elif type_clean in ("amount", "loan_amount", "currency"):
            return cls.validate_amount(value)
        elif type_clean in ("address", "residential_address"):
            return cls.validate_address(value)
        elif type_clean in ("account", "account_number", "acc"):
            return cls.validate_account(value)
        elif type_clean in ("dob", "date", "date_of_birth", "birthdate"):
            return cls.validate_dob(value)
        elif type_clean in ("id_doc", "pan", "national_id", "id", "alphanumeric"):
            return cls.validate_id_doc(value)
        else:
            return {"is_valid": True, "status": "valid", "message": "General entity passed validation", "normalized": value, "modifier": 0.0}


validation_engine = BFSIValidationEngine()
