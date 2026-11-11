import os
import sys
import time
import uuid
import pytest
from fastapi.testclient import TestClient

# Ensure repo root is importable
ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.main import app
from backend.database import db
from backend.services.gnani_stt import gnani_stt
from backend.services.tts_service import tts_service
from backend.services.llm_service import llm_service
from backend.services.entity_extractor import entity_extractor


client = TestClient(app)


@pytest.fixture(scope="module")
def auth_headers():
    """Registers a fresh test verification officer and returns real Bearer JWT headers."""
    unique_email = f"officer_{uuid.uuid4().hex[:8]}@echotrust.test"
    reg_payload = {
        "name": "Test Automation Officer",
        "email": unique_email,
        "password": "StrongTestPassword!123",
        "role": "Senior Verification Officer",
        "organization": "EchoTrust QA",
    }
    res_reg = client.post("/api/auth/register", json=reg_payload)
    assert res_reg.status_code in (200, 201), f"Registration failed: {res_reg.text}"

    res_login = client.post(
        "/api/auth/login",
        json={"email": unique_email, "password": "StrongTestPassword!123"},
    )
    assert res_login.status_code == 200, f"Login failed: {res_login.text}"
    token = res_login.json().get("access_token") or res_login.json().get("token")
    assert token, f"Missing JWT token in login response: {res_login.json()}"
    return {"Authorization": f"Bearer {token}"}


# 1. HEALTH CHECK & SERVICE TELEMETRY
def test_01_health_check_and_llm_status():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert data["backend"]["connected"] is True
    assert data["database"]["connected"] is True
    assert "stt" in data and "tts" in data and "llm" in data
    assert data["tts"]["voice"] == "Devansh"
    assert data["tts"]["model"] == "timbre-v3.0"
    assert data["stt"]["model"] == "prisma-v3.0"
    assert data["stt"]["language_code"] == "indic-auto"
    assert set(data["stt"]["language_candidates"]) >= {"hi-IN", "en-IN"}
    # LLM status honestly reflects configured vs Missing Credentials
    assert data["llm"]["configured"] == llm_service.configured


# 2. SECURITY & AUTHENTICATION ENFORCEMENT
def test_02_security_unauthenticated_blocked():
    for method, path in [
        ("GET", "/api/sessions/"),
        ("GET", "/api/analytics/dashboard"),
        ("GET", "/api/analytics/summary"),
        ("POST", "/api/entities/extract"),
        ("POST", "/api/voice/process-dialogue"),
    ]:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path, json={"text": "hello"})
        assert res.status_code == 401, f"Expected 401 on {method} {path}, got {res.status_code}"


# 3. ENTITY RECOGNITION: NAME, PHONE, ADDRESS, EMAIL, DATE, AMOUNT, ACCOUNT, PAN
def test_03_entity_recognition_all_bfsi_types():
    samples = [
        ("Mera naam Soham Sharma hai", "name", "Soham Sharma"),
        ("My phone number is 9876543210", "phone", "9876543210"),
        ("mera email soham dot sharma at gmail dot com hai", "email", "soham.sharma@gmail.com"),
        ("I stay at 24 MG Road, Pune, 411001", "address", "24 MG Road, Pune, 411001"),
        ("Loan amount is 50,000 rupees", "amount", "50,000"),
        ("My date of birth is 15 August 1998", "dob", "15/08/1998"),
        ("Account number 123456789012", "account", "123456789012"),
        ("Mera PAN card ABCD E1234F hai", "id_doc", "ABCDE1234F"),
    ]
    for utterance, expected_id, expected_substr in samples:
        ents = entity_extractor.extract_all_entities(utterance, acoustic_confidence=92.0)
        matched = [e for e in ents if e["id"] == expected_id]
        assert matched, f"Failed to extract {expected_id} from '{utterance}'; got {[e['id'] for e in ents]}"
        assert expected_substr.lower() in matched[0]["value"].lower(), (
            f"Expected '{expected_substr}' in {matched[0]['value']}"
        )
        # Strict security requirement: unconfirmed extractions must never start as 'verified'
        assert matched[0]["status"] != "verified"


# 3B. LLM ORCHESTRATION UNIT HOOK & HONEST REPORTING
def test_03b_llm_integration_and_honest_reporting(auth_headers, monkeypatch):
    # Verify honest status matches actual API key presence
    status = llm_service.get_status()
    assert status["has_external_llm_key"] == llm_service.configured

    # Verify conversation_agent awaits llm_service.analyze_and_respond when configured
    called = {"count": 0}

    async def fake_analyze(*args, **kwargs):
        called["count"] += 1
        return {
            "intent": "follow_up_question",
            "reply": "Hum aapki loan KYC ke liye naam aur number verify kar rahe hain. Kripya apna naam batayein.",
        }

    sess = client.post("/api/sessions/", headers=auth_headers, json={"customer_name": "LLM Hook Test"}).json()
    monkeypatch.setattr(llm_service, "configured", True)
    monkeypatch.setattr(llm_service, "provider", "gemini-mock-unit")
    monkeypatch.setattr(llm_service, "analyze_and_respond", fake_analyze)

    res = client.post(
        "/api/voice/process-dialogue",
        headers=auth_headers,
        json={"text": "Why do you need my details?", "session_id": sess["id"]},
    )
    assert res.status_code == 200
    assert called["count"] == 1
    assert "loan KYC" in res.json()["reply"]


# 4. REAL GNANI TTS API (TIMBRE v3.0: DEVANSH vs YASHRAJ)
def test_04_real_gnani_tts_devansh_and_yashraj(auth_headers):
    if not tts_service.is_configured:
        pytest.skip("GNANI_API_KEY not configured")

    res_voices = client.get("/api/voice/voices", headers=auth_headers)
    assert res_voices.status_code == 200
    assert res_voices.json()["default_voice"] == "Devansh"

    res_devansh = client.post(
        "/api/voice/tts",
        headers=auth_headers,
        json={
            "text": "Namaste! Main EchoTrust AI Verification Officer hoon. Kripya apna naam batayein.",
            "voice": "Devansh",
            "model": "timbre-v3.0",
        },
    )
    assert res_devansh.status_code == 200, f"Devansh TTS failed: {res_devansh.text}"
    assert res_devansh.content[:4] == b"RIFF", "Expected valid WAV header from Gnani TTS (Devansh)"
    assert len(res_devansh.content) > 4000

    res_yashraj = client.post(
        "/api/voice/tts",
        headers=auth_headers,
        json={
            "text": "Dhanyawad! Aapka phone number verify ho gaya hai.",
            "voice": "Yashraj",
            "model": "timbre-v3.0",
        },
    )
    assert res_yashraj.status_code == 200, f"Yashraj TTS failed: {res_yashraj.text}"
    assert res_yashraj.content[:4] == b"RIFF", "Expected valid WAV header from Gnani TTS (Yashraj)"
    assert len(res_yashraj.content) > 4000


# 5. REAL GNANI STT API: HINDI, ENGLISH, AND HINGLISH SPEECH (SEQUENTIAL)
def test_05_real_gnani_stt_hindi_english_hinglish(auth_headers):
    if not (gnani_stt.is_configured and tts_service.is_configured):
        pytest.skip("GNANI_API_KEY not configured")

    sess_res = client.post(
        "/api/sessions/",
        headers=auth_headers,
        json={"customer_name": "STT Multilingual Test", "channel": "Pytest Voice Suite"},
    )
    assert sess_res.status_code == 200
    sid = sess_res.json()["id"]

    cases = [
        ("hindi", "मेरा नाम सोहम शर्मा है और मेरा मोबाइल नंबर 9876543210 है।", "hi-IN", ["9876543210", "soham", "सोहम"]),
        ("english", "My email address is soham@example.com and amount is fifty thousand rupees.", "indic-auto", ["soham", "example", "50", "thousand"]),
        ("hinglish", "Mera PAN card ABCDE1234F hai aur address 24 MG Road Pune hai.", "indic-auto", ["pune", "mg road", "1234"]),
    ]

    for label, spoken_text, lang, expected_keywords in cases:
        wav_bytes = tts_service.synthesize(spoken_text, voice="Devansh", model="timbre-v3.0")
        assert wav_bytes[:4] == b"RIFF"

        res = client.post(
            "/api/voice/transcribe",
            headers=auth_headers,
            files={"audio": (f"{label}.wav", wav_bytes, "audio/wav")},
            data={"language": lang, "session_id": sid},
        )
        assert res.status_code == 200, f"STT ({label}) failed: {res.text}"
        body = res.json()
        transcript = body.get("transcript", "")
        assert transcript, f"Empty transcript for {label}"
        # Zero Telugu script tolerance in Hinglish/Hindi/English output
        assert not any("\u0C00" <= ch <= "\u0C7F" for ch in transcript), f"Telugu leakage detected: {transcript}"
        lower_t = transcript.lower()
        assert any(kw.lower() in lower_t for kw in expected_keywords), (
            f"Expected one of {expected_keywords} in {label} transcript: '{transcript}'"
        )
        # Respect Gnani 1 active STT request rate limit strictly between sequential calls
        time.sleep(1.6)


# 6. UNCONFIRMED ISOLATION + ENTITY CORRECTION + CONFIRMATION + DB PERSISTENCE
def test_06_multi_turn_verification_correction_and_database(auth_headers):
    res_sess = client.post(
        "/api/sessions/",
        headers=auth_headers,
        json={"customer_name": "Pending KYC Applicant", "channel": "Automated Voice Agent"},
    )
    assert res_sess.status_code == 200
    sid = res_sess.json()["id"]

    # Turn 1: Greeting
    t1 = client.post(
        "/api/voice/process-dialogue",
        headers=auth_headers,
        json={"text": "Namaste", "session_id": sid},
    ).json()
    assert t1["active_target_id"] == "name"

    # Turn 2: Name captured -> NOT verified yet
    t2 = client.post(
        "/api/voice/process-dialogue",
        headers=auth_headers,
        json={"text": "Mera naam Soham hai", "session_id": sid, "active_target_id": t1["active_target_id"]},
    ).json()
    assert t2["action"] == "confirm_entity"
    assert t2["entities"]["name"]["value"].lower() == "soham"
    assert t2["entities"]["name"]["status"] != "verified"

    # DB verification: unconfirmed entity must NEVER be saved as verified
    db_sess = db.get_session_by_id(sid)
    name_rows = [e for e in db_sess["entities"] if e["entity_type"] == "name"]
    assert len(name_rows) == 1
    assert name_rows[0]["status"] != "verified"

    # Turn 3: Vocal correction ("Nahi galat hai, mera naam Soham Sharma hai")
    t3 = client.post(
        "/api/voice/process-dialogue",
        headers=auth_headers,
        json={
            "text": "Nahi galat hai, mera naam Soham Sharma hai",
            "session_id": sid,
            "active_target_id": "name",
        },
    ).json()
    assert "Soham Sharma" in t3["entities"]["name"]["value"]
    assert t3["entities"]["name"]["status"] != "verified"  # Still unconfirmed after correction

    # Turn 4: Customer affirms ("Haan, bilkul sahi hai")
    t4 = client.post(
        "/api/voice/process-dialogue",
        headers=auth_headers,
        json={"text": "Haan, bilkul sahi hai", "session_id": sid, "active_target_id": "name"},
    ).json()
    assert t4["entities"]["name"]["status"] == "verified"
    assert t4["active_target_id"] == "phone"

    # Verify DB confirmation + correction logs persisted
    db_after = db.get_session_by_id(sid)
    assert db_after["corrections"] >= 1
    assert db_after["customer_name"] == "Soham Sharma"
    assert len(db_after["dialogue_log"]) >= 8

    # Complete remaining critical entities (Phone, Email, Address, Amount, DOB, Account, PAN)
    remaining_turns = [
        ("9876543210", "phone"),
        ("soham@example.com", "email"),
        ("24 MG Road, Pune, 411001", "address"),
        ("50000 rupees", "amount"),
        ("15 August 1998", "dob"),
        ("123456789012", "account"),
        ("ABCDE1234F", "id_doc"),
    ]
    current_target = t4["active_target_id"]
    for spoken, expected_id in remaining_turns:
        assert current_target == expected_id
        cap = client.post(
            "/api/voice/process-dialogue",
            headers=auth_headers,
            json={"text": spoken, "session_id": sid, "active_target_id": current_target},
        ).json()
        assert cap["entities"][expected_id]["status"] != "verified"

        conf = client.post(
            "/api/voice/process-dialogue",
            headers=auth_headers,
            json={"text": "Haan, bilkul sahi", "session_id": sid, "active_target_id": expected_id},
        ).json()
        assert conf["entities"][expected_id]["status"] == "verified"
        current_target = conf["active_target_id"]

    assert conf["action"] == "all_confirmed"
    assert conf["session_status"] == "Verified"
    assert conf["verified_count"] == 8
    final_db = db.get_session_by_id(sid)
    assert final_db["status"] == "Verified"
    assert "Confirmed (8)" in final_db["verification_summary"]


# 7. DASHBOARD REAL METRICS & ERROR MANAGEMENT
def test_07_dashboard_metrics_and_error_handling(auth_headers):
    dash = client.get("/api/analytics/dashboard", headers=auth_headers)
    assert dash.status_code == 200
    d = dash.json()
    for key in [
        "total_sessions",
        "active_conversations",
        "completed_verifications",
        "pending_confirmations",
        "failed_verifications",
        "entity_accuracy",
        "average_confidence",
        "recent_conversations",
        "services",
    ]:
        assert key in d, f"Missing dashboard metric: {key}"
    assert d["total_sessions"] >= 1
    assert d["services"]["database"]["connected"] is True

    # Empty audio upload -> explicit 400 error (not silent failure)
    bad_stt = client.post(
        "/api/voice/transcribe",
        headers=auth_headers,
        files={"audio": ("empty.wav", b"", "audio/wav")},
        data={"language": "indic-auto"},
    )
    assert bad_stt.status_code == 400

    # Empty TTS text -> explicit 422/400 validation error (no silent fake beep)
    bad_tts = client.post(
        "/api/voice/tts",
        headers=auth_headers,
        json={"text": ""},
    )
    assert bad_tts.status_code in (400, 422)
