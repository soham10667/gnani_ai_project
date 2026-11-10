// EchoTrust API Client Service
const API_BASE = 'http://localhost:8000/api';

// --- Authentication APIs ---
export async function loginAPI(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Invalid email or password');
  }
  return data;
}

export async function registerAPI(name, email, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || 'Registration failed');
  }
  return data;
}

export async function fetchCurrentUser(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  if (!res.ok) throw new Error('Session expired or invalid');
  return await res.json();
}

export async function fetchDashboardMetrics() {
  const res = await fetch(`${API_BASE}/analytics/dashboard`);
  if (!res.ok) throw new Error(`Dashboard API error: ${res.statusText}`);
  return await res.json();
}

export async function fetchDetailedAnalytics() {
  const res = await fetch(`${API_BASE}/analytics/summary`);
  if (!res.ok) throw new Error(`Analytics API error: ${res.statusText}`);
  return await res.json();
}

export async function fetchSessions({ search = '', status = '', channel = '' } = {}) {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status && status !== 'All Statuses') params.append('status', status);
  if (channel && channel !== 'All Channels') params.append('channel', channel);
  
  const res = await fetch(`${API_BASE}/sessions?${params.toString()}`);
  if (!res.ok) throw new Error(`Sessions API error: ${res.statusText}`);
  return await res.json();
}

export async function fetchSessionDetails(sessionId) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
  if (!res.ok) throw new Error(`Session details error: ${res.statusText}`);
  return await res.json();
}

export async function createSession(sessionData) {
  const res = await fetch(`${API_BASE}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionData)
  });
  if (!res.ok) throw new Error(`Create session error: ${res.statusText}`);
  return await res.json();
}

export async function updateSession(sessionId, updates) {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates)
  });
  if (!res.ok) throw new Error(`Update session error: ${res.statusText}`);
  return await res.json();
}

export async function transcribeAudioBlob(audioBlob, sessionId = null, activeTargetId = null, languageCode = 'hi-IN') {
  const formData = new FormData();
  const filename = audioBlob.type === 'audio/wav' ? 'mic_recording.wav' : 'mic_recording.webm';
  formData.append('audio', audioBlob, filename);
  if (sessionId) formData.append('session_id', sessionId);
  if (activeTargetId) formData.append('active_target_id', activeTargetId);
  if (languageCode) formData.append('language_code', languageCode);

  const res = await fetch(`${API_BASE}/voice/transcribe`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Transcription error: ${res.statusText} - ${errText}`);
  }
  return await res.json();
}

export async function processDialogueAPI(text, sessionId = null, activeTargetId = null) {
  const res = await fetch(`${API_BASE}/voice/process-dialogue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      session_id: sessionId,
      active_target_id: activeTargetId
    })
  });
  if (!res.ok) throw new Error(`Dialogue error: ${res.statusText}`);
  return await res.json();
}

export async function fetchVoiceStatusAPI() {
  const res = await fetch(`${API_BASE}/voice/status`);
  if (!res.ok) throw new Error(`Failed to fetch voice status: ${res.statusText}`);
  return await res.json();
}

export async function transcribeSampleAudioAPI(sessionId = null, activeTargetId = null) {
  const formData = new FormData();
  if (sessionId) formData.append('session_id', sessionId);
  if (activeTargetId) formData.append('active_target_id', activeTargetId);

  const res = await fetch(`${API_BASE}/voice/transcribe-sample`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error(`Sample audio error: ${res.statusText}`);
  return await res.json();
}

export function getTTSAudioUrl(text, voice = 'Shubham', model = 'timbre-v3.0', speed = 1.0) {
  const params = new URLSearchParams({
    text,
    voice,
    model,
    speed: speed.toString()
  });
  return `${API_BASE}/voice/tts?${params.toString()}`;
}

export async function synthesizeSpeechAPI(text, { voice = 'Shubham', model = 'timbre-v3.0', speed = 1.0 } = {}) {
  const res = await fetch(`${API_BASE}/voice/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice, model, speed })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`TTS API error: ${res.statusText} - ${errText}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function fetchTTSVoicesAPI() {
  const res = await fetch(`${API_BASE}/voice/tts/voices`);
  if (!res.ok) throw new Error(`Failed to fetch TTS voices: ${res.statusText}`);
  return await res.json();
}

export async function extractEntitiesFromText(text, sessionId = null, acousticConfidence = 92.0, activeTargetId = null) {
  const res = await fetch(`${API_BASE}/entities/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      session_id: sessionId,
      acoustic_confidence: acousticConfidence,
      active_target_id: activeTargetId
    })
  });
  if (!res.ok) throw new Error(`Extraction error: ${res.statusText}`);
  return await res.json();
}

export async function confirmEntityAPI(sessionId, entityId, entityType, confirmedValue, confidence = 96.0) {
  const res = await fetch(`${API_BASE}/entities/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      entity_id: entityId,
      entity_type: entityType,
      confirmed_value: confirmedValue,
      confidence
    })
  });
  if (!res.ok) throw new Error(`Confirmation error: ${res.statusText}`);
  return await res.json();
}

export async function correctEntityAPI(sessionId, entityId, entityType, originalValue, correctedValue, originalConfidence = 75.0) {
  const res = await fetch(`${API_BASE}/entities/correct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      entity_id: entityId,
      entity_type: entityType,
      original_value: originalValue,
      corrected_value: correctedValue,
      original_confidence: originalConfidence
    })
  });
  if (!res.ok) throw new Error(`Correction error: ${res.statusText}`);
  return await res.json();
}

export function downloadComplianceCSVUrl(search = '', status = '') {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (status && status !== 'All Statuses') params.append('status', status);
  return `${API_BASE}/analytics/export-csv?${params.toString()}`;
}

