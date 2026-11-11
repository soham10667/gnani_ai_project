import json
import sqlite3
import threading
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.config import settings
from backend.logger import logger

try:
    from supabase import create_client, Client
    HAS_SUPABASE_LIB = True
except ImportError:
    HAS_SUPABASE_LIB = False


class DatabaseManager:
    ALLOWED_SESSION_COLUMNS = {
        "customer_id", "app_no", "channel", "status", "entity_count",
        "initial_conf", "final_conf", "corrections", "duration_secs",
        "officer_id", "dialogue_log", "verification_summary", "active_target_id"
    }
    ALLOWED_ENTITY_COLUMNS = {
        "value", "confidence", "status", "validation_status",
        "validation_message", "phonetic_summary", "phonetic_details",
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
                entity_count INT,
                initial_conf REAL,
                final_conf REAL,
                corrections INT,
                duration_secs INT,
                officer_id TEXT,
                dialogue_log TEXT,
                verification_summary TEXT,
                active_target_id TEXT,
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
                status TEXT,
                validation_status TEXT,
                validation_message TEXT,
                phonetic_summary TEXT,
                phonetic_details TEXT,
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

            # Safe schema migrations on existing databases
            cursor.execute("PRAGMA table_info(users)")
            user_cols = [row[1] for row in cursor.fetchall()]
            if "password_hash" not in user_cols:
                cursor.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")

            cursor.execute("PRAGMA table_info(verification_sessions)")
            sess_cols = [row[1] for row in cursor.fetchall()]
            if "verification_summary" not in sess_cols:
                cursor.execute("ALTER TABLE verification_sessions ADD COLUMN verification_summary TEXT")
            if "active_target_id" not in sess_cols:
                cursor.execute("ALTER TABLE verification_sessions ADD COLUMN active_target_id TEXT")

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
                now_str = datetime.now().isoformat()
                demo_hash = "$2b$12$/fsqcwJxBPZRVdfZbt28t.8V7WncdoqCq532WW1.ajWfBhZQ0fSt6"
                cursor.execute(
                    "INSERT INTO users (id, name, email, password_hash, role, organization, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    ("USR-1", "Ananya Kapoor", "ananya.k@apexbank.in", demo_hash, "Senior Verification Officer", "Apex Bank BFSI", now_str),
                )

            cursor.execute("SELECT COUNT(*) FROM verification_sessions")
            if cursor.fetchone()[0] == 0:
                now_str = datetime.now().isoformat()
                customers_data = [
                    ("CUST-8021", "Rahul Sharma", "9876543210", "rahul.s@example.com", "LOAN-2025-881", now_str),
                    ("CUST-7944", "Priya Narang", "9811223344", "priya.n@example.com", "INS-HLT-904", now_str),
                    ("CUST-7210", "Amitabh Sen", "9722334455", "amitabh.sen@example.com", "CC-PREM-412", now_str),
                    ("CUST-6891", "Sneha Kulkarni", "9633445566", "sneha.k@example.com", "MORTG-7721", now_str),
                ]
                cursor.executemany(
                    "INSERT OR IGNORE INTO customers VALUES (?, ?, ?, ?, ?, ?)", customers_data
                )

                sessions_data = [
                    ("SES-94811", "CUST-7944", "INS-HLT-904", "Agent Voice Stream", "Verified", 6, 94.0, 99.0, 0, 95, "USR-1", json.dumps([]), "All KYC details verified.", None, now_str, now_str),
                    ("SES-94808", "CUST-7210", "CC-PREM-412", "Inbound IVR", "Verified", 6, 72.0, 95.0, 2, 180, "USR-1", json.dumps([]), "Verified after phonetic correction loop.", None, now_str, now_str),
                    ("SES-94799", "CUST-6891", "MORTG-7721", "Web RTC", "Rejected", 6, 58.0, 62.0, 2, 140, "USR-1", json.dumps([]), "Flagged due to identity mismatch.", None, now_str, now_str),
                ]
                cursor.executemany(
                    """
                    INSERT OR IGNORE INTO verification_sessions
                    (id, customer_id, app_no, channel, status, entity_count, initial_conf, final_conf, corrections, duration_secs, officer_id, dialogue_log, verification_summary, active_target_id, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    sessions_data,
                )

                # Seed entities matching those 3 historical sessions accurately
                hist_entities = [
                    ("SES-94811__name", "SES-94811", "name", "Full Name", "Priya Narang", 99.0, "verified", "valid", "Valid BFSI name", "P-Papa, R-Romeo...", "[]", '["Priya Narang"]', "09:30 AM", now_str),
                    ("SES-94811__phone", "SES-94811", "phone", "Phone Number", "9811223344", 98.0, "verified", "valid", "Valid 10-digit Indian mobile", "9-8-1-1-2-2-3-3-4-4", "[]", '["9811223344"]', "09:31 AM", now_str),
                    ("SES-94808__name", "SES-94808", "name", "Full Name", "Amitabh Sen", 95.0, "verified", "valid", "Confirmed after correction", "A-Alpha, M-Mike...", "[]", '["Amithab Sen", "Amitabh Sen"]', "04:15 PM", now_str),
                    ("SES-94799__address", "SES-94799", "address", "Residential Address", "14 MG Road, Pune", 62.0, "flagged", "warning", "Unconfirmed low confidence", "14 MG Road", "[]", '["14 MG Road"]', None, now_str),
                ]
                cursor.executemany("INSERT OR IGNORE INTO extracted_entities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", hist_entities)

                correction_seeds = [
                    ("SES-94808", "SES-94808__name", "name", "Amithab Sen", "Amitabh Sen", 72.0, 95.0, 1, 1, "th->t", now_str),
                    ("SES-94808", "SES-94808__id_doc", "id_doc", "ABODE1234F", "ABCDE1234F", 64.0, 94.0, 2, 1, "O->C", now_str),
                    ("SES-94808", "SES-94808__phone", "phone", "9722334450", "9722334455", 81.0, 96.0, 1, 1, "0->5", now_str),
                    ("SES-94799", "SES-94799__address", "address", "14 MG Road", "24 MG Road", 58.0, 64.0, 1, 1, "14->24", now_str),
                ]
                cursor.executemany(
                    "INSERT INTO correction_logs (session_id, entity_id, entity_type, original_value, corrected_value, original_conf, corrected_conf, attempts, character_distance, phonetic_mismatch_pair, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    correction_seeds,
                )

            conn.commit()

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
                if d.get("dialogue_log"):
                    try:
                        d["dialogue_log"] = json.loads(d["dialogue_log"])
                    except Exception:
                        d["dialogue_log"] = []
                else:
                    d["dialogue_log"] = []
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
            if session_dict.get("dialogue_log"):
                try:
                    session_dict["dialogue_log"] = json.loads(session_dict["dialogue_log"])
                except Exception:
                    session_dict["dialogue_log"] = []
            else:
                session_dict["dialogue_log"] = []

            cursor.execute("SELECT * FROM extracted_entities WHERE session_id = ? ORDER BY created_at ASC", (session_id,))
            entities = []
            for er in cursor.fetchall():
                ed = dict(er)
                for jf in ("phonetic_details", "history"):
                    if ed.get(jf):
                        try:
                            ed[jf] = json.loads(ed[jf])
                        except Exception:
                            ed[jf] = []
                    else:
                        ed[jf] = []
                entities.append(ed)
            session_dict["entities"] = entities
            return session_dict

    def create_session(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        with self._write_lock, self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            now_str = datetime.now().isoformat()
            sid = session_data.get("id") or f"SES-{uuid.uuid4().hex[:5].upper()}"
            cid = session_data.get("customer_id") or f"CUST-{uuid.uuid4().hex[:4].upper()}"
            cname = (session_data.get("customer_name") or "").strip() or "New Applicant"
            app_no = session_data.get("app_no") or f"KYC-{datetime.now().year}-{sid[-4:]}"

            cursor.execute("SELECT id FROM customers WHERE id = ?", (cid,))
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO customers (id, name, phone, email, application_no, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                    (cid, cname, "", "", app_no, now_str),
                )

            cursor.execute("""
                INSERT INTO verification_sessions
                (id, customer_id, app_no, channel, status, entity_count, initial_conf, final_conf, corrections, duration_secs, officer_id, dialogue_log, verification_summary, active_target_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                sid,
                cid,
                app_no,
                session_data.get("channel", "Voice AI Agent"),
                session_data.get("status", "In Progress"),
                session_data.get("entity_count", 8),
                float(session_data.get("initial_conf", 0.0)),
                float(session_data.get("final_conf", 0.0)),
                0,
                0,
                session_data.get("officer_id", "USR-1"),
                json.dumps(session_data.get("dialogue_log", [])),
                "Session initialized. Awaiting verified customer entities.",
                session_data.get("active_target_id"),
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
                if k == "dialogue_log" and isinstance(v, (list, dict)):
                    v = json.dumps(v)
                set_clauses.append(f"{k} = ?")
                params.append(v)
            set_clauses.append("updated_at = ?")
            params.append(datetime.now().isoformat())
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
            entry.setdefault("timestamp", datetime.now().isoformat())
            log.append(entry)
        self.update_session(session_id, {"dialogue_log": log})

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
            set_clauses = []
            params = []
            for k, v in safe_updates.items():
                if k in ("phonetic_details", "history") and isinstance(v, (list, dict)):
                    v = json.dumps(v)
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
        Strict Compliance Rule: NEVER marks newly extracted or unconfirmed data as 'verified'.
        """
        with self._write_lock, self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            now_str = datetime.now().isoformat()

            for ent in entities:
                etype = ent.get("entity_type") or ent.get("id") or "alpha"
                db_eid = self._resolve_db_entity_id(session_id, etype)

                # Never persist 'verified' through generic extraction/upsert
                raw_status = ent.get("status", "pending")
                safe_status = "pending" if raw_status == "verified" else raw_status

                cursor.execute("SELECT history, status FROM extracted_entities WHERE id = ?", (db_eid,))
                existing = cursor.fetchone()
                hist_list = []
                if existing and existing["history"]:
                    try:
                        hist_list = json.loads(existing["history"])
                    except Exception:
                        hist_list = []
                val = str(ent.get("value", ""))
                same_as_verified = bool(
                    existing and existing["status"] == "verified" and hist_list and hist_list[-1] == val
                )
                if val and (not hist_list or hist_list[-1] != val):
                    hist_list.append(val)

                # Only keep 'verified' if this exact same value was ALREADY confirmed; never mark new/changed values verified automatically!
                if same_as_verified:
                    safe_status = "verified"

                phonetic_details = json.dumps(ent.get("phoneticDetails") or ent.get("phonetic_details") or [])

                cursor.execute("""
                    INSERT INTO extracted_entities
                    (id, session_id, entity_type, label, value, confidence, status, validation_status, validation_message, phonetic_summary, phonetic_details, history, verified_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        value = excluded.value,
                        confidence = excluded.confidence,
                        status = ?,
                        validation_status = excluded.validation_status,
                        validation_message = excluded.validation_message,
                        phonetic_summary = excluded.phonetic_summary,
                        phonetic_details = excluded.phonetic_details,
                        history = excluded.history,
                        verified_at = CASE WHEN ? = 'verified' THEN verified_at ELSE NULL END
                """, (
                    db_eid,
                    session_id,
                    etype,
                    ent.get("label", etype.title()),
                    val,
                    float(ent.get("confidence", 80.0)),
                    safe_status,
                    ent.get("validationStatus") or ent.get("validation_status") or "valid",
                    ent.get("validationMessage") or ent.get("validation_message") or "",
                    ent.get("phoneticSummary") or ent.get("phonetic_summary") or "",
                    phonetic_details,
                    json.dumps(hist_list),
                    None,
                    now_str,
                    safe_status,
                    safe_status,
                ))

            # Update session initial_conf/final_conf average
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
            now_str = datetime.now().isoformat()
            time_now = datetime.now().strftime("%I:%M %p")

            cursor.execute("""
                INSERT INTO entity_confirmations (session_id, entity_id, entity_type, confirmed_value, customer_affirmed, confidence, confirmed_at)
                VALUES (?, ?, ?, ?, 1, ?, ?)
            """, (session_id, db_eid, entity_type, confirmed_value, float(confidence), now_str))

            cursor.execute("""
                UPDATE extracted_entities
                SET status = 'verified', value = ?, confidence = MAX(confidence, ?), verified_at = ?
                WHERE id = ?
            """, (confirmed_value, max(float(confidence), 95.0), time_now, db_eid))

            # If customer confirmed full name / phone / email, sync confirmed customer metadata
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

        # Recompute verification summary and session metrics
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
    ):
        db_eid = self._resolve_db_entity_id(session_id, entity_type or entity_id)
        with self._write_lock, self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            now_str = datetime.now().isoformat()

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
            mismatch_pair = f"{str(original_val)[:10]}->{str(corrected_val)[:10]}"

            cursor.execute("""
                INSERT INTO correction_logs
                (session_id, entity_id, entity_type, original_value, corrected_value, original_conf, corrected_conf, attempts, character_distance, phonetic_mismatch_pair, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
            """, (session_id, db_eid, entity_type, str(original_val), str(corrected_val), float(original_conf), float(corrected_conf), dist, mismatch_pair, now_str))

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
            return [dict(row) for row in cursor.fetchall()]

    def generate_verification_summary(self, session_id: str) -> Dict[str, Any]:
        session = self.get_session_by_id(session_id)
        if not session:
            return {}

        entities = session.get("entities", [])
        verified = [e for e in entities if e.get("status") == "verified"]
        pending = [e for e in entities if e.get("status") != "verified"]

        avg_conf = round(sum(float(e.get("confidence", 0.0)) for e in entities) / len(entities), 1) if entities else 0.0
        verified_summary = ", ".join([f"{e['label']}: {e['value']}" for e in verified]) or "None yet"
        pending_summary = ", ".join([e['label'] for e in pending]) or "None"

        # Mark session Verified only when at least 1 entity verified and ALL captured entities in session are verified (and >=3 or all 8 if full flow)
        new_status = session.get("status", "In Progress")
        if verified and len(pending) == 0 and len(verified) >= 6:
            new_status = "Verified"

        summary_text = (
            f"Confirmed ({len(verified)}): {verified_summary} | "
            f"Pending ({len(pending)}): {pending_summary} | "
            f"Avg Confidence: {avg_conf}% | Corrections: {session.get('corrections', 0)}"
        )

        self.update_session(
            session_id,
            {
                "status": new_status,
                "final_conf": avg_conf,
                "verification_summary": summary_text,
            },
        )
        return {
            "session_id": session_id,
            "status": new_status,
            "verified_count": len(verified),
            "pending_count": len(pending),
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

            cursor.execute("SELECT COUNT(*) FROM extracted_entities WHERE status IN ('pending', 'flagged', 'corrected')")
            pending_confirmations = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM verification_sessions WHERE status IN ('Rejected', 'Failed')")
            failed_verifications = cursor.fetchone()[0]

            cursor.execute("SELECT COALESCE(SUM(corrections), 0) FROM verification_sessions")
            corrections_run = cursor.fetchone()[0]

            cursor.execute("SELECT COUNT(*) FROM extracted_entities")
            total_entities = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(*) FROM extracted_entities WHERE status = 'verified'")
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
                logs = []
                if sd.get("dialogue_log"):
                    try:
                        logs = json.loads(sd["dialogue_log"])
                    except Exception:
                        logs = []
                sd["dialogue_log"] = logs
                recent_sessions.append(sd)

                if logs:
                    last_msg = logs[-1]
                    recent_conversations.append({
                        "session_id": sd["id"],
                        "customer": sd["customer"],
                        "status": sd["status"],
                        "turns": len(logs),
                        "last_sender": last_msg.get("sender", "ai"),
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
                ("email", "Email Address"),
                ("address", "Address"),
                ("amount", "Amount"),
                ("dob", "DOB"),
                ("account", "Bank Account"),
                ("id_doc", "PAN / ID"),
            ]
            corrections_chart = []
            for etype, label in entity_types:
                cursor.execute("SELECT COUNT(*) FROM correction_logs WHERE entity_type = ?", (etype,))
                corr_cnt = cursor.fetchone()[0]
                cursor.execute("SELECT COUNT(*) FROM extracted_entities WHERE entity_type = ? AND status = 'verified'", (etype,))
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
        now_str = datetime.now().isoformat()
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
