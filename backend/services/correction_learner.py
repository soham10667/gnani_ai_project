import difflib
from typing import Dict, Any, List, Set, Tuple
from collections import Counter
from backend.database import db


BASELINE_CONFUSION_PARTNERS: Dict[str, List[str]] = {
    "M": ["N"], "N": ["M"],
    "B": ["D", "P", "V"], "D": ["B", "T"], "P": ["B"],
    "V": ["W", "B"], "W": ["V"],
    "C": ["S", "Z", "K"], "S": ["C", "F", "Z"], "F": ["S"],
    "K": ["G", "Q", "C"], "G": ["K", "J"],
    "T": ["D"], "Z": ["S", "J"],
    "A": ["E"], "E": ["I", "A"], "I": ["E"], "U": ["O"], "O": ["0", "Q", "U"],
    "0": ["O", "8"], "5": ["9"], "9": ["5"], "6": ["8"], "8": ["6", "0"],
    "2": ["Z"], "1": ["7", "I"], "7": ["1"],
}


class CorrectionLearningModel:
    def __init__(self, min_training_samples: int = 4):
        self.min_samples = min_training_samples
        self.confusion_matrix: Counter = Counter()
        self.char_pair_counts: Counter = Counter()
        self.learned_partners: Dict[str, Set[str]] = {}
        self.entity_error_rates: Counter = Counter()
        self.total_corrections = 0
        self.is_trained = False
        self.accuracy_boost_metric = 0.0

    def fit_from_logs(self) -> Dict[str, Any]:
        """
        Learns common phonetic acoustic substitutions, insertions (e.g. dropped H),
        and deletions from persisted database correction_logs.
        """
        logs = db.get_correction_logs(limit=500)
        self.total_corrections = len(logs)

        self.confusion_matrix.clear()
        self.char_pair_counts.clear()
        self.learned_partners.clear()
        self.entity_error_rates.clear()

        if self.total_corrections < self.min_samples:
            self.is_trained = False
            return {
                "status": "accumulating_data",
                "message": (
                    f"Collected {self.total_corrections}/{self.min_samples} correction samples. "
                    f"Minimum {self.min_samples} samples required to activate trained model."
                ),
                "samples_count": self.total_corrections,
                "is_trained": False,
                "learned_confusions": [],
                "top_acoustic_confusions": [],
            }

        total_orig_conf = 0.0
        total_corr_conf = 0.0

        for log in logs:
            orig = str(log.get("original_value", ""))
            corr = str(log.get("corrected_value", ""))
            ent_type = log.get("entity_type", "general")
            self.entity_error_rates[ent_type] += 1

            total_orig_conf += float(log.get("original_conf", 70.0))
            total_corr_conf += float(log.get("corrected_conf", 95.0))

            matcher = difflib.SequenceMatcher(None, orig.upper(), corr.upper())
            for tag, i1, i2, j1, j2 in matcher.get_opcodes():
                if tag == "replace":
                    src = orig[i1:i2]
                    dst = corr[j1:j2]
                    sub_key = f"{src} -> {dst}"
                    self.confusion_matrix[sub_key] += 1
                    if len(src) == 1 and len(dst) == 1:
                        self.char_pair_counts[(src.upper(), dst.upper())] += 1
                        self.learned_partners.setdefault(src.upper(), set()).add(dst.upper())
                        self.learned_partners.setdefault(dst.upper(), set()).add(src.upper())
                elif tag == "insert":
                    added = corr[j1:j2]
                    self.confusion_matrix[f"_ -> {added} (dropped)"] += 1
                elif tag == "delete":
                    removed = orig[i1:i2]
                    self.confusion_matrix[f"{removed} -> _ (extra)"] += 1

        self.is_trained = True
        avg_initial = total_orig_conf / max(1, self.total_corrections)
        avg_final = total_corr_conf / max(1, self.total_corrections)
        self.accuracy_boost_metric = round(avg_final - avg_initial, 1)

        return {
            "status": "trained",
            "message": f"Correction model fitted on {self.total_corrections} verified customer corrections.",
            "samples_count": self.total_corrections,
            "is_trained": True,
            "avg_accuracy_boost": f"+{self.accuracy_boost_metric}%",
            "top_acoustic_confusions": [
                {"substitution": k, "frequency": v}
                for k, v in self.confusion_matrix.most_common(6)
            ],
            "error_distribution_by_entity": dict(self.entity_error_rates),
        }

    def get_partners_for_char(self, ch: str) -> List[str]:
        up = (ch or "").upper()
        learned = list(self.learned_partners.get(up, set()))
        baseline = BASELINE_CONFUSION_PARTNERS.get(up, [])
        combined: List[str] = []
        for item in learned + baseline:
            if item not in combined:
                combined.append(item)
        return combined

    def predict_correction_risk(self, entity_type: str, confidence: float, value: str) -> Dict[str, Any]:
        risk_score = max(0.0, 100.0 - float(confidence or 0.0))
        high_risk_types = ["pan", "id_doc", "address", "account", "email"]
        if entity_type in high_risk_types:
            risk_score += 15.0

        risk_level = "High" if risk_score > 35 else "Moderate" if risk_score > 20 else "Low"
        return {
            "risk_score": round(min(100.0, risk_score), 1),
            "risk_level": risk_level,
            "recommendation": "Mandatory phonetic read-back confirmation required" if risk_score > 30 else "Standard read-back recommended",
        }


correction_learner = CorrectionLearningModel(min_training_samples=4)
correction_learner.fit_from_logs()
