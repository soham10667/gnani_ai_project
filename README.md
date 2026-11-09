# EchoTrust – AI Voice Verification & Trust Platform

> **Every Voice. Verified with Trust.**

EchoTrust is an enterprise-grade AI-powered voice verification platform designed to make voice interactions more accurate, reliable, and trustworthy through intelligent speech recognition, entity validation, and read-back confirmation.

---

## 🌟 Key Capabilities

1. **Microphone Voice Capture & Audio Visualizer**:
   - Web Audio API `AudioContext` & `AnalyserNode` driving a real-time 22-slot frequency waveform responding to live voice input and TTS playback.
   - Streaming audio capture via browser `MediaRecorder` with noise cancellation and pause/resume controls.

2. **EchoTrust Intelligent Speech Recognition**:
   - High-accuracy voice transcription client communicating with acoustic clusters (`en-IN`, `hi-IN`).
   - Clear diagnostic feedback with acoustic confidence scoring and automated fallback simulation mode when external keys are not configured.

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

7. **Dual-Mode Resilient Database**:
   - Supabase PostgreSQL schema (`backend/schema.sql`) for `users`, `customers`, `verification_sessions`, `extracted_entities`, `entity_confirmations`, and `correction_logs`.
   - Dual-mode resilient database: automatically switches between Supabase and local SQLite with identical schemas.

---

## 🚀 Running the Project

### One-Command Full Stack (Recommended)
Simply run:
```bash
npm run dev
```
This runs both the EchoTrust FastAPI Backend (`http://localhost:8000`) and the React Vite Frontend (`http://localhost:3000`) concurrently.

### Running Individually
- **Frontend Only**: `npm run dev:frontend` (Port 3000 -> [http://localhost:3000](http://localhost:3000))
- **Backend Only**: `npm run dev:backend` (Port 8000 -> [http://localhost:8000](http://localhost:8000), Docs at [http://localhost:8000/docs](http://localhost:8000/docs))

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env` to configure external credentials:

```bash
# Supabase PostgreSQL
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-or-service-key

# Speech-to-Text API Credentials
ECHOTRUST_API_KEY=your_api_key
ECHOTRUST_TOKEN=your_token
GNANI_CUSTOMER_ID=ApexBank-BFSI
GNANI_LANG_CODE=en-IN
GNANI_STT_ENDPOINT=https://api.vachana.ai/stt/v3
```
