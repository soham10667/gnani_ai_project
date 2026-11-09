# VeriVoice – AI Read-Back Confirmation System

An enterprise-grade Banking and Insurance (BFSI) voice verification platform featuring acoustic entity extraction, ICAO/NATO phonetic read-back disambiguation, real-time waveform visualization, and human-in-the-loop correction learning.

---

## 🌟 Key Capabilities

1. **Microphone Voice Capture & Audio Visualizer**:
   - Web Audio API `AudioContext` & `AnalyserNode` driving a real-time 22-slot frequency waveform responding to live voice input and TTS playback.
   - Streaming audio capture via browser `MediaRecorder` with noise cancellation and pause/resume controls.

2. **Gnani AI Speech-to-Text Integration**:
   - Dedicated backend client (`backend/services/gnani_stt.py`) communicating with Gnani ASR clusters (`en-IN`, `hi-IN`).
   - Honest, clearly labeled mock mode with acoustic confidence scoring when API credentials are not set in `.env`.

3. **BFSI Rule-Based Entity Validation**:
   - Validates Indian BFSI standards for:
     - **Full Name**: Alphabetic validation, title recognition, minimum length KYC rules.
     - **Phone Number**: 10-digit Indian mobile validation with carrier prefix check (`6-9`) and dummy pattern detection.
     - **Residential Address**: Premise/street structure with 6-digit Indian postal PIN verification.
     - **Account Number**: 9 to 18-digit core banking account validation.
     - **Date of Birth**: KYC adulthood compliance check (Applicant age $\ge 18$).
     - **National ID / PAN**: Indian Income Tax PAN regex (`[A-Z]{5}[0-9]{4}[A-Z]`) and Aadhaar UID format.

4. **Phonetic Disambiguation Engine**:
   - Converts extracted entities into ICAO / NATO phonetic spelling (e.g., `R` $\to$ Romeo, `A` $\to$ Alpha) to prevent critical BFSI acoustic mix-ups (`B` vs `D` vs `P`).
   - Digit grouping for account and phone numbers.
   - Natural spoken confirmation synthesis with Web Speech API and backend TTS prompts.

5. **Yes / No Confirmation & Correction Workflow**:
   - **YES (Affirm)**: Records confirmed entity value and audit timestamp into PostgreSQL/SQLite, updates session progress.
   - **NO (Mismatch)**: Opens correction loop, accepts customer correction via speech or text, regenerates phonetic spelling, and synthesizes updated read-back.

6. **Correction Learning Engine**:
   - Logs original vs corrected values, acoustic confusions, character distances, and attempts.
   - Machine learning model detects acoustic confusion pairs (e.g., `0` vs `5`, `O` vs `C`, `1` vs `2`) to anticipate transcription risks.

7. **Database Architecture**:
   - Supabase PostgreSQL schema (`backend/schema.sql`) for `users`, `customers`, `verification_sessions`, `extracted_entities`, `entity_confirmations`, and `correction_logs`.
   - Dual-mode resilient database: automatically switches between Supabase and local SQLite with identical schemas.

---

## 🚀 Running the Project

### Frontend
- **Port**: `3000`
- **URL**: [http://localhost:3000](http://localhost:3000)
- **Start Command**: `npm run dev`

### Backend
- **Port**: `8000`
- **URL**: [http://localhost:8000](http://localhost:8000)
- **Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Start Command**: `python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload`

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env` to configure external credentials:

```bash
# Supabase PostgreSQL
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-key

# Gnani AI Speech-to-Text
GNANI_API_KEY=your_gnani_api_key
GNANI_TOKEN=your_gnani_token
GNANI_CUSTOMER_ID=ApexBank-BFSI
GNANI_LANG_CODE=en-IN
GNANI_STT_ENDPOINT=https://api.gnani.ai/asr
```

# gnani_ai_project
