import re
from typing import List, Dict, Any, Optional
from backend.services.phonetic_engine import phonetic_engine, devanagari_to_latin
from backend.services.confidence_scorer import confidence_scorer

WORD_TO_DIGIT = {
    'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
    'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
    'oh': '0', 'double': '2x', 'triple': '3x',
    'नाइन': '9', 'फाइव': '5', 'टू': '2', 'फोर': '4', 'एट': '8', 'ऐट': '8', 'एइट': '8',
    'सेवन': '7', 'सिक्स': '6', 'वन': '1', 'थ्री': '3', 'जीरो': '0',
    'शून्य': '0', 'एक': '1', 'दो': '2', 'तीन': '3', 'चार': '4',
    'पांच': '5', 'पाँच': '5', 'छह': '6', 'छः': '6', 'सात': '7', 'आठ': '8', 'नौ': '9',
    'ఎయిట్': '8', 'సెవెన్': '7', 'సిక్స్': '6', 'ఫోర్': '4',
    'నైన్': '9', 'ఫైవ్': '5', 'టూ': '2', 'త్రీ': '3', 'వన్': '1', 'జీరో': '0',
}

MONTH_MAP = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12',
    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'jun': '06',
    'jul': '07', 'aug': '08', 'sep': '09', 'sept': '09', 'oct': '10', 'nov': '11', 'dec': '12',
    'जनवरी': '01', 'फरवरी': '02', 'मार्च': '03', 'अप्रैल': '04',
    'मई': '05', 'जून': '06', 'जुलाई': '07', 'अगस्त': '08',
    'सितंबर': '09', 'अक्टूबर': '10', 'नवंबर': '11', 'दिसंबर': '12',
}

DEV_AMOUNT_WORDS = {
    'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5,
    'दस': 10, 'बीस': 20, 'पच्चीस': 25, 'तीस': 30, 'चालीस': 40,
    'पचास': 50, 'साठ': 60, 'सत्तर': 70, 'अस्सी': 80, 'नब्बे': 90, 'सौ': 100,
}

PURE_CONTROL_WORDS = {
    'haan', 'ha', 'han', 'yes', 'sahi', 'correct', 'bilkul', 'right', 'theek', 'thik', 'ok', 'okay',
    'nahi', 'nahin', 'no', 'galat', 'wrong', 'incorrect', 'badlo', 'change', 'cancel', 'nope',
    'hello', 'namaste', 'hi', 'hey', 'pranam', 'नमस्ते', 'नमस्कार', 'हाँ', 'हा', 'हां', 'सही',
    'बिलकुल', 'ठीक', 'नहीं', 'गलत', 'ना'
}


class AIEntityExtractor:
    @staticmethod
    def _is_pure_control_utterance(text: str) -> bool:
        tokens = re.findall(r'[A-Za-z\u0900-\u097F]+', text.lower())
        if not tokens:
            return False
        return all(t in PURE_CONTROL_WORDS for t in tokens)

    @staticmethod
    def normalize_spoken_digits(text: str) -> str:
        words = text.split()
        normalized_words = []
        i = 0
        while i < len(words):
            raw_w = words[i]
            w = re.sub(r'[,;\.!?।]+', '', raw_w).strip().lower()
            if w == 'double' and i + 1 < len(words):
                next_w = re.sub(r'[,;\.!?।]+', '', words[i + 1]).strip().lower()
                if next_w in WORD_TO_DIGIT:
                    normalized_words.append(WORD_TO_DIGIT[next_w] * 2)
                    i += 2
                    continue
            elif w == 'triple' and i + 1 < len(words):
                next_w = re.sub(r'[,;\.!?।]+', '', words[i + 1]).strip().lower()
                if next_w in WORD_TO_DIGIT:
                    normalized_words.append(WORD_TO_DIGIT[next_w] * 3)
                    i += 2
                    continue
            elif w in WORD_TO_DIGIT:
                normalized_words.append(WORD_TO_DIGIT[w])
            else:
                normalized_words.append(raw_w)
            i += 1
        return " ".join(normalized_words)

    @classmethod
    def extract_name(cls, text: str) -> Optional[str]:
        if cls._is_pure_control_utterance(text):
            return None

        # Explicit Hindi, Hinglish, and English patterns (captures single OR full names)
        patterns = [
            r"(?:मेरा\s+नाम|मेरा\s+नाम\s+है|नाम\s+है|नाम)\s+([A-Za-z\u0900-\u097F\s\.\-']{2,45})",
            r"(?:mera\s+naam|naam\s+hai|my\s+name\s+is|i\s+am|this\s+is|name\s+is|call\s+me)\s+([A-Za-z\u0900-\u097F\s\.\-']{2,45})",
            r"([A-Za-z\u0900-\u097F\s\.\-']{2,40})\s+(?:mera\s+naam\s+hai|naam\s+hai)",
            r"name\s*:\s*([A-Za-z\u0900-\u097F\s\.\-']{2,45})",
        ]
        for p in patterns:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                raw_name = match.group(1).strip()
                raw_name = re.split(
                    r'[,;\.\n।]|(?:\b(?:hai|hain|is|and|aur|my|mera|meri|phone|mobile|email|address|pata|amount|pan|dob|है|हैं|और|मेरा)\b)',
                    raw_name,
                    flags=re.IGNORECASE
                )[0].strip()
                if len(raw_name) >= 2 and not cls._is_pure_control_utterance(raw_name):
                    latin = devanagari_to_latin(raw_name)
                    return latin.title()

        # Direct utterance of full name (e.g. "Soham Sharma" or "Soham Shekhpurwar, I live in...")
        opening_clause = re.split(
            r'[,;\.\n।]|(?:\b(?:live\s+in|rehta|mobile|phone|address|pata|email|amount|pan|number|आई\s*लीव)\b|\b\d{2,}\b)',
            text,
            flags=re.IGNORECASE
        )[0].strip()

        words = opening_clause.split()
        invalid_starters = PURE_CONTROL_WORDS | {
            'episode', 'podcast', 'kripya', 'shukriya', 'live', 'leave',
            'mera', 'meri', 'mere', 'mai', 'main', 'my', 'the', 'a', 'an',
            'कृपया', 'शुक्रिया', 'सुनो', 'कैसे', 'मेरा', 'मेरी', 'मैं'
        }
        if 1 <= len(words) <= 4:
            first_word_clean = words[0].strip(' ,.;:!?|\'"।').lower()
            if first_word_clean not in invalid_starters:
                is_valid_name = all(re.match(r"^[A-Za-z\u0900-\u097F\.\'-]+$", w) for w in words)
                # Single word allowed only if short/standalone utterance without verbs
                if is_valid_name and len(opening_clause) >= 2 and (len(words) >= 2 or len(text.split()) <= 2):
                    latin = devanagari_to_latin(opening_clause)
                    return latin.title()
        return None

    @classmethod
    def extract_phone(cls, text: str) -> Optional[str]:
        norm = cls.normalize_spoken_digits(text)
        # Merge digit segments separated by spaces, hyphens, or Hindi danda '।'
        # First check contiguous digit clusters near mobile keywords or overall
        compact = re.sub(r'[\s\-\.\u0964]', '', norm)
        match = re.search(r'(?:\+?91)?([6-9]\d{9})\b', compact)
        if match:
            return match.group(1)

        # Fallback: extract digit groups across sentence if phone/mobile mentioned
        if re.search(r'(?:phone|mobile|mob|contact|call|नंबर|मोबाइल|फोन)', norm, re.IGNORECASE):
            after_kw = re.split(r'(?:phone|mobile|mob|contact|call|नंबर|मोबाइल|फोन)', norm, flags=re.IGNORECASE)[-1]
            digits_only = re.findall(r'\d', after_kw)
            if len(digits_only) >= 10:
                candidate = "".join(digits_only[:10])
                if candidate[0] in '6789':
                    return candidate

        digits = re.findall(r'\b\d\b', norm)
        if len(digits) >= 10:
            joined = "".join(digits[:10])
            if joined[0] in '6789':
                return joined
        return None

    @classmethod
    def extract_email(cls, text: str) -> Optional[str]:
        # 1. Direct email literal
        direct = re.search(r'\b([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})\b', text)
        if direct:
            return direct.group(1).lower()

        # 2. Spoken email normalization: "email is s o h a m at example dot com" or "soh am at gmail dot com"
        lower = text.lower()
        email_clause_match = re.search(
            r'(?:email(?:\s+address|\s+id)?|mail(?:\s+id)?|ईमेल)\s*(?:is|hai|:)?\s*([a-z0-9\s._\-\u0900-\u097F]+?(?:\s+at\s+|\s*@\s*)[a-z0-9\s._\-]+?(?:\s+dot\s+|\.)[a-z]{2,}(?:\s+dot\s+[a-z]{2,})?)',
            lower,
            re.IGNORECASE
        )
        candidate = email_clause_match.group(1) if email_clause_match else None

        if not candidate and re.search(r'\s+at\s+[a-z0-9\s\-]+\s+dot\s+[a-z]{2,}', lower):
            m = re.search(r'([a-z0-9\s._\-]{2,40}\s+at\s+[a-z0-9\s\-]+\s+dot\s+[a-z]{2,}(?:\s+dot\s+[a-z]{2,})?)', lower)
            if m:
                candidate = m.group(1)

        if candidate:
            # Strip filler prefixes in case unanchored
            candidate = re.split(r'\b(?:my|is|hai|mera|and|aur|,|\.|है)\b', candidate)[-1] if 'at' in candidate and len(candidate.split(' at ')[0].split()) > 6 else candidate
            parts = re.split(r'\s+at\s+|\s*@\s*', candidate.strip(), maxsplit=1)
            if len(parts) == 2:
                local_raw, domain_raw = parts[0], parts[1]
                # Stop domain at sentence trailing words like ", my loan"
                domain_raw = re.split(r'[,;\n।]|\b(?:my|and|aur|hai|loan|amount|phone|address|is|है|और)\b', domain_raw)[0]
                local_clean = local_raw.replace(' dot ', '.').replace(' underscore ', '_').replace(' dash ', '-').replace(' hyphen ', '-')
                local_clean = re.sub(r'[^a-z0-9._+\-]', '', local_clean)
                domain_clean = domain_raw.replace(' dot ', '.').replace(' dash ', '-')
                domain_clean = re.sub(r'[^a-z0-9.\-]', '', domain_clean)
                # Trim trailing words if local_raw captured prefix like "soham" vs single spaced letters
                combined = f"{local_clean}@{domain_clean}"
                if re.match(r'^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$', combined):
                    return combined
        return None

    @classmethod
    def extract_amount(cls, text: str) -> Optional[str]:
        lower = text.lower()

        # Check explicit Hindi multiplier words if present (e.g. पचास हजार रुपये)
        hindi_amt = re.search(r'([A-Za-z\u0900-\u097F]+|\d+(?:\.\d+)?)\s*(हजार|हज़ार|लाख|करोड़|thousand|k|lakh|lakhs|lac|crore|crores|cr)\b', lower, re.IGNORECASE)
        has_currency_context = bool(re.search(r'(?:₹|\brs\.?|\binr\b|\brupees?\b|\bamount\b|\bloan\b|\bemi\b|\bरुपये\b|\bरुपए\b|\bराशि\b|\bलोन\b)', lower, re.IGNORECASE))

        if hindi_amt:
            num_token = hindi_amt.group(1).strip()
            mult_token = hindi_amt.group(2).lower()
            base_num = None
            if re.match(r'^\d+(?:\.\d+)?$', num_token.replace(',', '')):
                base_num = float(num_token.replace(',', ''))
            elif num_token in DEV_AMOUNT_WORDS:
                base_num = float(DEV_AMOUNT_WORDS[num_token])
            elif num_token == 'fifty':
                base_num = 50.0
            elif num_token == 'ten':
                base_num = 10.0

            if base_num is not None:
                mult_map = {
                    'हजार': 1000, 'हज़ार': 1000, 'thousand': 1000, 'k': 1000,
                    'लाख': 100000, 'lakh': 100000, 'lakhs': 100000, 'lac': 100000,
                    'करोड़': 10000000, 'crore': 10000000, 'crores': 10000000, 'cr': 10000000,
                }
                total = int(base_num * mult_map.get(mult_token, 1))
                return f"{total:,}"

        # Direct currency patterns: "50,000 rupees", "₹25000", "Rs. 50000", "amount is 50000"
        curr_patterns = [
            r'(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)',
            r'([\d,]+(?:\.\d{1,2})?)\s*(?:rupees?|bucks|रुपये|रुपए)',
            r'(?:amount|loan(?:\s+amount)?|emi|payment|राशि)\s*(?:is|of|hai|:)?\s*(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)',
        ]
        for p in curr_patterns:
            m = re.search(p, text, re.IGNORECASE)
            if m:
                raw_num = m.group(1).replace(',', '').strip()
                try:
                    val = float(raw_num)
                    if val > 0:
                        return f"{int(val):,}" if val.is_integer() else f"{val:,.2f}"
                except ValueError:
                    pass

        if has_currency_context:
            standalone = re.search(r'\b([\d,]{3,9})\b', text)
            if standalone:
                raw_num = standalone.group(1).replace(',', '')
                if not re.match(r'^[6-9]\d{9}$', raw_num):
                    return f"{int(raw_num):,}"
        return None

    @classmethod
    def extract_account(cls, text: str) -> Optional[str]:
        norm = cls.normalize_spoken_digits(text)
        # Require account trigger OR strictly 11-18 digits NOT matching 10-digit phone or currency amount
        match = re.search(r'(?:account|acc(?:ount)?\s*(?:no|number)?|acct|खाता)\s*(?:is|number\s*is|hai|:)?\s*(\d[\d\s\-]{8,20}\d)', norm, re.IGNORECASE)
        if match:
            digits = re.sub(r'\D', '', match.group(1))
            if 9 <= len(digits) <= 18:
                return digits

        compact = re.sub(r'[\s\-।]', '', norm)
        all_numbers = re.findall(r'\b\d{11,18}\b', compact)
        if all_numbers:
            return all_numbers[0]
        return None

    @classmethod
    def extract_address(cls, text: str) -> Optional[str]:
        patterns = [
            r'(?:मैं|मै)\s+([A-Za-z\u0900-\u097F0-9\s,\-\/]{2,60}?)\s+(?:में\s+(?:रहता|रहती|रहते))',
            r'(?:आई\s*लीव\s*इन|आई\s*लिव\s*इन|आय\s*लिव\s*इन|आई\s*एम\s*फ्रॉम|रहता\s*हूँ|रहती\s*हूँ|रहते\s*हैं|रहता\s*हु|मेरा\s*पता|ghar\s*ka\s*pata|residential\s+address|address|pata|live\s+in|residing\s+at)\s+(?:is|hai|mein|:)?\s*([^;\.\n।]{2,80})',
            r'\b(\d+[\w\s,]+(?:road|rd|street|st|nagar|colony|marg|lane|block|sector)[\w\s,]+(?:pincode|pin|\b\d{6}\b|\b[A-Za-z]+))'
        ]
        for p in patterns:
            match = re.search(p, text, re.IGNORECASE)
            if match:
                addr = match.group(1).strip()
                addr = re.split(
                    r'[;\.\n।]|(?:\b(?:नाइन|फोन|mobile|phone|contact|email|amount|pan|dob|है|और)\b)',
                    addr,
                    flags=re.IGNORECASE
                )[0].strip(' ,')
                if len(addr) >= 2 and not cls._is_pure_control_utterance(addr):
                    return devanagari_to_latin(addr).title() if re.search(r'[\u0900-\u097F]', addr) else addr
        return None

    @classmethod
    def extract_dob(cls, text: str) -> Optional[str]:
        num_match = re.search(r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b', text)
        if num_match:
            raw = num_match.group(1).replace('-', '/')
            parts = raw.split('/')
            day, month, year = parts[0].zfill(2), parts[1].zfill(2), parts[2]
            if len(year) == 2:
                year = f"20{year}" if int(year) <= 26 else f"19{year}"
            return f"{day}/{month}/{year}"

        spoken_pattern = r'\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([A-Za-z\u0900-\u097F]+)[,\s]+(\d{4})\b'
        match = re.search(spoken_pattern, text, re.IGNORECASE)
        if match:
            day = match.group(1).zfill(2)
            month_str = match.group(2).lower()
            year = match.group(3)
            if month_str in MONTH_MAP:
                return f"{day}/{MONTH_MAP[month_str]}/{year}"

        alt_pattern = r'\b([A-Za-z\u0900-\u097F]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})\b'
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
        # Remove spaces, hyphens, Hindi danda '।' to catch split PAN like "ABCD E1234F"
        clean = re.sub(r'[\s\-\u0964]', '', text).upper()
        pan_match = re.search(r'([A-Z]{5}[0-9]{4}[A-Z])', clean)
        if pan_match:
            return pan_match.group(1)

        trigger_match = re.search(
            r'(?:pan(?:\s*card)?|पैन(?:\s*कार्ड)?|national\s*id|passport)\s*(?:number|no|is|hai|:)?\s*([A-Za-z0-9\s]{8,14})',
            text,
            re.IGNORECASE
        )
        if trigger_match:
            val = re.sub(r'[\s\-\u0964]', '', trigger_match.group(1)).upper()
            if re.match(r'^[A-Z0-9]{8,12}$', val):
                return val
        return None

    @classmethod
    def _build_entity_dict(cls, eid: str, label: str, ent_type: str, val: str, acoustic_confidence: float, status: str = "pending", is_repeat: bool = False, corr_attempt: int = 0) -> Dict[str, Any]:
        score = confidence_scorer.calculate_score(
            eid, val, acoustic_confidence, is_repeat_attempt=is_repeat, correction_attempt=corr_attempt
        )
        # Never mark unconfirmed data as verified automatically!
        final_status = status
        if score.get("needs_mandatory_readback") and status == "pending":
            final_status = "flagged"

        return {
            "id": eid,
            "label": label,
            "value": score["normalized_value"],
            "type": ent_type,
            "confidence": score["confidence"],
            "status": final_status,
            "validationStatus": score["validation_status"],
            "validationMessage": score["validation_message"],
            "isUncertain": score["is_uncertain"],
            "needsConfirmation": True,
            "phoneticSummary": phonetic_engine.format_phonetic_summary(score["normalized_value"], ent_type),
            "phoneticDetails": phonetic_engine.get_phonetic_spelling(score["normalized_value"]),
            "history": [score["normalized_value"]],
        }

    @classmethod
    def extract_all_entities(cls, text: str, acoustic_confidence: float = 90.0, target_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if not text or not text.strip():
            return []
        if cls._is_pure_control_utterance(text):
            return []

        ent_meta = {
            "name": ("alpha", "Full Name", cls.extract_name),
            "phone": ("numeric", "Phone Number", cls.extract_phone),
            "email": ("email", "Email Address", cls.extract_email),
            "address": ("address", "Residential Address", cls.extract_address),
            "amount": ("amount", "Amount (INR)", cls.extract_amount),
            "dob": ("date", "Date of Birth", cls.extract_dob),
            "account": ("numeric", "Account Number", cls.extract_account),
            "id_doc": ("alphanumeric", "National ID / PAN", cls.extract_id_doc),
        }

        extracted = []

        # Focused target extraction (e.g. during correction OR direct answer to a specific question)
        if target_id and target_id in ent_meta:
            ent_type, label, extractor_fn = ent_meta[target_id]
            val = extractor_fn(text)
            if not val:
                # Strip conversational correction/filler prefixes if directly replying to targeted prompt
                cleaned = re.sub(
                    r'^(?:nahi|nahin|no|galat\s+hai|wrong|actually|it\s+is|mera|meri|correct\s+(?:value|is)?|नहीं|गलत)\b[\s,:\-]*',
                    '',
                    text.strip(),
                    flags=re.IGNORECASE
                ).strip(' .।,')
                if cleaned and not cls._is_pure_control_utterance(cleaned):
                    val = devanagari_to_latin(cleaned).title() if target_id in ("name", "address") and re.search(r'[\u0900-\u097F]', cleaned) else cleaned

            if val:
                extracted.append(cls._build_entity_dict(target_id, label, ent_type, val, acoustic_confidence, status="pending"))
                return extracted

        # Broad multi-entity extraction across full transcript
        for eid, (ent_type, label, extractor_fn) in ent_meta.items():
            val = extractor_fn(text)
            if val:
                # Avoid colliding account with extracted phone
                if eid == "account" and any(e["id"] == "phone" and e["value"] == val for e in extracted):
                    continue
                extracted.append(cls._build_entity_dict(eid, label, ent_type, val, acoustic_confidence, status="pending"))

        return extracted


entity_extractor = AIEntityExtractor()
