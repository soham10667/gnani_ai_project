from typing import Dict, Any
from backend.config import settings
from backend.services.validation_engine import validation_engine

class ConfidenceScorer:
    @staticmethod
    def calculate_score(
        entity_type: str,
        value: str,
        acoustic_confidence: float = 90.0,
        is_repeat_attempt: bool = False,
        correction_attempt: int = 0
    ) -> Dict[str, Any]:
        """
        Combines acoustic confidence from STT with BFSI rule validation.
        """
        validation_res = validation_engine.validate_entity(entity_type, value)
        
        # Base confidence from acoustic signal
        base_score = float(acoustic_confidence) if acoustic_confidence else 85.0
        
        # Apply validation modifier
        modifier = validation_res.get("modifier", 0.0)
        
        # Boost confidence if it was confirmed or corrected through human-in-the-loop
        if is_repeat_attempt:
            modifier += 8.0
        if correction_attempt > 0:
            modifier += 5.0
            
        calculated_conf = min(100.0, max(15.0, base_score + modifier))
        calculated_conf = round(calculated_conf, 1)
        
        # Determine classification
        if calculated_conf >= settings.THRESHOLD_HIGH:
            level = "High Confidence"
            tier = "high"
        elif calculated_conf >= settings.THRESHOLD_MEDIUM:
            level = "Medium Confidence"
            tier = "medium"
        else:
            level = "Low - Action Required"
            tier = "low"
            
        needs_mandatory_readback = calculated_conf < settings.THRESHOLD_MANDATORY_READBACK
        auto_reject = calculated_conf < settings.THRESHOLD_AUTO_REJECT
        
        return {
            "confidence": calculated_conf,
            "tier": tier,
            "level": level,
            "validation_status": validation_res.get("status", "valid"),
            "validation_message": validation_res.get("message", ""),
            "normalized_value": validation_res.get("normalized", value),
            "needs_mandatory_readback": needs_mandatory_readback,
            "auto_reject": auto_reject
        }

confidence_scorer = ConfidenceScorer()

