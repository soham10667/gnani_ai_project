import difflib
import json
import sqlite3
import threading
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from backend.config import settings
from backend.logger import logger

try:
    from supabase import create_client, Client
    HAS_SUPABASE_LIB = True
except ImportError:
    HAS_SUPABASE_LIB = False


DEFAULT_FLOW_ENTITIES = ["name", "phone", "pan", "email", "pincode", "address"]


def compute_char_diff_ops(old_val: str, new_val: str) -> List[Dict[str, str]]:
    """Computes character-level diff ops ('equal', 'delete', 'insert', 'replace') for UI diff rendering."""
    old_s = str(old_val or "")
    new_s = str(new_val or "")
    if not old_s:
        return [{"op": "insert", "text": new_s}] if new_s else []
    matcher = difflib.SequenceMatcher(None, old_s, new_s)
    ops: List[Dict[str, str]] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            ops.append({"op": "equal", "text": new_s[j1:j2]})
        elif tag == "replace":
            ops.append({"op": "delete", "text": old_s[i1:i2]})
            ops.append({"op": "insert", "text": new_s[j1:j2]})
        elif tag == "delete":
            ops.append({"op": "delete", "text": old_s[i1:i2]})
        elif tag == "insert":
            ops.append({"op": "insert", "text": new_s[j1:j2]})
    return ops


class DatabaseManager:
    ALLOWED_SESSION_COLUMNS = {
        "customer_id", "app_no", "channel", "status", "call_status", "entity_count",
        "flow_entities", "phonetic_scheme", "initial_conf", "final_conf", "corrections",
        "duration_secs", "officer_id", "dialogue_log", "audit_trail",
        "verification_summary", "active_target_id", "last_ai_reply"
    }
    ALLOWED_ENTITY_COLUMNS = {
        "value", "confidence", "stt_confidence", "validator_confidence",
        "validation_passed", "failed_rule", "status", "validation_status",
        "validation_message", "phonetic_summary", "phonetic_details",
        "readback_text", "previous_value", "attempts", "failed_attempts",
        "was_corrected", "char_confidences", "diff_ops", "audio_clip_ref",
        "history", "verified_at"
    }

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or settings.SQLITE_DB_PATH
        self._write_lock = threading.Lock()
        self.use_supabase = False
        self.supabase: Optional[Any] = None

        if HAS_SUPABASE_LIB and settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                self.supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
                self.use_supabase = True
                logger.info("[DB] Connected to Supabase PostgreSQL Database.")
            except Exception as e:
                logger.warning(f"[DB] Supabase connection error: {e}. Falling back to SQLite.")
                self.use_supabase = False

        self._init_sqlite()
        self._seed_initial_data()

    def _get_sqlite_conn(self):
        conn = sqlite3.connect(self.db_path, timeout=15.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def check_health(self) -> Dict[str, Any]:
        try:
            with self._get_sqlite_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                cursor.fetchone()
                cursor.execute("SELECT COUNT(*) FROM verification_sessions")
                sess_count = cursor.fetchone()[0]
            return {
                "connected": True,
                "engine": "Supabase + SQLite" if self.use_supabase else "SQLite Local",
                "status": "Connected",
                "total_sessions": sess_count,
            }
        except Exception as e:
            logger.error(f"[DB] Health check failed: {e}")
            return {
                "connected": False,
                "engine": "SQLite",
                "status": "Error",
                "error": str(e),
            }

    def _init_sqlite(self):
        with self._write_lock, self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE,
                password_hash TEXT,
                role TEXT,
                organization TEXT,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS customers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                application_no TEXT,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS verification_sessions (
                id TEXT PRIMARY KEY,
                customer_id TEXT,
                app_no TEXT NOT NULL,
                channel TEXT,
                status TEXT,
                call_status TEXT DEFAULT 'Live',
                entity_count INT,
                flow_entities TEXT,
                phonetic_scheme TEXT DEFAULT 'indian',
                initial_conf REAL,
                final_conf REAL,
                corrections INT,
                duration_secs INT,
                officer_id TEXT,
                dialogue_log TEXT,
                audit_trail TEXT,
                verification_summary TEXT,
                active_target_id TEXT,
                last_ai_reply TEXT DEFAULT '',
                created_at TEXT,
                updated_at TEXT
            );

            CREATE TABLE IF NOT EXISTS extracted_entities (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                entity_type TEXT,
                label TEXT,
                value TEXT,
                confidence REAL,
                stt_confidence REAL DEFAULT 0.0,
                validator_confidence REAL DEFAULT 0.0,
                validation_passed INT DEFAULT 1,
                failed_rule TEXT DEFAULT '',
                status TEXT,
                validation_status TEXT,
                validation_message TEXT,
                phonetic_summary TEXT,
                phonetic_details TEXT,
                readback_text TEXT DEFAULT '',
                previous_value TEXT DEFAULT '',
                attempts INT DEFAULT 0,
                failed_attempts INT DEFAULT 0,
                was_corrected INT DEFAULT 0,
                char_confidences TEXT DEFAULT '[]',
                diff_ops TEXT DEFAULT '[]',
                audio_clip_ref TEXT DEFAULT '',
                history TEXT,
                verified_at TEXT,
                created_at TEXT
            );

            CREATE TABLE IF NOT EXISTS entity_confirmations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                entity_id TEXT,
                entity_type TEXT,
                confirmed_value TEXT,
                customer_affirmed INT,
                confidence REAL,
                confirmed_at TEXT
            );

            CREATE TABLE IF NOT EXISTS correction_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT,
                entity_id TEXT,
                entity_type TEXT,
                original_value TEXT,
                corrected_value TEXT,
                original_conf REAL,
                corrected_conf REAL,
                attempts INT,
                character_distance INT,
                phonetic_mismatch_pair TEXT,
                created_at TEXT
            );
            """)

            cursor.execute("PRAGMA table_info(users)")
            user_cols = [row[1] for row in cursor.fetchall()]
            if "password_hash" not in user_cols:
                cursor.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")

            cursor.execute("PRAGMA table_info(verification_sessions)")
            sess_cols = [row[1] for row in cursor.fetchall()]
            sess_migrations = {
                "verification_summary": "TEXT",
                "active_target_id": "TEXT",
                "flow_entities": "TEXT",
                "phonetic_scheme": "TEXT DEFAULT 'indian'",
                "call_status": "TEXT DEFAULT 'Live'",
                "audit_trail": "TEXT",
                "last_ai_reply": "TEXT DEFAULT ''",
            }
            for col, col_def in sess_migrations.items():
                if col not in sess_cols:
                    cursor.execute(f"ALTER TABLE verification_sessions ADD COLUMN {col} {col_def}")

            cursor.execute("PRAGMA table_info(extracted_entities)")
            ent_cols = [row[1] for row in cursor.fetchall()]
            ent_migrations = {
                "stt_confidence": "REAL DEFAULT 0.0",
                "validator_confidence": "REAL DEFAULT 0.0",
                "validation_passed": "INT DEFAULT 1",
                "failed_rule": "TEXT DEFAULT ''",
                "readback_text": "TEXT DEFAULT ''",
                "previous_value": "TEXT DEFAULT ''",
                "attempts": "INT DEFAULT 0",
                "failed_attempts": "INT DEFAULT 0",
                "was_corrected": "INT DEFAULT 0",
                "char_confidences": "TEXT DEFAULT '[]'",
                "diff_ops": "TEXT DEFAULT '[]'",
                "audio_clip_ref": "TEXT DEFAULT ''",
            }
            for col, col_def in ent_migrations.items():
                if col not in ent_cols:
                    cursor.execute(f"ALTER TABLE extracted_entities ADD COLUMN {col} {col_def}")

            demo_hash = "$2b$12$/fsqcwJxBPZRVdfZbt28t.8V7WncdoqCq532WW1.ajWfBhZQ0fSt6"
            cursor.execute(
                "UPDATE users SET password_hash = ? WHERE email = 'ananya.k@apexbank.in' AND (password_hash IS NULL OR password_hash = '')",
                (demo_hash,),
            )
            conn.commit()

    def _seed_initial_data(self):
        with self._write_lock, self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM users WHERE email = 'ananya.k@apexbank.in'")
            if cursor.fetchone()[0] == 0:
                now_str = datetime.now(timezone.utc).isoformat()
                demo_hash = "$2b$12$/fsqcwJxBPZRVdfZbt28t.8V7WncdoqCq532WW1.ajWfBhZQ0fSt6"
                cursor.execute(
                    "INSERT INTO users (id, name, email, password_hash, role, organization, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    ("USR-1", "Ananya Kapoor", "ananya.k@apexbank.in", demo_hash, "Senior Verification Officer", "Apex Bank BFSI", now_str),
                )

            cursor.execute("SELECT COUNT(*) FROM verification_sessions")
            if cursor.fetchone()[0] == 0:
                now_str = datetime.now(timezone.utc).isoformat()
                customers_data = [
                    ("CUST-7944", "Priya Narang", "9811223344", "priya.n@example.com", "INS-HLT-904", now_str),
                    ("CUST-7210", "Amitabh Sen", "9722334455", "amitabh.sen@example.com", "CC-PREM-412", now_str),
                    ("CUST-6891", "Sneha Kulkarni", "9633445566", "sneha.k@example.com", "MORTG-7721", now_str),
                ]
                cursor.executemany(
                    "INSERT OR IGNORE INTO customers VALUES (?, ?, ?, ?, ?, ?)", customers_data
                )

                flow_json = json.dumps(DEFAULT_FLOW_ENTITIES)
                sessions_data = [
                    ("SES-94811", "CUST-7944", "INS-HLT-904", "Agent Voice Stream", "Verified", "Ended", 6, flow_json, "indian", 94.0, 99.0, 0, 95, "USR-1", "[]", "[]", "All KYC details confirmed.", None, "", now_str, now_str),
                    ("SES-94808", "CUST-7210", "CC-PREM-412", "Inbound IVR", "Verified", "Ended", 6, flow_json, "indian", 72.0, 95.0, 2, 180, "USR-1", "[]", "[]", "Verified after phonetic correction loop.", None, "", now_str, now_str),
                    ("SES-94799", "CUST-6891", "MORTG-7721", "Web RTC", "Escalated", "Escalated", 6, flow_json, "indian", 58.0, 62.0, 2, 140, "USR-1", "[]", "[]", "Escalated after repeated mismatch.", None, "", now_str, now_str),
                ]
                cursor.executemany(
                    """
                    INSERT OR IGNORE INTO verification_sessions
                    (id, customer_id, app_no, channel, status, call_status, entity_count, flow_entities, phonetic_scheme, initial_conf, final_conf, corrections, duration_secs, officer_id, dialogue_log, audit_trail, verification_summary, active_target_id, last_ai_reply, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    sessions_data,
                )

                hist_entities = [
                    ("SES-94811__name", "SES-94811", "name", "Full Name", "Priya Narang", 99.0, 99.0, 96.0, 1, "", "confirmed", "valid", "Valid full name", "P se Pooja, R se Ram...", "[]", "", "", 1, 0, 0, "[]", "[]", "", '["Priya Narang"]', "09:30 AM", now_str),
                    ("SES-94811__phone", "SES-94811", "phone", "Phone Number", "9811223344", 98.0, 98.0, 97.0, 1, "", "confirmed", "valid", "Valid 10-digit mobile number", "9 8 1 1 2 2 3 3 4 4", "[]", "", "", 1, 0, 0, "[]", "[]", "", '["9811223344"]', "09:31 AM", now_str),
                    ("SES-94808__name", "SES-94808", "name", "Full Name", "Amitabh Sen", 95.0, 95.0, 96.0, 1, "", "confirmed", "valid", "Confirmed after correction", "A se Amit, M se Mohan...", "[]", "", "Amithab Sen", 2, 1, 1, "[]", "[]", "", '["Amithab Sen", "Amitabh Sen"]', "04:15 PM", now_str),
                    ("SES-94799__address", "SES-94799", "address", "Residential Address", "14 MG Road, Pune", 62.0, 62.0, 72.0, 1, "", "escalated", "warning", "Escalated after 3 failed attempts", "14 MG Road, Pune", "[]", "", "", 3, 3, 0, "[]", "[]", "", '["14 MG Road, Pune"]', None, now_str),
                ]
                cursor.executemany(
                    "INSERT OR IGNORE INTO extracted_entities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    hist_entities,
                )

                correction_seeds = [
                    ("SES-94808", "SES-94808__name", "name", "Amithab Sen", "Amitabh Sen", 72.0, 95.0, 1, 2, "th->t", now_str),
                    ("SES-94808", "SES-94808__pan", "pan", "ABODE1234F", "ABCDE1234F", 64.0, 94.0, 2, 1, "O->C", now_str),
                    ("SES-94808", "SES-94808__phone", "phone", "9722334450", "9722334455", 81.0, 96.0, 1, 1, "0->5", now_str),
                    ("SES-94799", "SES-94799__address", "address", "14 MG Road", "24 MG Road", 58.0, 64.0, 1, 1, "14->24", now_str),
                ]
                cursor.executemany(
                    "INSERT INTO correction_logs (session_id, entity_id, entity_type, original_value, corrected_value, original_conf, corrected_conf, attempts, character_distance, phonetic_mismatch_pair, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    correction_seeds,
                )

            conn.commit()

    @staticmethod
    def _safe_json_loads(raw: Any, fallback: Any):
        if raw is None or raw == "":
            return fallback
        if isinstance(raw, (list, dict)):
            return raw
        try:
            return json.loads(raw)
        except Exception:
            return fallback

    def compute_session_metrics(self, session_dict: Dict[str, Any]) -> Dict[str, Any]:
        flow = session_dict.get("flow_entities") or DEFAULT_FLOW_ENTITIES
        entities = [e for e in (session_dict.get("entities") or []) if (e.get("entity_type") or e.get("id")) in flow]
        total_fields = len(flow)
        confirmed = [e for e in entities if e.get("status") in ("confirmed", "verified")]
        escalated = [e for e in entities if e.get("status") == "escalated"]
        touched = [e for e in entities if int(e.get("attempts") or 0) > 0 or bool(e.get("value"))]
        corrected_fields = [e for e in entities if int(e.get("was_corrected") or 0) > 0]
        first_pass_confirmed = [
            e for e in confirmed
            if int(e.get("was_corrected") or 0) == 0 and int(e.get("failed_attempts") or 0) == 0
        ]

        resolved_or_attempted = [
            e for e in entities
            if e.get("status") in ("confirmed", "verified", "escalated", "corrected") or int(e.get("failed_attempts") or 0) > 0 or int(e.get("was_corrected") or 0) > 0
        ]
        denom_fp = max(len(resolved_or_attempted), len(confirmed))
        first_pass_accuracy = round((len(first_pass_confirmed) / denom_fp) * 100.0, 1) if denom_fp > 0 else 0.0

        captured_count = len([e for e in entities if e.get("value")])
        corr_rate_base = max(captured_count, len(touched))
        correction_rate = round((len(corrected_fields) / corr_rate_base) * 100.0, 1) if corr_rate_base > 0 else 0.0

        dialogue = session_dict.get("dialogue_log") or []
        customer_turns = sum(1 for m in dialogue if m.get("role") == "customer" or m.get("sender") == "customer")
        avg_turns_per_field = round(customer_turns / len(touched), 1) if touched else 0.0

        return {
            "confirmed_count": len(confirmed),
            "total_fields": total_fields,
            "first_pass_accuracy": first_pass_accuracy,
            "correction_rate": correction_rate,
            "corrections_count": int(session_dict.get("corrections") or 0),
            "avg_turns_per_field": avg_turns_per_field,
            "escalation_count": len(escalated),
        }

    # --- SESSIONS CRUD ---
    def get_sessions(self, search: str = "", status: str = "", channel: str = "", limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            query = """
                SELECT s.*, COALESCE(c.name, 'Pending Identification') as customer_name, COALESCE(c.id, s.customer_id) as customer_code
                FROM verification_sessions s
                LEFT JOIN customers c ON s.customer_id = c.id
                WHERE 1=1
            """
            params: List[Any] = []
            if search:
                query += " AND (s.id LIKE ? OR s.app_no LIKE ? OR c.name LIKE ? OR c.id LIKE ?)"
                like_term = f"%{search}%"
                params.extend([like_term, like_term, like_term, like_term])
            if status and status != "All Statuses":
                query += " AND s.status = ?"
                params.append(status)
            if channel and channel != "All Channels":
                query += " AND s.channel = ?"
                params.append(channel)

            query += " ORDER BY s.created_at DESC LIMIT ?"
            params.append(limit)

            cursor.execute(query, params)
            rows = []
            for row in cursor.fetchall():
                d = dict(row)
                d["dialogue_log"] = self._safe_json_loads(d.get("dialogue_log"), [])
                d["audit_trail"] = self._safe_json_loads(d.get("audit_trail"), [])
                d["flow_entities"] = self._safe_json_loads(d.get("flow_entities"), list(DEFAULT_FLOW_ENTITIES))
                d["phonetic_scheme"] = d.get("phonetic_scheme") or "indian"
                d["call_status"] = d.get("call_status") or ("Ended" if d.get("status") == "Verified" else "Live")
                rows.append(d)
            return rows

    def get_session_by_id(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT s.*, c.name as customer_name, c.id as customer_code, c.phone as customer_phone, c.email as customer_email
                FROM verification_sessions s
                LEFT JOIN customers c ON s.customer_id = c.id
                WHERE s.id = ?
            """, (session_id,))
            session_row = cursor.fetchone()
            if not session_row:
                return None

            session_dict = dict(session_row)
            session_dict["dialogue_log"] = self._safe_json_loads(session_dict.get("dialogue_log"), [])
            session_dict["audit_trail"] = self._safe_json_loads(session_dict.get("audit_trail"), [])
            session_dict["flow_entities"] = self._safe_json_loads(
                session_dict.get("flow_entities"), list(DEFAULT_FLOW_ENTITIES)
            )
            session_dict["phonetic_scheme"] = session_dict.get("phonetic_scheme") or "indian"
            session_dict["call_status"] = session_dict.get("call_status") or (
                "Escalated" if session_dict.get("status") == "Escalated"
                else "Ended" if session_dict.get("status") in ("Verified", "Ended")
                else "Live"
            )

            cursor.execute("SELECT * FROM extracted_entities WHERE session_id = ? ORDER BY created_at ASC", (session_id,))
            entities = []
            for er in cursor.fetchall():
                ed = dict(er)
                for jf in ("phonetic_details", "history", "char_confidences", "diff_ops"):
                    ed[jf] = self._safe_json_loads(ed.get(jf), [])
                ed["stt_confidence"] = float(ed.get("stt_confidence") or ed.get("confidence") or 0.0)
                ed["validator_confidence"] = float(ed.get("validator_confidence") or 0.0)
                ed["validation_passed"] = bool(ed.get("validation_passed", 1))
                ed["was_corrected"] = bool(ed.get("was_corrected", 0))
                ed["attempts"] = int(ed.get("attempts") or 0)
                ed["failed_attempts"] = int(ed.get("failed_attempts") or 0)
                entities.append(ed)
            session_dict["entities"] = entities
            session_dict["metrics"] = self.compute_session_metrics(session_dict)
            return session_dict

    def create_session(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        with self._write_lock, self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            now_str = datetime.now(timezone.utc).isoformat()
            sid = session_data.get("id") or f"SES-{uuid.uuid4().hex[:5].upper()}"
            cid = session_data.get("customer_id") or f"CUST-{uuid.uuid4().hex[:4].upper()}"
            cname = (session_data.get("customer_name") or "").strip() or "Pending Identification"
            app_no = session_data.get("app_no") or f"KYC-{datetime.now().year}-{sid[-4:]}"

            flow_entities = session_data.get("flow_entities") or list(DEFAULT_FLOW_ENTITIES)
            if isinstance(flow_entities, str):
                flow_entities = self._safe_json_loads(flow_entities, list(DEFAULT_FLOW_ENTITIES))
            scheme = (session_data.get("phonetic_scheme") or "indian").lower()
            if scheme not in ("indian", "nato"):
                scheme = "indian"

            cursor.execute("SELECT id FROM customers WHERE id = ?", (cid,))
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO customers (id, name, phone, email, application_no, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (cid, cname, "", "", app_no, now_str),
                )

            cursor.execute("""
                INSERT INTO verification_sessions
                (id, customer_id, app_no, channel, status, call_status, entity_count, flow_entities, phonetic_scheme, initial_conf, final_conf, corrections, duration_secs, officer_id, dialogue_log, audit_trail, verification_summary, active_target_id, last_ai_reply, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                sid,
                cid,
                app_no,
                session_data.get("channel", "Automated Voice Agent"),
                session_data.get("status", "In Progress"),
                session_data.get("call_status", "Live"),
                len(flow_entities),
                json.dumps(flow_entities),
                scheme,
                float(session_data.get("initial_conf", 0.0)),
                float(session_data.get("final_conf", 0.0)),
                0,
                0,
                session_data.get("officer_id", "USR-1"),
                json.dumps(session_data.get("dialogue_log", [])),
                json.dumps(session_data.get("audit_trail", [])),
                "Session initialized. Awaiting customer verification.",
                session_data.get("active_target_id") or (flow_entities[0] if flow_entities else "name"),
                "",
                now_str,
                now_str,
            ))
            conn.commit()
        return self.get_session_by_id(sid)

    def ensure_session_exists(self, session_id: Optional[str], officer_id: Optional[str] = None) -> Dict[str, Any]:
        if session_id:
            existing = self.get_session_by_id(session_id)
            if existing:
                return existing
        return self.create_session({"id": session_id, "officer_id": officer_id or "USR-1"})

    def update_session(self, session_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        safe_updates = {k: v for k, v in updates.items() if k in self.ALLOWED_SESSION_COLUMNS}
        if not safe_updates:
            return self.get_session_by_id(session_id)

        with self._write_lock, self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            set_clauses = []
            params = []
            for k, v in safe_updates.items():
                if k in ("dialogue_log", "audit_trail", "flow_entities") and isinstance(v, (list, dict)):
                    v = json.dumps(v)
                set_clauses.append(f"{k} = ?")
                params.append(v)
            set_clauses.append("updated_at = ?")
            params.append(datetime.now(timezone.utc).isoformat())
            params.append(session_id)

            cursor.execute(f"UPDATE verification_sessions SET {', '.join(set_clauses)} WHERE id = ?", params)
            conn.commit()
        return self.get_session_by_id(session_id)

    def append_dialogue_messages(self, session_id: str, messages: List[Dict[str, Any]]):
        session = self.get_session_by_id(session_id)
        if not session:
            return
        log = list(session.get("dialogue_log") or [])
        for msg in messages:
            entry = dict(msg)
            entry.setdefault("id", f"msg-{uuid.uuid4().hex[:8]}")
            entry.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
            if "role" not in entry:
                sender = entry.get("sender", "agent")
                entry["role"] = "agent" if sender in ("ai", "agent") else "customer"
            log.append(entry)
        self.update_session(session_id, {"dialogue_log": log})

    def append_audit_event(self, session_id: str, event: Dict[str, Any]):
        session = self.get_session_by_id(session_id)
        if not session:
            return
        trail = list(session.get("audit_trail") or [])
        item = dict(event)
        item.setdefault("id", f"aud-{uuid.uuid4().hex[:8]}")
        item.setdefault("timestamp", datetime.now(timezone.utc).isoformat())
        trail.append(item)
        self.update_session(session_id, {"audit_trail": trail})

    # --- ENTITIES CRUD ---
    def _resolve_db_entity_id(self, session_id: str, entity_id_or_type: str) -> str:
        if entity_id_or_type.startswith(f"{session_id}__") or entity_id_or_type.startswith("ent_"):
            return entity_id_or_type
        return f"{session_id}__{entity_id_or_type}"

    def update_entity(self, entity_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        safe_updates = {k: v for k, v in updates.items() if k in self.ALLOWED_ENTITY_COLUMNS}
        if not safe_updates:
            return None

        with self._write_lock, self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT value, status FROM extracted_entities WHERE id = ?", (entity_id,))
            existing = cursor.fetchone()
            if existing and existing["status"] in ("verified", "confirmed") and "value" in safe_updates:
                if safe_updates["value"] != existing["value"] and not updates.get("_correction_logged"):
                    raise ValueError("Cannot overwrite confirmed entity value without logging a correction event.")

            set_clauses = []
            params = []
            for k, v in safe_updates.items():
                if k in ("phonetic_details", "history", "char_confidences", "diff_ops") and isinstance(v, (list, dict)):
                    v = json.dumps(v)
                elif k in ("validation_passed", "was_corrected") and isinstance(v, bool):
                    v = 1 if v else 0
                set_clauses.append(f"{k} = ?")
                params.append(v)
            params.append(entity_id)
            cursor.execute(f"UPDATE extracted_entities SET {', '.join(set_clauses)} WHERE id = ?", params)
            conn.commit()
            cursor.execute("SELECT * FROM extracted_entities WHERE id = ?", (entity_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def upsert_entities(self, session_id: str, entities: List[Dict[str, Any]]):
        """
        Stores or updates extracted entities for a session.
        Strict Compliance Rules:
          1. NEVER marks newly extracted or unconfirmed data as 'confirmed' or 'verified'.
          2. NEVER overwrites an already-confirmed entity value unless '_correction_logged=True'.
        """
        with self._write_lock, self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            now_str = datetime.now(timezone.utc).isoformat()

            for ent in entities:
                etype = ent.get("entity_type") or ent.get("id") or "name"
                db_eid = self._resolve_db_entity_id(session_id, etype)
                val = str(ent.get("value", ""))

                cursor.execute(
                    "SELECT value, history, status, attempts, failed_attempts, was_corrected, previous_value FROM extracted_entities WHERE id = ?",
                    (db_eid,),
                )
                existing = cursor.fetchone()

                if existing and existing["status"] in ("confirmed", "verified") and existing["value"] != val:
                    if not ent.get("_correction_logged"):
                        raise ValueError(
                            f"Blocked overwriting confirmed entity '{etype}' without a logged correction event."
                        )

                raw_status = ent.get("status", "captured")
                safe_status = "readback_sent" if raw_status in ("verified", "confirmed") else raw_status

                hist_list = self._safe_json_loads(existing["history"] if existing else None, [])
                same_as_confirmed = bool(
                    existing and existing["status"] in ("confirmed", "verified") and existing["value"] == val
                )
                if val and (not hist_list or hist_list[-1] != val):
                    hist_list.append(val)

                if same_as_confirmed and not ent.get("_force_status"):
                    safe_status = existing["status"]

                phonetic_details = json.dumps(ent.get("phoneticDetails") or ent.get("phonetic_details") or [])
                char_confs = json.dumps(ent.get("charConfidences") or ent.get("char_confidences") or [])
                diff_ops = json.dumps(ent.get("diffOps") or ent.get("diff_ops") or [])

                stt_conf = float(ent.get("stt_confidence") if ent.get("stt_confidence") is not None else ent.get("confidence", 0.0))
                val_conf = float(ent.get("validator_confidence") if ent.get("validator_confidence") is not None else ent.get("confidence", 0.0))
                eff_conf = float(ent.get("confidence") if ent.get("confidence") is not None else min(stt_conf, val_conf))

                attempts = int(ent.get("attempts") if ent.get("attempts") is not None else ((existing["attempts"] if existing else 0) + 1))
                failed_attempts = int(ent.get("failed_attempts") if ent.get("failed_attempts") is not None else (existing["failed_attempts"] if existing else 0))
                was_corrected = 1 if (ent.get("was_corrected") or ent.get("wasCorrected") or (existing and existing["was_corrected"])) else 0
                prev_val = str(ent.get("previous_value") or ent.get("previousValue") or (existing["previous_value"] if existing else ""))
                readback_text = str(ent.get("readback_text") or ent.get("readbackText") or "")
                clip_ref = str(ent.get("audio_clip_ref") or ent.get("audioClipRef") or "")

                cursor.execute("""
                    INSERT INTO extracted_entities
                    (id, session_id, entity_type, label, value, confidence, stt_confidence, validator_confidence,
                     validation_passed, failed_rule, status, validation_status, validation_message,
                     phonetic_summary, phonetic_details, readback_text, previous_value, attempts, failed_attempts,
                     was_corrected, char_confidences, diff_ops, audio_clip_ref, history, verified_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        value = excluded.value,
                        confidence = excluded.confidence,
                        stt_confidence = excluded.stt_confidence,
                        validator_confidence = excluded.validator_confidence,
                        validation_passed = excluded.validation_passed,
                        failed_rule = excluded.failed_rule,
                        status = ?,
                        validation_status = excluded.validation_status,
                        validation_message = excluded.validation_message,
                        phonetic_summary = excluded.phonetic_summary,
                        phonetic_details = excluded.phonetic_details,
                        readback_text = CASE WHEN excluded.readback_text != '' THEN excluded.readback_text ELSE readback_text END,
                        previous_value = CASE WHEN excluded.previous_value != '' THEN excluded.previous_value ELSE previous_value END,
                        attempts = excluded.attempts,
                        failed_attempts = excluded.failed_attempts,
                        was_corrected = excluded.was_corrected,
                        char_confidences = excluded.char_confidences,
                        diff_ops = excluded.diff_ops,
                        audio_clip_ref = CASE WHEN excluded.audio_clip_ref != '' THEN excluded.audio_clip_ref ELSE audio_clip_ref END,
                        history = excluded.history,
                        verified_at = CASE WHEN ? IN ('confirmed', 'verified') THEN verified_at ELSE NULL END
                """, (
                    db_eid,
                    session_id,
                    etype,
                    ent.get("label", etype.title()),
                    val,
                    eff_conf,
                    stt_conf,
                    val_conf,
                    1 if ent.get("validationPassed", ent.get("validation_passed", True)) else 0,
                    str(ent.get("failedRule") or ent.get("failed_rule") or ""),
                    safe_status,
                    ent.get("validationStatus") or ent.get("validation_status") or "valid",
                    ent.get("validationMessage") or ent.get("validation_message") or "",
                    ent.get("phoneticSummary") or ent.get("phonetic_summary") or "",
                    phonetic_details,
                    readback_text,
                    prev_val,
                    attempts,
                    failed_attempts,
                    was_corrected,
                    char_confs,
                    diff_ops,
                    clip_ref,
                    json.dumps(hist_list),
                    None,
                    now_str,
                    safe_status,
                    safe_status,
                ))

            cursor.execute("SELECT AVG(confidence) FROM extracted_entities WHERE session_id = ?", (session_id,))
            avg_conf = cursor.fetchone()[0]
            if avg_conf is not None:
                cursor.execute(
                    """
                    UPDATE verification_sessions
                    SET initial_conf = CASE WHEN initial_conf <= 0 THEN ? ELSE initial_conf END,
                        final_conf = ?,
                        updated_at = ?
                    WHERE id = ?
                    """,
                    (round(avg_conf, 1), round(avg_conf, 1), now_str, session_id),
                )

            conn.commit()

    # --- CONFIRMATIONS & CORRECTIONS LOGGING ---
    def record_confirmation(self, session_id: str, entity_id: str, entity_type: str, confirmed_value: str, confidence: float):
        db_eid = self._resolve_db_entity_id(session_id, entity_type or entity_id)
        with self._write_lock, self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            now_str = datetime.now(timezone.utc).isoformat()
            time_now = datetime.now().strftime("%I:%M %p")

            cursor.execute("""
                INSERT INTO entity_confirmations (session_id, entity_id, entity_type, confirmed_value, customer_affirmed, confidence, confirmed_at)
                VALUES (?, ?, ?, ?, 1, ?, ?)
            """, (session_id, db_eid, entity_type, confirmed_value, float(confidence), now_str))

            cursor.execute("""
                UPDATE extracted_entities
                SET status = 'confirmed', value = ?, verified_at = ?
                WHERE id = ?
            """, (confirmed_value, time_now, db_eid))

            cursor.execute("SELECT customer_id FROM verification_sessions WHERE id = ?", (session_id,))
            srow = cursor.fetchone()
            if srow and srow["customer_id"]:
                cid = srow["customer_id"]
                if entity_type == "name":
                    cursor.execute("UPDATE customers SET name = ? WHERE id = ?", (confirmed_value, cid))
                elif entity_type == "phone":
                    cursor.execute("UPDATE customers SET phone = ? WHERE id = ?", (confirmed_value, cid))
                elif entity_type == "email":
                    cursor.execute("UPDATE customers SET email = ? WHERE id = ?", (confirmed_value, cid))

            conn.commit()

        self.generate_verification_summary(session_id)

    def record_correction(
        self,
        session_id: str,
        entity_id: str,
        entity_type: str,
        original_val: str,
        corrected_val: str,
        original_conf: float,
        corrected_conf: float,
        attempts: int = 1,
        mismatch_pair: Optional[str] = None,
    ):
        db_eid = self._resolve_db_entity_id(session_id, entity_type or entity_id)
        with self._write_lock, self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            now_str = datetime.now(timezone.utc).isoformat()

            def lev_dist(s1: str, s2: str) -> int:
                if len(s1) < len(s2):
                    return lev_dist(s2, s1)
                if len(s2) == 0:
                    return len(s1)
                prev = range(len(s2) + 1)
                for i, c1 in enumerate(s1):
                    curr = [i + 1]
                    for j, c2 in enumerate(s2):
                        curr.append(min(prev[j + 1] + 1, curr[j] + 1, prev[j] + (c1 != c2)))
                    prev = curr
                return prev[-1]

            dist = lev_dist(str(original_val), str(corrected_val))
            pair_label = mismatch_pair or f"{str(original_val)[:12]}->{str(corrected_val)[:12]}"

            cursor.execute("""
                INSERT INTO correction_logs
                (session_id, entity_id, entity_type, original_value, corrected_value, original_conf, corrected_conf, attempts, character_distance, phonetic_mismatch_pair, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                session_id, db_eid, entity_type,
                str(original_val), str(corrected_val),
                float(original_conf), float(corrected_conf),
                int(attempts), dist, pair_label, now_str,
            ))

            cursor.execute("""
                UPDATE verification_sessions
                SET corrections = COALESCE(corrections, 0) + 1, updated_at = ?
                WHERE id = ?
            """, (now_str, session_id))
            conn.commit()

    def get_correction_logs(self, limit: int = 200) -> List[Dict[str, Any]]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM correction_logs ORDER BY created_at DESC LIMIT ?", (limit,))
            rows = []
            for row in cursor.fetchall():
                d = dict(row)
                d["stt_confidence"] = float(d.get("original_conf") or 0.0)
                d["field_type"] = d.get("entity_type")
                d["timestamp"] = d.get("created_at")
                rows.append(d)
            return rows

    def generate_verification_summary(self, session_id: str) -> Dict[str, Any]:
        session = self.get_session_by_id(session_id)
        if not session:
            return {}

        flow = session.get("flow_entities") or list(DEFAULT_FLOW_ENTITIES)
        entities = [e for e in session.get("entities", []) if (e.get("entity_type") or e.get("id")) in flow]
        confirmed = [e for e in entities if e.get("status") in ("confirmed", "verified")]
        escalated = [e for e in entities if e.get("status") == "escalated"]
        pending_ids = [eid for eid in flow if eid not in {e.get("entity_type") or e.get("id") for e in confirmed + escalated}]

        avg_conf = round(sum(float(e.get("stt_confidence", 0.0)) for e in entities) / len(entities), 1) if entities else 0.0
        confirmed_summary = ", ".join([f"{e['label']}: {e['value']}" for e in confirmed]) or "None yet"

        new_status = session.get("status", "In Progress")
        new_call_status = session.get("call_status", "Live")
        if escalated:
            new_status = "Escalated"
            new_call_status = "Escalated"
        elif len(confirmed) >= len(flow) and len(flow) > 0:
            new_status = "Verified"
            new_call_status = "Ended"

        summary_text = (
            f"Confirmed ({len(confirmed)}/{len(flow)}): {confirmed_summary} | "
            f"Pending ({len(pending_ids)}) | Corrections: {session.get('corrections', 0)}"
        )

        self.update_session(
            session_id,
            {
                "status": new_status,
                "call_status": new_call_status,
                "final_conf": avg_conf,
                "verification_summary": summary_text,
            },
        )
        return {
            "session_id": session_id,
            "status": new_status,
            "call_status": new_call_status,
            "verified_count": len(confirmed),
            "pending_count": len(pending_ids),
            "average_confidence": avg_conf,
            "summary_text": summary_text,
        }

    # --- REAL BACKEND AGGREGATED ANALYTICS ---
    def get_dashboard_stats(self) -> Dict[str, Any]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()

            cursor.execute("SELECT COUNT(*) FROM verification_sessions")
            total_sessions = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM verification_sessions WHERE status = 'In Progress'")
            active_conversations = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM verification_sessions WHERE status = 'Verified'")
            completed_verifications = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM extracted_entities WHERE status NOT IN ('confirmed', 'verified', 'escalated')")
            pending_confirmations = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM verification_sessions WHERE status IN ('Rejected', 'Failed', 'Escalated')")
            failed_verifications = cursor.fetchone()[0]

            cursor.execute("SELECT COALESCE(SUM(corrections), 0) FROM verification_sessions")
            corrections_run = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM extracted_entities")
            total_entities = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM extracted_entities WHERE status IN ('confirmed', 'verified')")
            verified_entities = cursor.fetchone()[0]
            entity_accuracy = round((verified_entities / total_entities) * 100.0, 1) if total_entities > 0 else 0.0

            cursor.execute("SELECT AVG(confidence) FROM extracted_entities WHERE confidence > 0")
            avg_conf_raw = cursor.fetchone()[0]
            average_confidence = round(float(avg_conf_raw), 1) if avg_conf_raw is not None else 0.0

            cursor.execute("""
                SELECT s.*, COALESCE(c.name, 'Pending Identification') as customer, COALESCE(c.id, s.customer_id) as customerId
                FROM verification_sessions s
                LEFT JOIN customers c ON s.customer_id = c.id
                ORDER BY s.updated_at DESC LIMIT 8
            """)
            recent_sessions = []
            recent_conversations = []
            for row in cursor.fetchall():
                sd = dict(row)
                logs = self._safe_json_loads(sd.get("dialogue_log"), [])
                sd["dialogue_log"] = logs
                recent_sessions.append(sd)

                if logs:
                    last_msg = logs[-1]
                    recent_conversations.append({
                        "session_id": sd["id"],
                        "customer": sd["customer"],
                        "status": sd["status"],
                        "turns": len(logs),
                        "last_sender": last_msg.get("role") or last_msg.get("sender", "agent"),
                        "last_message": last_msg.get("text", ""),
                        "timestamp": last_msg.get("timestamp") or sd.get("updated_at"),
                        "confidence": sd.get("final_conf", 0.0),
                    })

            return {
                "total_sessions": total_sessions,
                "active_conversations": active_conversations,
                "completed_verifications": completed_verifications,
                "verified_sessions": completed_verifications,
                "pending_confirmations": pending_confirmations,
                "pending_sessions": active_conversations,
                "failed_verifications": failed_verifications,
                "entity_accuracy": entity_accuracy,
                "average_confidence": average_confidence,
                "accuracy_rate": average_confidence,
                "corrections_run": corrections_run,
                "total_entities": total_entities,
                "verified_entities": verified_entities,
                "recent_sessions": recent_sessions,
                "recent_conversations": recent_conversations[:6],
            }

    def get_real_chart_metrics(self) -> Dict[str, Any]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            entity_types = [
                ("name", "Full Name"),
                ("phone", "Phone Number"),
                ("pan", "PAN Card"),
                ("email", "Email Address"),
                ("pincode", "Pincode"),
                ("address", "Address"),
                ("amount", "Amount"),
                ("dob", "DOB"),
                ("account", "Bank Account"),
                ("id_doc", "National ID"),
            ]
            corrections_chart = []
            for etype, label in entity_types:
                cursor.execute("SELECT COUNT(*) FROM correction_logs WHERE entity_type = ?", (etype,))
                corr_cnt = cursor.fetchone()[0]
                cursor.execute("SELECT COUNT(*) FROM extracted_entities WHERE entity_type = ? AND status IN ('confirmed', 'verified')", (etype,))
                conf_cnt = cursor.fetchone()[0]
                corrections_chart.append({"entity": label, "corrections": corr_cnt, "autoConfirmed": conf_cnt})

            brackets = [
                ("Below 60%", "confidence < 60"),
                ("60-70%", "confidence >= 60 AND confidence < 70"),
                ("70-80%", "confidence >= 70 AND confidence < 80"),
                ("80-90%", "confidence >= 80 AND confidence < 90"),
                ("90-95%", "confidence >= 90 AND confidence < 95"),
                ("95-100%", "confidence >= 95"),
            ]
            conf_dist = []
            for label, cond in brackets:
                cursor.execute(f"SELECT COUNT(*) FROM extracted_entities WHERE {cond}")
                conf_dist.append({"bracket": label, "count": cursor.fetchone()[0]})

            return {
                "corrections_by_entity_chart": corrections_chart,
                "confidence_distribution_chart": conf_dist,
            }

    # --- USER AUTHENTICATION CRUD ---
    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE LOWER(email) = LOWER(?)", (email.strip(),))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_user_by_id(self, user_id: str) -> Optional[Dict[str, Any]]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def create_user(
        self,
        name: str,
        email: str,
        password_hash: str,
        role: str = "Verification Officer",
        organization: str = "Apex Bank BFSI",
    ) -> Dict[str, Any]:
        user_id = f"USR-{uuid.uuid4().hex[:8].upper()}"
        now_str = datetime.now(timezone.utc).isoformat()
        with self._write_lock, self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (id, name, email, password_hash, role, organization, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (user_id, name.strip(), email.strip().lower(), password_hash, role, organization, now_str),
            )
            conn.commit()
            return {
                "id": user_id,
                "name": name.strip(),
                "email": email.strip().lower(),
                "role": role,
                "organization": organization,
                "created_at": now_str,
            }


db = DatabaseManager()
