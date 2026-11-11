import re
from typing import Dict, Any, List, Optional
from backend.database import db
from backend.logger import logger
from backend.services.entity_extractor import entity_extractor
from backend.services.phonetic_engine import phonetic_engine
from backend.services.correction_learner import correction_learner
from backend.services.llm_service import llm_service


ENTITY_ORDER = ["name", "phone", "email", "address", "amount", "dob", "account", "id_doc"]

ENTITY_LABELS = {
    "name": "Full Name",
    "phone": "Phone Number",
    "email": "Email Address",
    "address": "Residential Address",
    "amount": "Amount (INR)",
    "dob": "Date of Birth",
    "account": "Account Number",
    "id_doc": "National ID / PAN",
}

ENTITY_TYPES = {
    "name": "alpha",
    "phone": "numeric",
    "email": "email",
    "address": "address",
    "amount": "amount",
    "dob": "date",
    "account": "numeric",
    "id_doc": "alphanumeric",
}

ENTITY_PROMPTS = {
    "name": "Kripya apna poora naam (Full Name) batayein.",
    "phone": "Ab apna 10-digit mobile phone number batayein.",
    "email": "Ab apna Email Address batayein.",
    "address": "Kripya apna poora residential address aur PIN code batayein.",
    "amount": "Aapka loan ya transaction amount (rupees mein) kitna hai?",
    "dob": "Kripya apni Date of Birth batayein.",
    "account": "Ab apna bank account number batayein.",
    "id_doc": "Aakhri step: apna PAN card ya National ID number batayein.",
}


def _db_entity_to_api(e: Dict[str, Any]) -> Dict[str, Any]:
    etype = e.get("entity_type") or e.get("id")
    return {
        "id": etype,
        "db_id": e.get("id"),
        "entity_type": etype,
        "label": e.get("label") or ENTITY_LABELS.get(etype, etype.title()),
        "type": ENTITY_TYPES.get(etype, "alpha"),
        "value": e.get("value") or "",
        "confidence": float(e.get("confidence", 0.0)),
        "status": e.get("status", "pending"),
        "validationStatus": e.get("validation_status", "valid"),
        "validationMessage": e.get("validation_message", ""),
        "phoneticSummary": e.get("phonetic_summary", ""),
        "phoneticDetails": e.get("phonetic_details", []),
        "history": e.get("history", []),
        "verifiedAt": e.get("verified_at"),
        "isUncertain": float(e.get("confidence", 0.0)) < 85.0 or e.get("status") == "flagged",
    }


class ConversationAgent:
    """
    Fully Automated Multi-Turn Voice Verification Conversation Engine.
    Coordinates real DB session state, acoustic entity extraction, phonetic read-back,
    vocal confirmation/correction loops, correction ML updates, and optional external LLM dialogue.
    """

    AFFIRMATION_REGEX = re.compile(
        r"\b(yes|yeah|yep|correct|right|haan|ha|han|sahi|bilkul|theek|thik|ok|okay|confirm|ji haan|ji)\b"
        r"|(?:हाँ|हा|हां|सही|बिलकुल|ठीक|जी हाँ|कंफर्म)",
        re.IGNORECASE,
    )
    NEGATION_REGEX = re.compile(
        r"\b(no|nope|nah|nahi|nahin|galat|wrong|incorrect|change|badlo|update|fix|actually|not right)\b"
        r"|(?:नहीं|गलत|नही|बदलो|सुधार)",
        re.IGNORECASE,
    )
    GREETING_REGEX = re.compile(
        r"^\s*(?:hello|hi|hey|namaste|namaskar|pranam|good morning|good afternoon|good evening|start|shuru|नमस्ते|नमस्कार)[\s!.,।]*$",
        re.IGNORECASE,
    )
    QUESTION_REGEX = re.compile(
        r"\?|\b(why|what|how|who|purpose|kyu|kyon|kya|kaise|kiske liye|repeat|dobara|phir se|samjhao|explain)\b"
        r"|(?:क्या|क्यों|कैसे|किसलिए|दोबारा)",
        re.IGNORECASE,
    )

    def _get_entities_map(self, db_session: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        entities_map: Dict[str, Dict[str, Any]] = {}
        for row in db_session.get("entities", []):
            api_ent = _db_entity_to_api(row)
            entities_map[api_ent["id"]] = api_ent
        return entities_map

    def _next_unverified_target(self, entities_map: Dict[str, Dict[str, Any]], skip_id: Optional[str] = None) -> Optional[str]:
        # First check captured entities that are still pending/flagged/corrected
        for eid in ENTITY_ORDER:
            if eid == skip_id:
                continue
            ent = entities_map.get(eid)
            if ent and ent.get("value") and ent.get("status") != "verified":
                return eid
        # Next check uncaptured entities in priority order
        for eid in ENTITY_ORDER:
            if eid == skip_id:
                continue
            if eid not in entities_map or not entities_map[eid].get("value"):
                return eid
        return None

    async def process_turn(
        self,
        text: str,
        session_id: Optional[str] = None,
        active_target_id: Optional[str] = None,
        existing_entities: Optional[Dict[str, Any]] = None,
        acoustic_confidence: float = 90.0,
        officer_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Processes one complete customer turn in an automated verification conversation.
        Never marks newly extracted or corrected values as verified until explicitly affirmed.
        """
        clean_text = (text or "").strip()

        # 1. Ensure session exists in database (Single Source of Truth)
        db_session = db.ensure_session_exists(session_id, officer_id=officer_id)
        sid = db_session["id"]

        entities_map = self._get_entities_map(db_session)

        # Merge any initial client-supplied context ONLY for missing slots and NEVER trusted as verified
        if existing_entities:
            seed_batch = []
            for eid, val_obj in existing_entities.items():
                if eid in ENTITY_ORDER and isinstance(val_obj, dict) and val_obj.get("value") and eid not in entities_map:
                    safe_ent = dict(val_obj)
                    safe_ent["id"] = eid
                    safe_ent["entity_type"] = eid
                    safe_ent["status"] = "pending"
                    seed_batch.append(safe_ent)
            if seed_batch:
                db.upsert_entities(sid, seed_batch)
                db_session = db.get_session_by_id(sid)
                entities_map = self._get_entities_map(db_session)

        target_id = active_target_id or db_session.get("active_target_id")

        if not clean_text:
            prompt_id = target_id or self._next_unverified_target(entities_map) or "name"
            db.update_session(sid, {"active_target_id": prompt_id})
            return self._build_response(
                sid=sid,
                action="ask_entity",
                target_id=prompt_id,
                reply="Maaf kijiye, mujhe aapki aawaz saaf sunai nahi di. " + ENTITY_PROMPTS.get(prompt_id, "Kripya dobara bolein."),
                newly_extracted=[],
            )

        has_affirm = bool(self.AFFIRMATION_REGEX.search(clean_text))
        has_neg = bool(self.NEGATION_REGEX.search(clean_text))
        is_greeting = bool(self.GREETING_REGEX.match(clean_text))
        is_question = bool(self.QUESTION_REGEX.search(clean_text)) and not has_affirm

        # 2. Extract entities (broad scan first, then targeted fallback when expecting a specific slot)
        extracted = entity_extractor.extract_all_entities(clean_text, acoustic_confidence, target_id=None)

        if not extracted and target_id and not is_greeting and not is_question:
            # If waiting for confirmation of an entity and user only said Yes/No without data, don't force-parse Yes/No as a value
            target_has_value = bool(entities_map.get(target_id, {}).get("value"))
            pure_yes_or_no = (has_affirm or has_neg) and len(clean_text.split()) <= 3
            if not (target_has_value and pure_yes_or_no):
                extracted = entity_extractor.extract_all_entities(clean_text, acoustic_confidence, target_id=target_id)

        action = "ask_entity"
        next_target_id: Optional[str] = target_id
        reply_text = ""

        # CASE A: Explicit Negation / Correction of active target
        if has_neg and target_id and target_id in entities_map:
            prev_ent = entities_map[target_id]
            prev_val = prev_ent.get("value", "")
            prev_conf = float(prev_ent.get("confidence", 75.0))

            # Check if corrected value was spoken in the same utterance
            corrected_ent = next((e for e in extracted if e["id"] == target_id), None)
            if not corrected_ent:
                fallback_corr = entity_extractor.extract_all_entities(clean_text, acoustic_confidence, target_id=target_id)
                if fallback_corr:
                    corrected_ent = fallback_corr[0]

            if corrected_ent and corrected_ent["value"] and corrected_ent["value"] != prev_val:
                db.record_correction(
                    session_id=sid,
                    entity_id=target_id,
                    entity_type=target_id,
                    original_val=prev_val,
                    corrected_val=corrected_ent["value"],
                    original_conf=prev_conf,
                    corrected_conf=float(corrected_ent["confidence"]),
                )
                correction_learner.fit_from_logs()

                corrected_ent["status"] = "pending"
                corrected_ent["history"] = prev_ent.get("history", []) + [corrected_ent["value"]]
                db.upsert_entities(sid, [corrected_ent])

                readback = phonetic_engine.generate_readback_sentence(
                    corrected_ent["label"], corrected_ent["value"], corrected_ent["type"]
                )
                reply_text = f"Maaf kijiye, maine update kar diya hai. {readback}"
                action = "confirm_entity"
                next_target_id = target_id
                extracted = [corrected_ent]
            else:
                # Negation without replacement value yet: downgrade verified/pending -> corrected
                db_eid = f"{sid}__{target_id}"
                db.update_entity(db_eid, {"status": "corrected", "verified_at": None})
                label = prev_ent.get("label", ENTITY_LABELS.get(target_id, target_id))
                reply_text = f"Theek hai, koi baat nahi. Kripya apna sahi {label} dobara saaf-saaf batayein."
                action = "request_correction"
                next_target_id = target_id
                extracted = []

        # CASE B: Confirmation of active target (+ optional additional entities in the same sentence)
        elif has_affirm and not has_neg and target_id and target_id in entities_map and entities_map[target_id].get("value"):
            confirmed_ent = entities_map[target_id]
            db.record_confirmation(
                session_id=sid,
                entity_id=target_id,
                entity_type=target_id,
                confirmed_value=confirmed_ent["value"],
                confidence=confirmed_ent["confidence"],
            )
            entities_map[target_id]["status"] = "verified"

            # Check if the user also provided new entity(s) alongside saying "Yes"
            extra_entities = [e for e in extracted if e["id"] != target_id]
            if extra_entities:
                db.upsert_entities(sid, extra_entities)
                first_new = extra_entities[0]
                readback = phonetic_engine.generate_readback_sentence(
                    first_new["label"], first_new["value"], first_new["type"]
                )
                reply_text = f"Perfect, {confirmed_ent['label']} confirm ho gaya hai! {readback}"
                action = "confirm_entity"
                next_target_id = first_new["id"]
                extracted = extra_entities
            else:
                next_slot = self._next_unverified_target(entities_map, skip_id=target_id)
                if next_slot:
                    ent_existing = entities_map.get(next_slot)
                    if ent_existing and ent_existing.get("value"):
                        readback = phonetic_engine.generate_readback_sentence(
                            ent_existing["label"], ent_existing["value"], ent_existing["type"]
                        )
                        reply_text = f"Perfect, {confirmed_ent['label']} verify ho gaya! Ab agla detail check karte hain: {readback}"
                        action = "confirm_entity"
                    else:
                        reply_text = f"Bahut badhiya, {confirmed_ent['label']} confirm ho gaya hai! {ENTITY_PROMPTS[next_slot]}"
                        action = "ask_entity"
                    next_target_id = next_slot
                else:
                    summary_info = db.generate_verification_summary(sid)
                    db.update_session(sid, {"status": "Verified", "active_target_id": None})
                    reply_text = (
                        "Dhanyawad! Aapke saare KYC details successfully verify aur save ho gaye hain. "
                        "Aapka verification session complete ho chuka hai."
                    )
                    action = "all_confirmed"
                    next_target_id = None

        # CASE C: New Entities Captured (or implicit overwrite correction of same target)
        elif extracted:
            updated_batch = []
            correction_happened = False
            for ent in extracted:
                eid = ent["id"]
                existing = entities_map.get(eid)
                if existing and existing.get("value") and existing["value"] != ent["value"]:
                    # Customer corrected or updated an already-extracted value
                    db.record_correction(
                        session_id=sid,
                        entity_id=eid,
                        entity_type=eid,
                        original_val=existing["value"],
                        corrected_val=ent["value"],
                        original_conf=float(existing.get("confidence", 75.0)),
                        corrected_conf=float(ent["confidence"]),
                    )
                    correction_learner.fit_from_logs()
                    correction_happened = True

                # Enforce strict security rule: never verify on capture
                ent["status"] = "flagged" if ent.get("isUncertain") else "pending"
                updated_batch.append(ent)

            db.upsert_entities(sid, updated_batch)

            primary = updated_batch[0]
            readback = phonetic_engine.generate_readback_sentence(
                primary["label"], primary["value"], primary["type"]
            )
            if correction_happened:
                reply_text = f"Samajh gaya, maine detail update kar di hai. {readback}"
            elif primary.get("isUncertain"):
                reply_text = f"Aapki aawaz thodi unclear thi, kripya dhyan se sunein: {readback}"
            else:
                reply_text = readback

            action = "confirm_entity"
            next_target_id = primary["id"]

        # CASE D: Follow-up Question / Clarification
        elif is_question:
            prompt_slot = target_id or self._next_unverified_target(entities_map) or "name"
            next_hint = ENTITY_PROMPTS.get(prompt_slot, "")
            if "repeat" in clean_text.lower() or "dobara" in clean_text.lower() or "दोबारा" in clean_text:
                if target_id and target_id in entities_map and entities_map[target_id].get("value"):
                    ent = entities_map[target_id]
                    reply_text = phonetic_engine.generate_readback_sentence(ent["label"], ent["value"], ent["type"])
                else:
                    reply_text = f"Zaroor! {next_hint}"
            else:
                reply_text = (
                    "Ye details sirf aapki secure KYC aur identity verification ke liye verify ki ja rahi hain "
                    f"aur bina aapki confirmation ke save nahi hoti. {next_hint}"
                )
            action = "answer_question"
            next_target_id = prompt_slot

        # CASE E: Greeting or Fallback Clarification
        else:
            prompt_slot = target_id or self._next_unverified_target(entities_map) or "name"
            if is_greeting:
                reply_text = f"Namaste! Main EchoTrust AI Verification Officer hoon. {ENTITY_PROMPTS.get(prompt_slot, 'Kripya apna naam batayein.')}"
                action = "greeting"
            else:
                if target_id and target_id in entities_map and entities_map[target_id].get("value"):
                    ent = entities_map[target_id]
                    readback = phonetic_engine.generate_readback_sentence(ent["label"], ent["value"], ent["type"])
                    reply_text = f"Maine aapka input suna '{clean_text}'. {readback}"
                    action = "confirm_entity"
                    prompt_slot = target_id
                else:
                    reply_text = f"Maine suna: '{clean_text}'. {ENTITY_PROMPTS.get(prompt_slot, 'Kripya apna poora naam batayein.')}"
                    action = "ask_entity"
            next_target_id = prompt_slot

        # 3. Optional Real External LLM Naturalness Polish (when configured)
        dialogue_history = list(db_session.get("dialogue_log") or [])
        if llm_service.configured and action not in ("confirm_entity", "all_confirmed"):
            llm_out = await llm_service.analyze_and_respond(
                user_text=clean_text,
                dialogue_history=dialogue_history,
                entities_state=list(entities_map.values()),
                active_target_id=next_target_id,
                next_prompt_hint=reply_text,
            )
            if llm_out and llm_out.get("reply"):
                reply_text = llm_out["reply"]

        # 4. Persist dialogue turns & active target in Database
        db.append_dialogue_messages(
            sid,
            [
                {"sender": "customer", "text": clean_text},
                {"sender": "ai", "text": reply_text, "action": action, "target_id": next_target_id},
            ],
        )
        db.update_session(sid, {"active_target_id": next_target_id})
        summary = db.generate_verification_summary(sid)

        return self._build_response(
            sid=sid,
            action=action,
            target_id=next_target_id,
            reply=reply_text,
            newly_extracted=extracted,
            summary=summary,
        )

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
        entities_list = [_db_entity_to_api(e) for e in refreshed.get("entities", [])]
        entities_by_id = {e["id"]: e for e in entities_list}
        verified_count = sum(1 for e in entities_list if e.get("status") == "verified")
        pending_count = sum(1 for e in entities_list if e.get("status") != "verified")

        return {
            "session_id": sid,
            "session_status": refreshed.get("status", "In Progress"),
            "customer_id": refreshed.get("customer_id"),
            "customer_name": refreshed.get("customer_name"),
            "app_no": refreshed.get("app_no"),
            "intent": action,
            "action": action,
            "target_id": target_id,
            "active_target_id": target_id,
            "reply": reply,
            "extracted": newly_extracted,
            "entities": entities_by_id,
            "entities_list": entities_list,
            "verified_count": verified_count,
            "pending_count": pending_count,
            "total_target_entities": len(ENTITY_ORDER),
            "dialogue_log": refreshed.get("dialogue_log", []),
            "verification_summary": refreshed.get("verification_summary") or (summary or {}).get("summary_text", ""),
            "llm_provider": llm_service.provider if llm_service.configured else "bfsi-deterministic-nlu",
        }


conversation_agent = ConversationAgent()
