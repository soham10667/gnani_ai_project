-- VeriVoice AI Read-Back Confirmation System Schema
-- For Supabase PostgreSQL / Standard PostgreSQL

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Users / Verification Officers
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    role TEXT DEFAULT 'Verification Officer',
    organization TEXT DEFAULT 'Apex Bank BFSI',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Customers
CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    application_no TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Verification Sessions
CREATE TABLE IF NOT EXISTS verification_sessions (
    id TEXT PRIMARY KEY,
    customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
    app_no TEXT NOT NULL,
    channel TEXT DEFAULT 'Inbound IVR', -- 'Inbound IVR', 'Agent Voice Stream', 'Web RTC'
    status TEXT DEFAULT 'In Progress', -- 'In Progress', 'Verified', 'Rejected', 'Action Required'
    entity_count INT DEFAULT 6,
    initial_conf NUMERIC(5, 2) DEFAULT 0.0,
    final_conf NUMERIC(5, 2) DEFAULT 0.0,
    corrections INT DEFAULT 0,
    duration_secs INT DEFAULT 0,
    officer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    dialogue_log JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Extracted Entities
CREATE TABLE IF NOT EXISTS extracted_entities (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES verification_sessions(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- 'name', 'phone', 'address', 'account', 'dob', 'id_doc'
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    confidence NUMERIC(5, 2) DEFAULT 0.0,
    status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'flagged', 'corrected'
    validation_status TEXT DEFAULT 'valid', -- 'valid', 'warning', 'invalid'
    validation_message TEXT DEFAULT '',
    phonetic_summary TEXT,
    phonetic_details JSONB DEFAULT '[]'::jsonb,
    history JSONB DEFAULT '[]'::jsonb,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Entity Confirmations Audit
CREATE TABLE IF NOT EXISTS entity_confirmations (
    id SERIAL PRIMARY KEY,
    session_id TEXT REFERENCES verification_sessions(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    confirmed_value TEXT NOT NULL,
    customer_affirmed BOOLEAN DEFAULT TRUE,
    confidence NUMERIC(5, 2) DEFAULT 0.0,
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Correction Logs (Used for audit & ML learning)
CREATE TABLE IF NOT EXISTS correction_logs (
    id SERIAL PRIMARY KEY,
    session_id TEXT REFERENCES verification_sessions(id) ON DELETE CASCADE,
    entity_id TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    original_value TEXT NOT NULL,
    corrected_value TEXT NOT NULL,
    original_conf NUMERIC(5, 2) DEFAULT 0.0,
    corrected_conf NUMERIC(5, 2) DEFAULT 0.0,
    attempts INT DEFAULT 1,
    character_distance INT DEFAULT 0,
    phonetic_mismatch_pair TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_sessions_customer ON verification_sessions(customer_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON verification_sessions(status);
CREATE INDEX IF NOT EXISTS idx_entities_session ON extracted_entities(session_id);
CREATE INDEX IF NOT EXISTS idx_corrections_type ON correction_logs(entity_type);

