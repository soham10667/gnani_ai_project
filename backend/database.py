import json
import sqlite3
from typing import List, Dict, Any, Optional
from datetime import datetime
from backend.config import settings

try:
    from supabase import create_client, Client
    HAS_SUPABASE_LIB = True
except ImportError:
    HAS_SUPABASE_LIB = False

class DatabaseManager:
    def __init__(self):
        self.use_supabase = False
        self.supabase: Optional[Any] = None
        
        if HAS_SUPABASE_LIB and settings.SUPABASE_URL and settings.SUPABASE_KEY:
            try:
                self.supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
                self.use_supabase = True
                print("Connected to Supabase PostgreSQL Database.")
            except Exception as e:
                print(f"Supabase connection error: {e}. Falling back to SQLite.")
                self.use_supabase = False
        
        # Always initialize SQLite database as resilient storage / fallback
        self._init_sqlite()
        self._seed_initial_data()

    def _get_sqlite_conn(self):
        conn = sqlite3.connect(settings.SQLITE_DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_sqlite(self):
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT,
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
            conn.commit()

    def _seed_initial_data(self):
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM verification_sessions")
            if cursor.fetchone()[0] == 0:
                now_str = datetime.now().isoformat()
                
                # Seed User
                cursor.execute(
                    "INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)",
                    ("USR-1", "Ananya Kapoor", "ananya.k@apexbank.in", "Senior Verification Officer", "Apex Bank BFSI", now_str)
                )
                
                # Seed Customers
                customers_data = [
                    ("CUST-8021", "Rahul Sharma", "9876543210", "rahul.s@example.com", "LOAN-2025-881", now_str),
                    ("CUST-7944", "Priya Narang", "9811223344", "priya.n@example.com", "INS-HLT-904", now_str),
                    ("CUST-7210", "Amitabh Sen", "9722334455", "amitabh.sen@example.com", "CC-PREM-412", now_str),
                    ("CUST-6891", "Sneha Kulkarni", "9633445566", "sneha.k@example.com", "MORTG-7721", now_str),
                    ("CUST-6502", "David George", "9544556677", "david.g@example.com", "SAV-ACC-119", now_str),
                ]
                cursor.executemany("INSERT INTO customers VALUES (?, ?, ?, ?, ?, ?)", customers_data)
                
                # Seed Sessions
                sessions_data = [
                    ("SES-94812", "CUST-8021", "LOAN-2025-881", "Inbound IVR", "In Progress", 6, 82.0, 96.0, 1, 132, "USR-1", json.dumps([]), now_str, now_str),
                    ("SES-94811", "CUST-7944", "INS-HLT-904", "Agent Voice Stream", "Verified", 5, 94.0, 99.0, 0, 95, "USR-1", json.dumps([]), now_str, now_str),
                    ("SES-94808", "CUST-7210", "CC-PREM-412", "Inbound IVR", "Verified", 6, 69.0, 95.0, 3, 210, "USR-1", json.dumps([]), now_str, now_str),
                    ("SES-94799", "CUST-6891", "MORTG-7721", "Web RTC", "Rejected", 6, 58.0, 64.0, 2, 140, "USR-1", json.dumps([]), now_str, now_str),
                    ("SES-94782", "CUST-6502", "SAV-ACC-119", "Inbound IVR", "Verified", 4, 91.0, 98.0, 0, 78, "USR-1", json.dumps([]), now_str, now_str),
                ]
                cursor.executemany("INSERT INTO verification_sessions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", sessions_data)

                # Seed Entities for SES-94812 (Rahul Sharma)
                entities_data = [
                    ("ent_name_1", "SES-94812", "name", "Full Name", "Rahul Sharma", 98.0, "verified", "valid", "Valid BFSI name", "R-Romeo, A-Alpha, H-Hotel, U-Uniform, L-Lima ...", json.dumps([]), json.dumps(["Rahul Sharma"]), "10:42 AM", now_str),
                    ("ent_phone_1", "SES-94812", "phone", "Phone Number", "9876543210", 92.0, "verified", "valid", "10-digit Indian mobile verified", "9-8-7-6-5-4-3-2-1-0 (Individual Digits)", json.dumps([]), json.dumps(["9876543210"]), "10:43 AM", now_str),
                    ("ent_address_1", "SES-94812", "address", "Residential Address", "24 MG Road, Pune, 411001", 76.0, "pending", "valid", "Recognized street and PIN 411001", "Flat 24, M-G Road, Pune, Pin 4-1-1-0-0-1", json.dumps([]), json.dumps(["24 MG Road, Pune, 411001"]), None, now_str),
                    ("ent_account_1", "SES-94812", "account", "Account Number", "123456789012", 65.0, "flagged", "valid", "12-digit standard savings format", "1-2-3-4-5-6-7-8-9-0-1-2", json.dumps([]), json.dumps(["123456789012"]), None, now_str),
                    ("ent_dob_1", "SES-94812", "dob", "Date of Birth", "15/08/2002", 99.0, "verified", "valid", "Age 23 - meets KYC adulthood requirement", "15th August, Year Two Thousand Two", json.dumps([]), json.dumps(["15/08/2002"]), "10:41 AM", now_str),
                    ("ent_id_1", "SES-94812", "id_doc", "National ID / PAN", "ABCDE1234F", 84.0, "pending", "valid", "Format matches Indian Income Tax PAN", "A-Alpha, B-Bravo, C-Charlie, D-Delta, E-Echo ...", json.dumps([]), json.dumps(["ABCDE1234F"]), None, now_str),
                ]
                cursor.executemany("INSERT INTO extracted_entities VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", entities_data)

                # Seed sample correction logs for ML model initialization
                correction_seeds = [
                    ("SES-94808", "ent_name_2", "name", "Amithab Sen", "Amitabh Sen", 72.0, 95.0, 1, 1, "th:t"),
                    ("SES-94808", "ent_id_2", "id_doc", "ABODE1234F", "ABCDE1234F", 64.0, 94.0, 2, 1, "O:C"),
                    ("SES-94808", "ent_phone_2", "phone", "9722334450", "9722334455", 81.0, 96.0, 1, 1, "0:5"),
                    ("SES-94799", "ent_address_3", "address", "14 MG Road", "24 MG Road", 58.0, 64.0, 1, 1, "14:24"),
                ]
                cursor.executemany(
                    "INSERT INTO correction_logs (session_id, entity_id, entity_type, original_value, corrected_value, original_conf, corrected_conf, attempts, character_distance, phonetic_mismatch_pair, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    [(s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7], s[8], s[9], now_str) for s in correction_seeds]
                )

                conn.commit()

    # --- SESSIONS CRUD ---
    def get_sessions(self, search: str = "", status: str = "", channel: str = "", limit: int = 50) -> List[Dict[str, Any]]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            query = """
                SELECT s.*, c.name as customer_name, c.id as customer_code
                FROM verification_sessions s
                LEFT JOIN customers c ON s.customer_id = c.id
                WHERE 1=1
            """
            params = []
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
            rows = cursor.fetchall()
            return [dict(row) for row in rows]

    def get_session_by_id(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT s.*, c.name as customer_name, c.id as customer_code, c.phone as customer_phone
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
                    
            # Get Entities
            cursor.execute("SELECT * FROM extracted_entities WHERE session_id = ?", (session_id,))
            entities_rows = cursor.fetchall()
            entities = []
            for er in entities_rows:
                ed = dict(er)
                if ed.get("phonetic_details"):
                    try:
                        ed["phonetic_details"] = json.loads(ed["phonetic_details"])
                    except Exception:
                        ed["phonetic_details"] = []
                if ed.get("history"):
                    try:
                        ed["history"] = json.loads(ed["history"])
                    except Exception:
                        ed["history"] = []
                entities.append(ed)
            session_dict["entities"] = entities
            return session_dict

    def create_session(self, session_data: Dict[str, Any]) -> Dict[str, Any]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            now_str = datetime.now().isoformat()
            sid = session_data.get("id") or f"SES-{int(datetime.now().timestamp()) % 100000}"
            cursor.execute("""
                INSERT INTO verification_sessions (id, customer_id, app_no, channel, status, entity_count, initial_conf, final_conf, corrections, duration_secs, dialogue_log, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                sid,
                session_data.get("customer_id", "CUST-8021"),
                session_data.get("app_no", f"LOAN-{datetime.now().year}-{sid[-4:]}"),
                session_data.get("channel", "Inbound IVR"),
                session_data.get("status", "In Progress"),
                session_data.get("entity_count", 6),
                session_data.get("initial_conf", 80.0),
                session_data.get("final_conf", 80.0),
                0,
                0,
                json.dumps(session_data.get("dialogue_log", [])),
                now_str,
                now_str
            ))
            conn.commit()
            return self.get_session_by_id(sid)

    def update_session(self, session_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            set_clauses = []
            params = []
            for k, v in updates.items():
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

    # --- ENTITIES CRUD ---
    def update_entity(self, entity_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            set_clauses = []
            params = []
            for k, v in updates.items():
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
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            now_str = datetime.now().isoformat()
            for ent in entities:
                eid = ent.get("id") or f"ent_{ent.get('entity_type', 'gen')}_{int(datetime.now().timestamp()) % 10000}"
                history = json.dumps(ent.get("history", [ent.get("value", "")]))
                phonetic_details = json.dumps(ent.get("phonetic_details", []))
                
                cursor.execute("""
                    INSERT INTO extracted_entities (id, session_id, entity_type, label, value, confidence, status, validation_status, validation_message, phonetic_summary, phonetic_details, history, verified_at, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        value = excluded.value,
                        confidence = excluded.confidence,
                        status = excluded.status,
                        validation_status = excluded.validation_status,
                        validation_message = excluded.validation_message,
                        phonetic_summary = excluded.phonetic_summary,
                        phonetic_details = excluded.phonetic_details,
                        history = excluded.history,
                        verified_at = excluded.verified_at
                """, (
                    eid,
                    session_id,
                    ent.get("entity_type", "alpha"),
                    ent.get("label", "Entity"),
                    ent.get("value", ""),
                    ent.get("confidence", 80.0),
                    ent.get("status", "pending"),
                    ent.get("validation_status", "valid"),
                    ent.get("validation_message", ""),
                    ent.get("phonetic_summary", ""),
                    phonetic_details,
                    history,
                    ent.get("verified_at"),
                    now_str
                ))
            conn.commit()

    # --- CONFIRMATIONS & CORRECTIONS LOGGING ---
    def record_confirmation(self, session_id: str, entity_id: str, entity_type: str, confirmed_value: str, confidence: float):
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            now_str = datetime.now().isoformat()
            cursor.execute("""
                INSERT INTO entity_confirmations (session_id, entity_id, entity_type, confirmed_value, customer_affirmed, confidence, confirmed_at)
                VALUES (?, ?, ?, ?, 1, ?, ?)
            """, (session_id, entity_id, entity_type, confirmed_value, confidence, now_str))
            
            # Update entity status in extracted_entities
            time_now = datetime.now().strftime("%I:%M %p")
            cursor.execute("""
                UPDATE extracted_entities
                SET status = 'verified', confidence = MAX(confidence, 96.0), verified_at = ?
                WHERE id = ?
            """, (time_now, entity_id))
            
            # Update verification_sessions final_conf
            cursor.execute("""
                UPDATE verification_sessions
                SET final_conf = (
                    SELECT AVG(confidence) FROM extracted_entities WHERE session_id = ?
                ),
                updated_at = ?
                WHERE id = ?
            """, (session_id, now_str, session_id))
            conn.commit()

    def record_correction(self, session_id: str, entity_id: str, entity_type: str, original_val: str, corrected_val: str, original_conf: float, corrected_conf: float):
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            now_str = datetime.now().isoformat()
            
            # Simple Levenshtein distance
            def lev_dist(s1, s2):
                if len(s1) < len(s2):
                    return lev_dist(s2, s1)
                if len(s2) == 0:
                    return len(s1)
                previous_row = range(len(s2) + 1)
                for i, c1 in enumerate(s1):
                    current_row = [i + 1]
                    for j, c2 in enumerate(s2):
                        insertions = previous_row[j + 1] + 1
                        deletions = current_row[j] + 1
                        substitutions = previous_row[j] + (c1 != c2)
                        current_row.append(min(insertions, deletions, substitutions))
                    previous_row = current_row
                return previous_row[-1]
            
            dist = lev_dist(original_val, corrected_val)
            mismatch_pair = f"{original_val[:8]}->{corrected_val[:8]}"
            
            cursor.execute("""
                INSERT INTO correction_logs (session_id, entity_id, entity_type, original_value, corrected_value, original_conf, corrected_conf, attempts, character_distance, phonetic_mismatch_pair, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
            """, (session_id, entity_id, entity_type, original_val, corrected_val, original_conf, corrected_conf, dist, mismatch_pair, now_str))
            
            # Increment session corrections counter
            cursor.execute("""
                UPDATE verification_sessions
                SET corrections = corrections + 1, updated_at = ?
                WHERE id = ?
            """, (now_str, session_id))
            conn.commit()

    def get_correction_logs(self, limit: int = 200) -> List[Dict[str, Any]]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM correction_logs ORDER BY created_at DESC LIMIT ?", (limit,))
            return [dict(row) for row in cursor.fetchall()]

    # --- AGGREGATED ANALYTICS ---
    def get_dashboard_stats(self) -> Dict[str, Any]:
        with self._get_sqlite_conn() as conn:
            cursor = conn.cursor()
            
            # Total Sessions
            cursor.execute("SELECT COUNT(*) FROM verification_sessions")
            total_sessions = cursor.fetchone()[0]
            
            # Verified Sessions
            cursor.execute("SELECT COUNT(*) FROM verification_sessions WHERE status = 'Verified'")
            verified_sessions = cursor.fetchone()[0]
            
            # Pending / In Progress
            cursor.execute("SELECT COUNT(*) FROM verification_sessions WHERE status IN ('In Progress', 'Pending')")
            pending_sessions = cursor.fetchone()[0]
            
            # Total Corrections
            cursor.execute("SELECT COALESCE(SUM(corrections), 0) FROM verification_sessions")
            corrections_run = cursor.fetchone()[0]
            
            # Average accuracy rate
            cursor.execute("SELECT COALESCE(AVG(final_conf), 96.5) FROM verification_sessions WHERE status = 'Verified'")
            avg_accuracy = round(cursor.fetchone()[0], 1)
            
            # Recent sessions list
            cursor.execute("""
                SELECT s.*, c.name as customer, c.id as customerId
                FROM verification_sessions s
                LEFT JOIN customers c ON s.customer_id = c.id
                ORDER BY s.created_at DESC LIMIT 6
            """)
            recent_sessions = [dict(row) for row in cursor.fetchall()]
            
            return {
                "total_sessions": total_sessions,
                "verified_sessions": verified_sessions,
                "pending_sessions": pending_sessions,
                "corrections_run": corrections_run,
                "accuracy_rate": avg_accuracy,
                "recent_sessions": recent_sessions
            }

db = DatabaseManager()

