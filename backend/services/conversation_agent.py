import difflib
import re
from typing import Dict, Any, List, Optional, Tuple
from backend.database import db, DEFAULT_FLOW_ENTITIES, compute_char_diff_ops
from backend.logger import logger
from backend.services.entity_extractor import entity_extractor
from backend.services.phonetic_engine import phonetic_engine, INDIAN_FRIENDLY_PHONETIC, NATO_PHONETIC
from backend.services.confidence_scorer import confidence_scorer
from backend.services.correction_learner import correction_learner
from backend.services.llm_service import llm_service
from backend.services.realtime import realtime_hub


ENTITY_LABELS = {
    "name": "Full Name",
    "phone": "Phone Number",
    "pan": "PAN Card",
    "email": "Email Address",
    "pincode": "Pincode",
    "address": "Residential Address",
    "amount": "Amount (INR)",
    "dob": "Date of Birth",
    "account": "Account Number",
    "id_doc": "National ID / PAN",
}

ENTITY_TYPES = {
    "name": "alpha",
    "phone": "numeric",
    "pan": "alphanumeric",
    "email": "email",
    "pincode": "numeric",
    "address": "address",
    "amount": "amount",
    "dob": "date",
    "account": "numeric",
    "id_doc": "alphanumeric",
}

ENTITY_PROMPTS = {
    "name": "Kripya apna poora naam (Full Name) batayein.",
    "phone": "Ab apna 10-digit mobile number batayein.",
    "pan": "Ab apna 10-character PAN card number batayein.",
    "email": "Ab apna Email Address batayein.",
    "pincode": "Kripya apna 6-digit PIN code batayein.",
    "address": "Kripya apna poora residential address batayein.",
    "amount": "Aapka loan ya transaction amount kitna hai?",
    "dob": "Kripya apni Date of Birth batayein.",
    "account": "Ab apna bank account number batayein.",
    "id_doc": "Kripya apna PAN card number batayein.",
}

AI_ECHO_PHRASES = (
    "echotrust ai verification",
    "aaj hum aapki kyc details verify",
    "kya ye sahi hai",
    "note kiya hai",
    "a se amit",
    "b se babu",
    "r se ram",
    "u se umesh",
    "l se lal",
    "kripya apna poora naam",
    "human verification officer ko escalate",
)

PHONETIC_WORD_TO_CHAR: Dict[str, str] = {}
for k, v in {**INDIAN_FRIENDLY_PHONETIC, **NATO_PHONETIC}.items():
    if k.isalpha() and v:
        PHONETIC_WORD_TO_CHAR[v.lower()] = k.upper()


def _db_entity_to_api(e: Dict[str, Any]) -> Dict[str, Any]:
    etype = e.get("entity_type") or e.get("id")
    stt_conf = float(e.get("stt_confidence") if e.get("stt_confidence") is not None else (e.get("confidence") or 0.0))
    val_conf = float(e.get("validator_confidence") or 0.0)
    status = e.get("status") or "waiting"
    if status == "verified":
        status = "confirmed"
    return {
        "id": etype,
        "db_id": e.get("id"),
        "entity_type": etype,
        "label": e.get("label") or ENTITY_LABELS.get(etype, etype.title()),
        "type": ENTITY_TYPES.get(etype, "alpha"),
        "value": e.get("value") or "",
        "previousValue": e.get("previous_value") or "",
        "confidence": float(e.get("confidence") or 0.0),
        "stt_confidence": stt_conf,
        "validator_confidence": val_conf,
        "validationPassed": bool(e.get("validation_passed", 1)),
        "validation_passed": bool(e.get("validation_passed", 1)),
        "failedRule": e.get("failed_rule") or "",
        "failed_rule": e.get("failed_rule") or "",
        "status": status,
        "validationStatus": e.get("validation_status", "valid"),
        "validationMessage": e.get("validation_message", ""),
        "validation_message": e.get("validation_message", ""),
        "phoneticSummary": e.get("phonetic_summary", ""),
        "phoneticDetails": e.get("phonetic_details", []),
        "readbackText": e.get("readback_text", ""),
        "readback_text": e.get("readback_text", ""),
        "charConfidences": e.get("char_confidences", []),
        "diffOps": e.get("diff_ops", []),
        "attempts": int(e.get("attempts") or 0),
        "failedAttempts": int(e.get("failed_attempts") or 0),
        "wasCorrected": bool(e.get("was_corrected", 0)),
        "audioClipRef": e.get("audio_clip_ref") or "",
        "audio_clip_ref": e.get("audio_clip_ref") or "",
        "history": e.get("history", []),
        "verifiedAt": e.get("verified_at"),
        "isUncertain": (stt_conf < 85.0) or not bool(e.get("validation_passed", 1)),
    }


def _preserve_casing(value: str, entity_type: str) -> str:
    if entity_type in ("pan", "id_doc"):
        return re.sub(r"[^A-Za-z0-9]", "", value).upper()
    if entity_type == "email":
        return value.strip().lower()
    if entity_type == "name":
        return value.strip().title()
    return value.strip()


class ConversationAgent:
    """
    Server-owned BFSI Voice Verification State Machine & Correction Engine.
    All entity extraction, rule validation, state transitions, phonetic read-backs,
    correction logging, escalation, and WebSocket/SSE broadcasts execute here.
    """

    AFFIRMATION_REGEX = re.compile(
        r"(?<![a-z])(yes|yeah|yep|correct|right|haan|han|sahi(?:\s+hai)?|bilkul(?:\s+sahi)?|theek(?:\s+hai)?|thik(?:\s+hai)?|ok|okay|confirm|confirmed|ji(?:\s+haan|\s+ha)?|ha)(?![a-z])"
        r"|(?:हाँ|हा|हां|सही|बिलकुल|ठीक|जी\s*हाँ|जी|कंफर्म)",
        re.IGNORECASE,
    )
    NEGATION_REGEX = re.compile(
        r"(?<![a-z])(no|nope|nah|nhi|nahi|nahin|galat(?:\s+hai)?|wrong|incorrect|change|badlo|update|fix|not\s+right)(?![a-z])"
        r"|(?:नहीं|नही|गलत|बदलो|सुधार)",
        re.IGNORECASE,
    )
    GREETING_REGEX = re.compile(
        r"^\s*(?:hello|hi|hey|namaste|namaskar|pranam|good morning|good afternoon|good evening|start|shuru|नमस्ते|नमस्कार)[\s!.,।]*$",
        re.IGNORECASE,
    )
    QUESTION_REGEX = re.compile(
        r"\?|\b(why|what|how|who|purpose|kyu|kyon|kaise|kiske liye|repeat|dobara|phir se|samjhao|explain)\b"
        r"|(?:क्यों|कैसे|किसलिए|दोबारा)",
        re.IGNORECASE,
    )

    @staticmethod
    def _is_ai_echo(user_text: str, last_ai_reply: str = "") -> bool:
        norm_u = re.sub(r"[^a-z0-9\s]", "", (user_text or "").lower()).strip()
        if not norm_u:
            return False

        # Never trigger echo guard on short user confirmations/values unless verbatim phrase matches read-back
        for marker in AI_ECHO_PHRASES:
            if marker in norm_u and len(norm_u) >= 16:
                return True

        if last_ai_reply:
            norm_ai = re.sub(r"[^a-z0-9\s]", "", last_ai_reply.lower()).strip()
            if len(norm_u) >= 18 and norm_u in norm_ai:
                return True
            if len(norm_u.split()) >= 5:
                ratio = difflib.SequenceMatcher(None, norm_u, norm_ai).ratio()
                if ratio >= 0.72:
                    return True
        return False

    @staticmethod
    def _try_character_correction(
        prev_val: str,
        user_text: str,
        entity_type: str,
        char_confs: List[Dict[str, Any]],
    ) -> Optional[Tuple[str, str, str]]:
        """
        Handles partial / single-character corrections such as:
          - "N nahi, M hai" / "not N, M" / "replace B with D" / "N ki jagah M"
          - "Nahi, H hai" on "Raul" -> "Rahul" (missing silent H insertion in vowel gap)
          - "Nahi, M hai" on "Anit" -> "Amit" (ASR confusion partner substitution)
          - "A ke baad H hai" / "after A add H"
        Returns (new_value, diff_summary, mismatch_pair) or None.
        """
        if not prev_val or not user_text:
            return None

        text_clean = user_text.strip()

        # Normalize spoken phonetic words when used alongside negation ("Neha nahi Mohan hai")
        def _resolve_char(tok: str) -> str:
            t = re.sub(r"[^A-Za-z0-9]", "", tok)
            if len(t) == 1:
                return t.upper()
            if t.lower() in PHONETIC_WORD_TO_CHAR:
                return PHONETIC_WORD_TO_CHAR[t.lower()]
            return ""

        # 1. Explicit old -> new patterns: "N nahi, M hai", "N ki jagah M", "replace N with M", "M instead of N"
        explicit_patterns = [
            r"\b([A-Za-z0-9]{1,12})\s+(?:nahi|nahin|nhi|galat)\b[,\s]+([A-Za-z0-9]{1,12})\b(?:\s+(?:hai|h|karo|hoga|chahiye))?",
            r"\b(?:not)\s+([A-Za-z0-9]{1,12})\b[,\s]+([A-Za-z0-9]{1,12})\b",
            r"\b([A-Za-z0-9]{1,12})\s+(?:ki\s+jagah|ko|ke\s+badle)\s+([A-Za-z0-9]{1,12})\b",
            r"\b(?:replace|change)\s+([A-Za-z0-9]{1,12})\s+(?:with|to)\s+([A-Za-z0-9]{1,12})\b",
            r"\b([A-Za-z0-9]{1,12})\s+(?:instead\s+of)\s+([A-Za-z0-9]{1,12})\b",
        ]
        for idx, pat in enumerate(explicit_patterns):
            m = re.search(pat, text_clean, re.IGNORECASE)
            if m:
                g1, g2 = m.group(1), m.group(2)
                if idx == 4:  # "M instead of N" -> g2 is old, g1 is new
                    g1, g2 = g2, g1
                old_ch = _resolve_char(g1)
                new_ch = _resolve_char(g2)
                if old_ch and new_ch and old_ch != new_ch:
                    # Find matching position in prev_val (preferring low-confidence occurrence first)
                    low_indices = [c["index"] for c in (char_confs or []) if c.get("low_confidence")]
                    match_pos = None
                    for pos in low_indices:
                        if 0 <= pos < len(prev_val) and prev_val[pos].upper() == old_ch:
                            match_pos = pos
                            break
                    if match_pos is None:
                        match_pos = prev_val.upper().find(old_ch)
                    if match_pos != -1:
                        updated = prev_val[:match_pos] + new_ch + prev_val[match_pos + 1:]
                        formatted = _preserve_casing(updated, entity_type)
                        return formatted, f"{old_ch}->{new_ch}", f"{old_ch}->{new_ch}"

        # 2. Positional insert: "A ke baad H", "after A H", "U ke pehle H", "before U H"
        after_m = re.search(r"\b([A-Za-z0-9])\s+ke\s+baad\s+([A-Za-z0-9])\b|\bafter\s+([A-Za-z0-9])\s+(?:add|put|insert|it\s+is|is)?\s*([A-Za-z0-9])\b", text_clean, re.IGNORECASE)
        if after_m:
            anchor = (after_m.group(1) or after_m.group(3)).upper()
            new_ch = (after_m.group(2) or after_m.group(4)).upper()
            pos = prev_val.upper().find(anchor)
            if pos != -1:
                updated = prev_val[:pos + 1] + new_ch + prev_val[pos + 1:]
                formatted = _preserve_casing(updated, entity_type)
                return formatted, f"+{new_ch} after {anchor}", f"_->{new_ch}"

        before_m = re.search(r"\b([A-Za-z0-9])\s+ke\s+pehle\s+([A-Za-z0-9])\b|\bbefore\s+([A-Za-z0-9])\s+(?:add|put|insert|it\s+is|is)?\s*([A-Za-z0-9])\b", text_clean, re.IGNORECASE)
        if before_m:
            anchor = (before_m.group(1) or before_m.group(3)).upper()
            new_ch = (before_m.group(2) or before_m.group(4)).upper()
            pos = prev_val.upper().find(anchor)
            if pos != -1:
                updated = prev_val[:pos] + new_ch + prev_val[pos:]
                formatted = _preserve_casing(updated, entity_type)
                return formatted, f"+{new_ch} before {anchor}", f"_->{new_ch}"

        # 3. Single letter / digit stated after negation ("Nahi, H hai", "Nahi H se Hari", "Galat, M hai", "add H", "H missing hai")
        single_m = re.search(
            r"(?:nahi|nahin|nhi|galat(?:\s+hai)?|no|nope|add|insert|missing|wrong)\b[,\s:\-]*(?:it\s+is\s+|letter\s+)?([A-Za-z0-9])\s*(?:hai|h|karo|hoga|missing|se\s+[A-Za-z]+|for\s+[A-Za-z]+)?\s*[.।!]*$",
            text_clean,
            re.IGNORECASE,
        )
        if single_m:
            new_ch = single_m.group(1).upper()

            # 3a. Missing silent H / vowel hiatus insertion in Indian names ("Raul" + "Nahi, H hai" -> "Rahul")
            if new_ch == "H" and entity_type in ("name", "alpha", "address"):
                hiatus = re.search(r"([aeiou])([aeiou])", prev_val, re.IGNORECASE)
                if hiatus:
                    insert_idx = hiatus.start(2)
                    updated = prev_val[:insert_idx] + "h" + prev_val[insert_idx:]
                    formatted = _preserve_casing(updated, entity_type)
                    return formatted, f"+H at pos {insert_idx}", "_->H"
                # Check if H missing after aspirated consonant stop (e.g. Subam -> Shubam or Amith)
                asp = re.search(r"([bcdfgjkpst])([aeiou])", prev_val[1:], re.IGNORECASE)
                if asp:
                    insert_idx = 1 + asp.start(2)
                    updated = prev_val[:insert_idx] + "h" + prev_val[insert_idx:]
                    formatted = _preserve_casing(updated, entity_type)
                    return formatted, f"+H at pos {insert_idx}", "_->H"

            # 3b. Substitute known ASR confusion partner present in prev_val (e.g. "Anit" + "Nahi, M hai" -> "Amit")
            partners = correction_learner.get_partners_for_char(new_ch)
            low_indices = [c["index"] for c in (char_confs or []) if c.get("low_confidence")]
            for pos in low_indices + list(range(len(prev_val))):
                if 0 <= pos < len(prev_val) and prev_val[pos].upper() in partners:
                    old_ch = prev_val[pos].upper()
                    updated = prev_val[:pos] + new_ch + prev_val[pos + 1:]
                    formatted = _preserve_casing(updated, entity_type)
                    return formatted, f"{old_ch}->{new_ch}", f"{old_ch}->{new_ch}"

            # 3c. Fallback: replace single lowest-confidence character if one exists
            if char_confs:
                sortable = [c for c in char_confs if not str(c.get("char", "")).isspace()]
                lowest = min(sortable, key=lambda c: c.get("confidence", 100.0), default=None)
                if lowest and lowest.get("low_confidence"):
                    pos = int(lowest["index"])
                    old_ch = prev_val[pos].upper()
                    updated = prev_val[:pos] + new_ch + prev_val[pos + 1:]
                    formatted = _preserve_casing(updated, entity_type)
                    return formatted, f"{old_ch}->{new_ch}", f"{old_ch}->{new_ch}"

        return None

    def _get_entities_map(self, db_session: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        entities_map: Dict[str, Dict[str, Any]] = {}
        for row in db_session.get("entities", []):
            api_ent = _db_entity_to_api(row)
            entities_map[api_ent["id"]] = api_ent
        return entities_map

    def _next_unverified_target(
        self,
        flow_entities: List[str],
        entities_map: Dict[str, Dict[str, Any]],
        skip_id: Optional[str] = None,
    ) -> Optional[str]:
        for eid in flow_entities:
            if eid == skip_id:
                continue
            ent = entities_map.get(eid)
            if ent and ent.get("value") and ent.get("status") not in ("confirmed", "verified", "escalated"):
                return eid
        for eid in flow_entities:
            if eid == skip_id:
                continue
            ent = entities_map.get(eid)
            if not ent or (not ent.get("value") and ent.get("status") not in ("confirmed", "verified", "escalated")):
                return eid
        return None

    async def start_call(
        self,
        session_id: Optional[str] = None,
        flow_entities: Optional[List[str]] = None,
        phonetic_scheme: str = "indian",
        officer_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        if session_id:
            db_session = db.get_session_by_id(session_id)
        else:
            db_session = None

        if not db_session:
            db_session = db.create_session({
                "flow_entities": flow_entities or list(DEFAULT_FLOW_ENTITIES),
                "phonetic_scheme": phonetic_scheme or "indian",
                "call_status": "Live",
                "status": "In Progress",
                "officer_id": officer_id or "USR-1",
            })
        else:
            db_session = db.update_session(
                db_session["id"],
                {
                    "call_status": "Live",
                    "status": "In Progress",
                    "phonetic_scheme": phonetic_scheme or db_session.get("phonetic_scheme", "indian"),
                },
            ) or db_session

        sid = db_session["id"]
        flow = db_session.get("flow_entities") or list(DEFAULT_FLOW_ENTITIES)
        first_field = flow[0] if flow else "name"
        greeting = (
            f"Namaste! Main EchoTrust AI Verification agent hoon. "
            f"{ENTITY_PROMPTS.get(first_field, 'Kripya apna poora naam batayein.')}"
        )

        db.append_dialogue_messages(
            sid,
            [{
                "role": "agent",
                "sender": "ai",
                "text": greeting,
                "field": first_field,
                "target_id": first_field,
                "action": "greeting",
            }],
        )
        db.append_audit_event(
            sid,
            {
                "event_type": "call_started",
                "role": "agent",
                "field": first_field,
                "text": greeting,
                "phonetic_scheme": phonetic_scheme or "indian",
            },
        )
        db.update_session(sid, {"active_target_id": first_field, "last_ai_reply": greeting, "call_status": "Live"})
        resp = self._build_response(
            sid=sid,
            action="greeting",
            target_id=first_field,
            reply=greeting,
            newly_extracted=[],
        )
        await realtime_hub.broadcast(sid, "session_state", resp)
        return resp

    async def process_turn(
        self,
        text: str,
        session_id: Optional[str] = None,
        active_target_id: Optional[str] = None,
        existing_entities: Optional[Dict[str, Any]] = None,
        acoustic_confidence: float = 90.0,
        officer_id: Optional[str] = None,
        phonetic_scheme: Optional[str] = None,
        stt_meta: Optional[Dict[str, Any]] = None,
        audio_clip_ref: str = "",
    ) -> Dict[str, Any]:
        """
        Executes a full server-side turn for customer input:
        Echo Guard -> STT Metadata Tagging -> Intent / Yes-No / Char Correction ->
        Rule Validation -> State Machine & DB Update -> Audit Trail -> WebSocket Broadcast.
        """
        clean_text = (text or "").strip()
        db_session = db.ensure_session_exists(session_id, officer_id=officer_id)
        sid = db_session["id"]
        flow_entities: List[str] = db_session.get("flow_entities") or list(DEFAULT_FLOW_ENTITIES)
        scheme = (phonetic_scheme or db_session.get("phonetic_scheme") or "indian").lower()
        if scheme not in ("indian", "nato"):
            scheme = "indian"
        if phonetic_scheme and phonetic_scheme != db_session.get("phonetic_scheme"):
            db.update_session(sid, {"phonetic_scheme": scheme})

        entities_map = self._get_entities_map(db_session)

        if existing_entities:
            seed_batch = []
            for eid, val_obj in existing_entities.items():
                if eid in flow_entities and isinstance(val_obj, dict) and val_obj.get("value") and eid not in entities_map:
                    safe_ent = dict(val_obj)
                    safe_ent["id"] = eid
                    safe_ent["entity_type"] = eid
                    safe_ent["status"] = "captured"
                    seed_batch.append(safe_ent)
            if seed_batch:
                db.upsert_entities(sid, seed_batch)
                db_session = db.get_session_by_id(sid) or db_session
                entities_map = self._get_entities_map(db_session)

        target_id = active_target_id or db_session.get("active_target_id") or self._next_unverified_target(flow_entities, entities_map)

        # GUARD 1: If session already Escalated or Ended, do not silently overwrite
        if db_session.get("call_status") == "Escalated" or db_session.get("status") == "Escalated":
            msg = "Ye verification session pehle hi Human Verification Officer ko escalate ho chuka hai."
            resp = self._build_response(sid=sid, action="escalated", target_id=None, reply=msg, newly_extracted=[])
            await realtime_hub.broadcast(sid, "session_state", resp)
            return resp

        # GUARD 2: Empty / inaudible speech
        if not clean_text:
            prompt_id = target_id or self._next_unverified_target(flow_entities, entities_map) or flow_entities[0]
            reply = f"Maaf kijiye, aapki aawaz saaf nahi aayi. {ENTITY_PROMPTS.get(prompt_id, 'Kripya dobara bolein.')}"
            db.update_session(sid, {"active_target_id": prompt_id, "last_ai_reply": reply})
            db.append_dialogue_messages(sid, [{"role": "agent", "sender": "ai", "text": reply, "field": prompt_id, "action": "ask_entity"}])
            resp = self._build_response(sid=sid, action="ask_entity", target_id=prompt_id, reply=reply, newly_extracted=[])
            await realtime_hub.broadcast(sid, "session_state", resp)
            return resp

        # GUARD 3: Agent TTS echo leaked into mic -> ignore safely!
        last_ai_reply = db_session.get("last_ai_reply") or ""
        if self._is_ai_echo(clean_text, last_ai_reply):
            logger.warning(f"[ECHO GUARD] Ignored suspected AI echo on session={sid}: '{clean_text[:80]}'")
            reply = ENTITY_PROMPTS.get(target_id or "name", "Kripya apna jawab bolein.")
            resp = self._build_response(sid=sid, action="echo_ignored", target_id=target_id, reply=reply, newly_extracted=[])
            await realtime_hub.broadcast(sid, "echo_ignored", {"session_id": sid, "ignored_text": clean_text})
            return resp

        # Record customer message tagged with field, timestamp, role, stt metadata
        stt_lang = (stt_meta or {}).get("language") or "indic-auto"
        customer_msg = {
            "role": "customer",
            "sender": "customer",
            "text": clean_text,
            "field": target_id,
            "target_id": target_id,
            "stt_confidence": round(float(acoustic_confidence), 1),
            "per_word_confidence": (stt_meta or {}).get("per_word_confidence", []),
            "language": stt_lang,
            "audio_clip_ref": audio_clip_ref,
        }
        db.append_dialogue_messages(sid, [customer_msg])
        db.append_audit_event(
            sid,
            {
                "event_type": "customer_response",
                "role": "customer",
                "field": target_id,
                "text": clean_text,
                "stt_confidence": round(float(acoustic_confidence), 1),
                "language": stt_lang,
                "audio_clip_ref": audio_clip_ref,
            },
        )

        has_affirm = bool(self.AFFIRMATION_REGEX.search(clean_text))
        has_neg = bool(self.NEGATION_REGEX.search(clean_text))
        is_greeting = bool(self.GREETING_REGEX.match(clean_text))
        is_question = bool(self.QUESTION_REGEX.search(clean_text)) and not has_affirm and not has_neg

        action = "ask_entity"
        next_target_id: Optional[str] = target_id
        reply_text = ""
        extracted: List[Dict[str, Any]] = []

        # Helper to trigger 3-failure escalation on a field
        def _escalate_field(eid: str, reason: str) -> str:
            label = ENTITY_LABELS.get(eid, eid.title())
            db_eid = f"{sid}__{eid}"
            existing_ent = entities_map.get(eid)
            if existing_ent:
                db.update_entity(
                    db_eid,
                    {
                        "status": "escalated",
                        "validation_status": "invalid",
                        "validation_message": reason,
                        "verified_at": None,
                    },
                )
            else:
                db.upsert_entities(
                    sid,
                    [{
                        "id": eid,
                        "entity_type": eid,
                        "label": label,
                        "value": "",
                        "stt_confidence": float(acoustic_confidence),
                        "validator_confidence": 0.0,
                        "validationPassed": False,
                        "status": "escalated",
                        "_force_status": True,
                        "validationStatus": "invalid",
                        "validationMessage": reason,
                        "failed_attempts": 3,
                        "attempts": 3,
                    }],
                )
            esc_msg = (
                f"3 failed attempts ke baad {label} verify nahi ho paya ({reason}). "
                f"Main is verification call ko Human Verification Officer ko escalate kar raha hoon."
            )
            db.update_session(sid, {"status": "Escalated", "call_status": "Escalated", "active_target_id": None})
            db.append_audit_event(
                sid,
                {
                    "event_type": "escalation",
                    "role": "agent",
                    "field": eid,
                    "text": esc_msg,
                    "before_value": (existing_ent or {}).get("value", ""),
                    "audio_clip_ref": audio_clip_ref,
                },
            )
            return esc_msg

        # CASE A: Explicit Rejection / Character Correction on active target
        if has_neg and target_id and target_id in entities_map and entities_map[target_id].get("value"):
            prev_ent = entities_map[target_id]
            prev_val = prev_ent.get("value", "")
            prev_stt_conf = float(prev_ent.get("stt_confidence", 75.0))
            next_failed = int(prev_ent.get("failedAttempts", 0)) + 1
            next_attempts = int(prev_ent.get("attempts", 0)) + 1
            label = prev_ent.get("label", ENTITY_LABELS.get(target_id, target_id))

            # Step 1: Try precise character-level correction first ("Nahi, H hai", "N nahi, M hai")
            char_fix = self._try_character_correction(
                prev_val,
                clean_text,
                target_id,
                prev_ent.get("charConfidences", []),
            )
            corrected_val = char_fix[0] if char_fix else None
            mismatch_pair = char_fix[2] if char_fix else None

            # Step 2: Otherwise try full entity re-extraction from correction phrase
            if not corrected_val:
                corr_candidates = entity_extractor.extract_all_entities(
                    clean_text, acoustic_confidence, target_id=target_id, phonetic_scheme=scheme, flow_entities=flow_entities
                )
                if corr_candidates and corr_candidates[0].get("value") and corr_candidates[0]["value"].lower() != prev_val.lower():
                    corrected_val = corr_candidates[0]["value"]
                    mismatch_pair = f"{prev_val[:12]}->{corrected_val[:12]}"

            if corrected_val and corrected_val != prev_val:
                score = confidence_scorer.calculate_score(
                    target_id,
                    corrected_val,
                    max(float(acoustic_confidence), 90.0),
                    correction_attempt=next_attempts,
                )
                norm_corr = score["normalized_value"]
                diff_ops = compute_char_diff_ops(prev_val, norm_corr)

                # Always log correction + retrain CorrectionLearningModel!
                db.record_correction(
                    session_id=sid,
                    entity_id=target_id,
                    entity_type=target_id,
                    original_val=prev_val,
                    corrected_val=norm_corr,
                    original_conf=prev_stt_conf,
                    corrected_conf=score["stt_confidence"],
                    attempts=next_attempts,
                    mismatch_pair=mismatch_pair,
                )
                correction_learner.fit_from_logs()

                if not score["validation_passed"]:
                    # Corrected value itself failed rules (e.g. invalid PAN / phone)
                    if next_failed >= 3:
                        reply_text = _escalate_field(target_id, score["validation_message"])
                        action = "escalated"
                        next_target_id = None
                    else:
                        bad_ent = {
                            "id": target_id,
                            "entity_type": target_id,
                            "label": label,
                            "value": norm_corr,
                            "previous_value": prev_val,
                            "diff_ops": diff_ops,
                            "stt_confidence": score["stt_confidence"],
                            "validator_confidence": score["validator_confidence"],
                            "validationPassed": False,
                            "failedRule": score["failed_rule"],
                            "charConfidences": score["char_confidences"],
                            "status": "corrected",
                            "validationStatus": "invalid",
                            "validationMessage": score["validation_message"],
                            "attempts": next_attempts,
                            "failed_attempts": next_failed,
                            "was_corrected": True,
                            "audio_clip_ref": audio_clip_ref,
                            "_correction_logged": True,
                        }
                        db.upsert_entities(sid, [bad_ent])
                        extracted = [bad_ent]
                        reply_text = (
                            f"Naya {label} valid nahi hai ({score['validation_message']}). "
                            f"Kripya sahi {label} dobara batayein (Attempt {next_failed}/3)."
                        )
                        action = "validation_failed"
                        next_target_id = target_id
                else:
                    readback = phonetic_engine.generate_readback_sentence(label, norm_corr, ENTITY_TYPES.get(target_id, target_id), scheme)
                    summary = phonetic_engine.format_phonetic_summary(norm_corr, ENTITY_TYPES.get(target_id, target_id), scheme)
                    details = phonetic_engine.get_phonetic_spelling(norm_corr, scheme)

                    updated_ent = {
                        "id": target_id,
                        "entity_type": target_id,
                        "label": label,
                        "value": norm_corr,
                        "previous_value": prev_val,
                        "diff_ops": diff_ops,
                        "confidence": score["confidence"],
                        "stt_confidence": score["stt_confidence"],
                        "validator_confidence": score["validator_confidence"],
                        "validationPassed": True,
                        "failedRule": "",
                        "charConfidences": score["char_confidences"],
                        "status": "readback_sent",
                        "validationStatus": score["validation_status"],
                        "validationMessage": score["validation_message"],
                        "phoneticSummary": summary,
                        "phoneticDetails": details,
                        "readback_text": readback,
                        "attempts": next_attempts,
                        "failed_attempts": next_failed,
                        "was_corrected": True,
                        "audio_clip_ref": audio_clip_ref,
                        "_correction_logged": True,
                    }
                    db.upsert_entities(sid, [updated_ent])
                    extracted = [updated_ent]
                    db.append_audit_event(
                        sid,
                        {
                            "event_type": "correction",
                            "role": "customer",
                            "field": target_id,
                            "before_value": prev_val,
                            "after_value": norm_corr,
                            "text": f"{prev_val} -> {norm_corr}",
                            "stt_confidence": prev_stt_conf,
                            "audio_clip_ref": audio_clip_ref,
                        },
                    )
                    db.append_audit_event(
                        sid,
                        {
                            "event_type": "readback_sent",
                            "role": "agent",
                            "field": target_id,
                            "text": readback,
                            "phonetic_scheme": scheme,
                            "audio_clip_ref": f"tts-{sid}-{target_id}-{next_attempts}",
                        },
                    )
                    reply_text = f"Sudhar kar diya hai: {prev_val} se {norm_corr}. {readback}"
                    action = "confirm_entity"
                    next_target_id = target_id
            else:
                # Rejection with no replacement yet ("Nahi" / "Galat hai")
                if next_failed >= 3:
                    reply_text = _escalate_field(target_id, "Repeated rejection without confirmation")
                    action = "escalated"
                    next_target_id = None
                else:
                    db_eid = f"{sid}__{target_id}"
                    db.update_entity(
                        db_eid,
                        {
                            "status": "corrected",
                            "failed_attempts": next_failed,
                            "attempts": next_attempts,
                            "was_corrected": True,
                            "verified_at": None,
                        },
                    )
                    reply_text = (
                        f"Theek hai, galat akshar ya poora sahi {label} dobara batayein "
                        f"(Attempt {next_failed}/3)."
                    )
                    action = "request_correction"
                    next_target_id = target_id

        # CASE B: Customer Confirms active target ("Haan" / "Ji" / "Sahi hai" / "Theek hai")
        elif (
            has_affirm
            and not has_neg
            and target_id
            and target_id in entities_map
            and entities_map[target_id].get("value")
            and entities_map[target_id].get("validationPassed", True)
        ):
            confirmed_ent = entities_map[target_id]
            db.record_confirmation(
                session_id=sid,
                entity_id=target_id,
                entity_type=target_id,
                confirmed_value=confirmed_ent["value"],
                confidence=confirmed_ent["stt_confidence"],
            )
            entities_map[target_id]["status"] = "confirmed"
            db.append_audit_event(
                sid,
                {
                    "event_type": "confirmation",
                    "role": "customer",
                    "field": target_id,
                    "text": clean_text,
                    "after_value": confirmed_ent["value"],
                    "stt_confidence": confirmed_ent["stt_confidence"],
                    "validator_confidence": confirmed_ent["validator_confidence"],
                    "audio_clip_ref": audio_clip_ref,
                },
            )

            # Check if customer also supplied additional entity values in same affirmative turn
            extra_entities = entity_extractor.extract_all_entities(
                clean_text, acoustic_confidence, target_id=None, phonetic_scheme=scheme, flow_entities=flow_entities
            )
            extra_entities = [e for e in extra_entities if e["id"] != target_id]

            if extra_entities:
                valid_extras = [e for e in extra_entities if e.get("validationPassed", True)]
                if valid_extras:
                    first_new = valid_extras[0]
                    rb = phonetic_engine.generate_readback_sentence(first_new["label"], first_new["value"], first_new["type"], scheme)
                    first_new["status"] = "readback_sent"
                    first_new["readback_text"] = rb
                    first_new["audio_clip_ref"] = audio_clip_ref
                    db.upsert_entities(sid, [first_new])
                    db.append_audit_event(
                        sid,
                        {"event_type": "readback_sent", "role": "agent", "field": first_new["id"], "text": rb, "phonetic_scheme": scheme, "audio_clip_ref": f"tts-{sid}-{first_new['id']}"},
                    )
                    reply_text = f"Badhiya, {confirmed_ent['label']} confirm ho gaya! {rb}"
                    action = "confirm_entity"
                    next_target_id = first_new["id"]
                    extracted = [first_new]

            if not reply_text:
                next_slot = self._next_unverified_target(flow_entities, entities_map, skip_id=target_id)
                if next_slot:
                    ent_existing = entities_map.get(next_slot)
                    if ent_existing and ent_existing.get("value") and ent_existing.get("validationPassed", True):
                        rb = phonetic_engine.generate_readback_sentence(
                            ent_existing["label"], ent_existing["value"], ent_existing["type"], scheme
                        )
                        db.update_entity(f"{sid}__{next_slot}", {"status": "readback_sent", "readback_text": rb})
                        db.append_audit_event(
                            sid,
                            {"event_type": "readback_sent", "role": "agent", "field": next_slot, "text": rb, "phonetic_scheme": scheme, "audio_clip_ref": f"tts-{sid}-{next_slot}"},
                        )
                        reply_text = f"{confirmed_ent['label']} confirm ho gaya! Ab agla detail: {rb}"
                        action = "confirm_entity"
                    else:
                        reply_text = f"{confirmed_ent['label']} confirm ho gaya! {ENTITY_PROMPTS.get(next_slot, '')}"
                        action = "ask_entity"
                    next_target_id = next_slot
                else:
                    db.generate_verification_summary(sid)
                    db.update_session(sid, {"status": "Verified", "call_status": "Ended", "active_target_id": None})
                    reply_text = (
                        "Dhanyawad! Aapke saare KYC details verify aur confirm ho gaye hain. "
                        "Aapka verification session complete ho chuka hai."
                    )
                    action = "all_confirmed"
                    next_target_id = None

        # CASE C: Extract Candidate Value(s) & Validate
        else:
            # First run targeted extraction if target_id exists and utterance isn't pure greeting/question
            if not is_greeting and not is_question:
                extracted = entity_extractor.extract_all_entities(
                    clean_text,
                    acoustic_confidence,
                    target_id=target_id if (target_id in flow_entities) else None,
                    phonetic_scheme=scheme,
                    flow_entities=flow_entities,
                )

            if extracted:
                primary = extracted[0]
                eid = primary["id"]
                existing = entities_map.get(eid)
                prev_val = (existing or {}).get("value", "")
                was_confirmed_before = bool(existing and existing.get("status") in ("confirmed", "verified"))

                # Guard: never overwrite a confirmed value unless logged as correction
                if was_confirmed_before and prev_val != primary["value"]:
                    db.record_correction(
                        session_id=sid,
                        entity_id=eid,
                        entity_type=eid,
                        original_val=prev_val,
                        corrected_val=primary["value"],
                        original_conf=float(existing.get("stt_confidence", 90.0)),
                        corrected_conf=float(primary["stt_confidence"]),
                        attempts=int(existing.get("attempts", 0)) + 1,
                    )
                    correction_learner.fit_from_logs()
                    primary["_correction_logged"] = True
                    primary["was_corrected"] = True
                    primary["previous_value"] = prev_val
                    primary["diff_ops"] = compute_char_diff_ops(prev_val, primary["value"])

                if not primary.get("validationPassed", True):
                    # FAILED RULE VALIDATION -> lower confidence, count failure, ask customer to repeat!
                    next_failed = int((existing or {}).get("failedAttempts", 0)) + 1
                    next_attempts = int((existing or {}).get("attempts", 0)) + 1
                    if next_failed >= 3:
                        reply_text = _escalate_field(eid, primary.get("validationMessage") or "Repeated validation failure")
                        action = "escalated"
                        next_target_id = None
                    else:
                        primary["status"] = "captured"
                        primary["failed_attempts"] = next_failed
                        primary["attempts"] = next_attempts
                        primary["audio_clip_ref"] = audio_clip_ref
                        db.upsert_entities(sid, [primary])
                        db.append_audit_event(
                            sid,
                            {
                                "event_type": "validation_failed",
                                "role": "agent",
                                "field": eid,
                                "text": f"Rejected candidate '{primary['value']}': {primary.get('validationMessage')}",
                                "stt_confidence": primary["stt_confidence"],
                                "validator_confidence": primary["validator_confidence"],
                                "audio_clip_ref": audio_clip_ref,
                            },
                        )
                        reply_text = (
                            f"Maaf kijiye, ye {primary['label']} valid nahi hai ({primary.get('validationMessage')}). "
                            f"Kripya apna sahi {primary['label']} dobara bolein (Attempt {next_failed}/3)."
                        )
                        action = "validation_failed"
                        next_target_id = eid
                else:
                    # Valid candidate captured -> generate read-back & move through captured -> readback_sent!
                    batch_to_save = []
                    for idx_e, item in enumerate(extracted):
                        if not item.get("validationPassed", True):
                            continue
                        item_eid = item["id"]
                        ex_item = entities_map.get(item_eid)
                        if ex_item and ex_item.get("value") and ex_item["value"] != item["value"] and not item.get("_correction_logged"):
                            db.record_correction(
                                session_id=sid,
                                entity_id=item_eid,
                                entity_type=item_eid,
                                original_val=ex_item["value"],
                                corrected_val=item["value"],
                                original_conf=float(ex_item.get("stt_confidence", 75.0)),
                                corrected_conf=float(item["stt_confidence"]),
                                attempts=int(ex_item.get("attempts", 0)) + 1,
                            )
                            correction_learner.fit_from_logs()
                            item["_correction_logged"] = True
                            item["was_corrected"] = True
                            item["previous_value"] = ex_item["value"]
                            item["diff_ops"] = compute_char_diff_ops(ex_item["value"], item["value"])

                        item["audio_clip_ref"] = audio_clip_ref
                        item["attempts"] = int((ex_item or {}).get("attempts", 0)) + 1
                        item["failed_attempts"] = int((ex_item or {}).get("failedAttempts", 0))
                        if idx_e == 0:
                            rb = phonetic_engine.generate_readback_sentence(item["label"], item["value"], item["type"], scheme)
                            item["status"] = "readback_sent"
                            item["readback_text"] = rb
                        else:
                            item["status"] = "captured"
                        batch_to_save.append(item)

                    db.upsert_entities(sid, batch_to_save)
                    first_item = batch_to_save[0]
                    rb_text = first_item["readback_text"]
                    db.append_audit_event(
                        sid,
                        {
                            "event_type": "readback_sent",
                            "role": "agent",
                            "field": first_item["id"],
                            "text": rb_text,
                            "phonetic_scheme": scheme,
                            "stt_confidence": first_item["stt_confidence"],
                            "validator_confidence": first_item["validator_confidence"],
                            "audio_clip_ref": f"tts-{sid}-{first_item['id']}-{first_item['attempts']}",
                        },
                    )
                    reply_text = rb_text
                    action = "confirm_entity"
                    next_target_id = first_item["id"]
                    extracted = batch_to_save

            # CASE D: Question / Repeat Request
            elif is_question:
                prompt_slot = target_id or self._next_unverified_target(flow_entities, entities_map) or flow_entities[0]
                if "repeat" in clean_text.lower() or "dobara" in clean_text.lower() or "दोबारा" in clean_text:
                    ent = entities_map.get(prompt_slot)
                    if ent and ent.get("value") and ent.get("validationPassed", True):
                        reply_text = phonetic_engine.generate_readback_sentence(ent["label"], ent["value"], ent["type"], scheme)
                        action = "confirm_entity"
                    else:
                        reply_text = f"Zaroor! {ENTITY_PROMPTS.get(prompt_slot, '')}"
                        action = "ask_entity"
                else:
                    reply_text = (
                        "Ye details sirf aapki secure KYC verification ke liye verify ki ja rahi hain. "
                        f"{ENTITY_PROMPTS.get(prompt_slot, '')}"
                    )
                    action = "answer_question"
                next_target_id = prompt_slot

            # CASE E: Greeting or unclear input
            else:
                prompt_slot = target_id or self._next_unverified_target(flow_entities, entities_map) or flow_entities[0]
                if is_greeting:
                    reply_text = f"Namaste! Main EchoTrust AI Verification agent hoon. {ENTITY_PROMPTS.get(prompt_slot, '')}"
                    action = "greeting"
                else:
                    reply_text = f"Maaf kijiye, main samajh nahi paya. {ENTITY_PROMPTS.get(prompt_slot, '')}"
                    action = "ask_entity"
                next_target_id = prompt_slot

        # Optional External LLM polish when configured (preserving exact phonetic read-backs & escalation notices)
        dialogue_history = list(db_session.get("dialogue_log") or [])
        if llm_service.configured and action in ("greeting", "answer_question"):
            llm_out = await llm_service.analyze_and_respond(
                user_text=clean_text,
                dialogue_history=dialogue_history,
                entities_state=list(entities_map.values()),
                active_target_id=next_target_id,
                next_prompt_hint=reply_text,
            )
            if llm_out and llm_out.get("reply"):
                reply_text = llm_out["reply"]

        # Persist agent reply + active_target_id + metrics + WebSocket broadcast
        db.append_dialogue_messages(
            sid,
            [{
                "role": "agent",
                "sender": "ai",
                "text": reply_text,
                "field": next_target_id,
                "action": action,
                "target_id": next_target_id,
            }],
        )
        db.update_session(sid, {"active_target_id": next_target_id, "last_ai_reply": reply_text})
        summary = db.generate_verification_summary(sid)

        resp = self._build_response(
            sid=sid,
            action=action,
            target_id=next_target_id,
            reply=reply_text,
            newly_extracted=extracted,
            summary=summary,
        )
        await realtime_hub.broadcast(sid, "session_state", resp)
        return resp

    def _build_response(
        self,
        sid: str,
        action: str,
        target_id: Optional[str],
        reply: str,
        newly_extracted: List[Dict[str, Any]],
        summary: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        refreshed = db.get_session_by_id(sid) or {}
        flow_entities = refreshed.get("flow_entities") or list(DEFAULT_FLOW_ENTITIES)
        entities_list = [
            _db_entity_to_api(e)
            for e in refreshed.get("entities", [])
            if (e.get("entity_type") or e.get("id")) in flow_entities
        ]
        entities_by_id = {e["id"]: e for e in entities_list}
        confirmed_count = sum(1 for e in entities_list if e.get("status") in ("confirmed", "verified"))
        pending_count = len(flow_entities) - confirmed_count

        return {
            "session_id": sid,
            "session_status": refreshed.get("status", "In Progress"),
            "call_status": refreshed.get("call_status", "Live"),
            "customer_id": refreshed.get("customer_id"),
            "customer_name": refreshed.get("customer_name"),
            "app_no": refreshed.get("app_no"),
            "flow_entities": flow_entities,
            "phonetic_scheme": refreshed.get("phonetic_scheme", "indian"),
            "intent": action,
            "action": action,
            "target_id": target_id,
            "active_target_id": target_id,
            "reply": reply,
            "extracted": newly_extracted,
            "entities": entities_by_id,
            "entities_list": entities_list,
            "verified_count": confirmed_count,
            "pending_count": max(0, pending_count),
            "total_target_entities": len(flow_entities),
            "dialogue_log": refreshed.get("dialogue_log", []),
            "audit_trail": refreshed.get("audit_trail", []),
            "metrics": refreshed.get("metrics") or db.compute_session_metrics(refreshed),
            "verification_summary": refreshed.get("verification_summary") or (summary or {}).get("summary_text", ""),
            "llm_provider": llm_service.provider if llm_service.configured else "bfsi-deterministic-nlu",
        }


conversation_agent = ConversationAgent()
