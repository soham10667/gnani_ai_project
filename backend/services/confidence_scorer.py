import re
from typing import Dict, Any, List
from backend.config import settings
from backend.services.validation_engine import validation_engine
from backend.services.correction_learner import correction_learner


VOWEL_HIATUS_PATTERNS = re.compile(r"(aa|au|oa|ai|ia|ea|ui|eu|ou)", re.IGNORECASE)
AMBIGUOUS_ASR_CHARS = {"M", "N", "B", "D", "P", "V", "W", "C", "S", "F", "T", "0", "O", "5", "9"}


class ConfidenceScorer:
    @staticmethod
    def compute_char_confidences(
        entity_type: str,
        value: str,
        stt_confidence: float,
        validation_res: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        val = str(value or "")
        if not val:
            return []

        base = max(15.0, min(99.5, float(stt_confidence or 85.0)))
        invalid_set = set(validation_res.get("invalid_indices") or [])
        etype = (entity_type or "").lower()

        # Detect middle vowel hiatus spans in names (e.g. "Raul" missing H between a and u -> index 1, 2)
        hiatus_indices = set()
        if etype in ("name", "alpha", "address"):
            for m in VOWEL_HIATUS_PATTERNS.finditer(val):
                # Exempt legitimate common English/Indian diphthongs at start unless stt < 96
                span_start, span_end = m.start(), m.end()
                hiatus_indices.update(range(span_start, span_end))

        chars_out: List[Dict[str, Any]] = []
        n = len(val)
        for i, ch in enumerate(val):
            upper = ch.upper()
            char_conf = base
            reasons: List[str] = []
            partners = correction_learner.get_partners_for_char(upper)

            if i in invalid_set:
                char_conf = min(char_conf, 25.0)
                reasons.append(validation_res.get("message") or "Invalid format position")
            elif ch.isspace():
                char_conf = max(char_conf, 95.0)
            else:
                if i in hiatus_indices and 0 < i < max(1, n - 1):
                    char_conf = min(char_conf, 64.0)
                    reasons.append("Middle vowel cluster — possible dropped letter (e.g. H)")

                if upper in AMBIGUOUS_ASR_CHARS and (base < 92.0 or etype in ("pan", "id_doc", "email")):
                    # Alphanumeric IDs & uncertain audio have intrinsic consonant ambiguity (M/N, B/D, etc.)
                    penalty = 18.0 if base < 88.0 else 11.0
                    char_conf = min(char_conf, max(45.0, base - penalty))
                    if partners:
                        reasons.append(f"Often confused with {'/'.join(partners[:2])}")

                if upper in correction_learner.learned_partners and base < 96.0:
                    char_conf = min(char_conf, max(50.0, base - 16.0))
                    learned_str = "/".join(sorted(correction_learner.learned_partners[upper])[:2])
                    if f"Often confused with {learned_str}" not in reasons:
                        reasons.append(f"Correction history risk ({upper}<->{learned_str})")

            low_conf = char_conf < 78.0 or (i in invalid_set)
            chars_out.append({
                "index": i,
                "char": ch,
                "confidence": round(char_conf, 1),
                "conf": round(char_conf, 1),
                "low_confidence": low_conf,
                "low_conf": low_conf,
                "invalid_rule": (i in invalid_set),
                "confused_with": partners[:2] if low_conf else [],
                "reason": "; ".join(reasons) if reasons else "",
            })

        return chars_out

    @staticmethod
    def calculate_score(
        entity_type: str,
        value: str,
        acoustic_confidence: float = 90.0,
        is_repeat_attempt: bool = False,
        correction_attempt: int = 0,
        phonetic_scheme: str = "indian",
    ) -> Dict[str, Any]:
        """
        Computes SEPARATE STT confidence and rule-based Validator confidence + character-level flags.
        Never hides a failed validation behind high acoustic STT confidence.
        """
        validation_res = validation_engine.validate_entity(entity_type, value)
        norm_val = validation_res.get("normalized", value)
        stt_conf = round(min(99.5, max(15.0, float(acoustic_confidence if acoustic_confidence is not None else 85.0))), 1)
        val_conf = round(float(validation_res.get("validator_confidence", 90.0 if validation_res.get("is_valid") else 25.0)), 1)

        if is_repeat_attempt and validation_res.get("is_valid"):
            stt_conf = round(min(99.5, stt_conf + 4.0), 1)
        if correction_attempt > 0 and validation_res.get("is_valid"):
            stt_conf = round(min(99.5, max(stt_conf, 94.0)), 1)

        char_confs = ConfidenceScorer.compute_char_confidences(entity_type, norm_val, stt_conf, validation_res)
        low_conf_indices = [c["index"] for c in char_confs if c["low_confidence"]]

        # If middle/ambiguous characters triggered low char confidence on a short name like "Raul",
        # reflect uncertainty cleanly without merging validator & STT scores.
        val_status = validation_res.get("status", "valid")
        is_valid = bool(validation_res.get("is_valid", True))

        if not is_valid:
            tier = "low"
            level = f"Validation Failed ({validation_res.get('message', 'Invalid')})"
        elif stt_conf >= settings.THRESHOLD_HIGH and val_conf >= 90.0 and not low_conf_indices:
            tier = "high"
            level = "High Confidence"
        elif stt_conf >= settings.THRESHOLD_MEDIUM and val_conf >= 70.0:
            tier = "medium"
            level = "Needs Read-Back"
        else:
            tier = "low"
            level = "Low STT Confidence — Spell Check Recommended"

        needs_mandatory_readback = (not is_valid) or (stt_conf < settings.THRESHOLD_AUTO_PASS) or bool(low_conf_indices) or (val_status != "valid")
        is_uncertain = (not is_valid) or (stt_conf < settings.THRESHOLD_AUTO_PASS) or bool(low_conf_indices) or (val_status != "valid")

        # Keep legacy compatibility metric honest: NEVER inflate failed validation above val_conf!
        legacy_effective = val_conf if not is_valid else min(stt_conf, val_conf)

        return {
            "confidence": round(legacy_effective, 1),
            "stt_confidence": stt_conf,
            "validator_confidence": val_conf,
            "validation_passed": is_valid,
            "failed_rule": validation_res.get("failed_rule"),
            "invalid_indices": validation_res.get("invalid_indices", []),
            "char_confidences": char_confs,
            "low_conf_indices": low_conf_indices,
            "tier": tier,
            "level": level,
            "validation_status": val_status,
            "validation_message": validation_res.get("message", ""),
            "normalized_value": norm_val,
            "needs_mandatory_readback": needs_mandatory_readback,
            "is_uncertain": is_uncertain,
            "auto_reject": not is_valid or stt_conf < settings.THRESHOLD_AUTO_REJECT,
        }


confidence_scorer = ConfidenceScorer()
