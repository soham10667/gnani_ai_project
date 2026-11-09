import re
from datetime import datetime, date
from typing import Dict, Any, Tuple

class BFSIValidationEngine:
    @staticmethod
    def validate_name(value: str) -> Dict[str, Any]:
        val = value.strip()
        if not val:
            return {"is_valid": False, "status": "invalid", "message": "Name cannot be empty", "normalized": "", "modifier": -30.0}
        
        # Check allowed characters (letters, spaces, dots, hyphens)
        if not re.match(r"^[A-Za-z\s\.\-']+$", val):
            return {"is_valid": False, "status": "invalid", "message": "Name contains invalid non-alphabetic characters", "normalized": val, "modifier": -25.0}
        
        parts = val.split()
        if len(parts) < 2:
            return {"is_valid": True, "status": "warning", "message": "Only single name detected. BFSI KYC recommends full name with surname.", "normalized": val.title(), "modifier": -10.0}
            
        if len(val) < 3:
            return {"is_valid": False, "status": "invalid", "message": "Name is too short for verification", "normalized": val, "modifier": -25.0}
            
        return {"is_valid": True, "status": "valid", "message": "Valid full name according to BFSI KYC guidelines", "normalized": val.title(), "modifier": 5.0}

    @staticmethod
    def validate_phone(value: str) -> Dict[str, Any]:
        # Strip spaces, hyphens, country code prefix (+91 or 91)
        digits = re.sub(r'\D', '', value)
        if digits.startswith('91') and len(digits) == 12:
            digits = digits[2:]
        elif digits.startswith('0') and len(digits) == 11:
            digits = digits[1:]
            
        if len(digits) != 10:
            return {
                "is_valid": False,
                "status": "invalid",
                "message": f"Expected 10-digit mobile number, received {len(digits)} digits",
                "normalized": digits or value,
                "modifier": -30.0
            }
            
        # Indian mobile numbers start with 6, 7, 8, or 9
        if digits[0] not in ('6', '7', '8', '9'):
            return {
                "is_valid": False,
                "status": "warning",
                "message": "Indian mobile numbers must start with digits 6, 7, 8, or 9",
                "normalized": digits,
                "modifier": -20.0
            }
            
        # Check repeated digit patterns (e.g. 9999999999 or 0000000000)
        if len(set(digits)) <= 2:
            return {
                "is_valid": False,
                "status": "warning",
                "message": "Suspicious dummy or test phone number pattern detected",
                "normalized": digits,
                "modifier": -25.0
            }
            
        return {
            "is_valid": True,
            "status": "valid",
            "message": "Valid 10-digit Indian mobile number",
            "normalized": digits,
            "modifier": 5.0
        }

    @staticmethod
    def validate_address(value: str) -> Dict[str, Any]:
        val = value.strip()
        if len(val) < 10:
            return {"is_valid": False, "status": "invalid", "message": "Address is too brief for policy dispatch or KYC verification", "normalized": val, "modifier": -25.0}
            
        # Check 6-digit Indian PIN code
        pin_match = re.search(r'\b[1-9][0-9]{5}\b', val)
        has_pin = bool(pin_match)
        
        # Check city or street indicators
        has_street = bool(re.search(r'\b(road|rd|street|st|nagar|colony|lane|flat|house|sector|block|marg)\b', val, re.IGNORECASE))
        
        if not has_pin:
            return {
                "is_valid": True,
                "status": "warning",
                "message": "Missing standard 6-digit postal PIN code",
                "normalized": val,
                "modifier": -15.0
            }
            
        if not has_street:
            return {
                "is_valid": True,
                "status": "warning",
                "message": "Address lacks specific street or premise identifier",
                "normalized": val,
                "modifier": -10.0
            }
            
        return {
            "is_valid": True,
            "status": "valid",
            "message": f"Complete residential address verified with postal PIN {pin_match.group()}",
            "normalized": val,
            "modifier": 6.0
        }

    @staticmethod
    def validate_account(value: str) -> Dict[str, Any]:
        digits = re.sub(r'\D', '', value)
        if not digits:
            return {"is_valid": False, "status": "invalid", "message": "Account number must contain numeric digits only", "normalized": value, "modifier": -30.0}
            
        # Indian bank accounts typically 9 to 18 digits (SBI is 11, HDFC/ICICI is 12-14)
        if len(digits) < 9 or len(digits) > 18:
            return {
                "is_valid": False,
                "status": "invalid",
                "message": f"Account number length ({len(digits)}) out of BFSI core banking range (9-18 digits)",
                "normalized": digits,
                "modifier": -25.0
            }
            
        return {
            "is_valid": True,
            "status": "valid",
            "message": f"Valid {len(digits)}-digit core banking account format",
            "normalized": digits,
            "modifier": 5.0
        }

    @staticmethod
    def validate_dob(value: str) -> Dict[str, Any]:
        val = value.strip()
        # Try multiple date formats: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
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
                "modifier": -25.0
            }
            
        today = date.today()
        if parsed_date > today:
            return {
                "is_valid": False,
                "status": "invalid",
                "message": "Date of Birth cannot be in the future",
                "normalized": parsed_date.strftime("%d/%m/%Y"),
                "modifier": -30.0
            }
            
        age = today.year - parsed_date.year - ((today.month, today.day) < (parsed_date.month, parsed_date.day))
        
        if age < 18:
            return {
                "is_valid": False,
                "status": "invalid",
                "message": f"Applicant age is {age} years. KYC requires applicant to be at least 18 years old",
                "normalized": parsed_date.strftime("%d/%m/%Y"),
                "modifier": -35.0
            }
            
        if age > 110:
            return {
                "is_valid": False,
                "status": "warning",
                "message": f"Applicant age ({age} years) exceeds typical demographic threshold",
                "normalized": parsed_date.strftime("%d/%m/%Y"),
                "modifier": -15.0
            }
            
        return {
            "is_valid": True,
            "status": "valid",
            "message": f"Verified applicant age: {age} years. Meets BFSI adult eligibility.",
            "normalized": parsed_date.strftime("%d/%m/%Y"),
            "modifier": 5.0
        }

    @staticmethod
    def validate_id_doc(value: str) -> Dict[str, Any]:
        val = re.sub(r'[^A-Za-z0-9]', '', value).upper()
        
        # Check Indian Income Tax PAN (Format: 5 letters, 4 digits, 1 letter)
        pan_pattern = r'^[A-Z]{5}[0-9]{4}[A-Z]$'
        if re.match(pan_pattern, val):
            # 4th character indicates entity type: P = Person/Individual, C = Company, H = HUF
            status_char = val[3]
            entity_type_desc = "Individual" if status_char == 'P' else f"Entity type '{status_char}'"
            return {
                "is_valid": True,
                "status": "valid",
                "message": f"Valid Income Tax PAN ({entity_type_desc}) format",
                "normalized": val,
                "modifier": 5.0
            }
            
        # Check Indian Aadhaar (12 digits)
        if len(val) == 12 and val.isdigit():
            return {
                "is_valid": True,
                "status": "valid",
                "message": "Valid 12-digit National UID / Aadhaar format",
                "normalized": val,
                "modifier": 5.0
            }
            
        # Check Passport (1 letter + 7 digits)
        if re.match(r'^[A-Z][0-9]{7}$', val):
            return {
                "is_valid": True,
                "status": "valid",
                "message": "Valid Indian Passport format",
                "normalized": val,
                "modifier": 5.0
            }
            
        return {
            "is_valid": False,
            "status": "invalid",
            "message": "ID document format does not match PAN (e.g. ABCDE1234F), Aadhaar, or Passport",
            "normalized": val,
            "modifier": -20.0
        }

    @classmethod
    def validate_entity(cls, entity_type: str, value: str) -> Dict[str, Any]:
        type_clean = entity_type.lower()
        if type_clean in ("name", "fullname", "alpha"):
            return cls.validate_name(value)
        elif type_clean in ("phone", "mobile", "tel"):
            return cls.validate_phone(value)
        elif type_clean in ("address", "residential_address"):
            return cls.validate_address(value)
        elif type_clean in ("account", "account_number", "acc"):
            return cls.validate_account(value)
        elif type_clean in ("dob", "date_of_birth", "birthdate"):
            return cls.validate_dob(value)
        elif type_clean in ("id_doc", "pan", "national_id", "id", "alphanumeric"):
            return cls.validate_id_doc(value)
        else:
            return {"is_valid": True, "status": "valid", "message": "General entity passed validation", "normalized": value, "modifier": 0.0}

validation_engine = BFSIValidationEngine()

