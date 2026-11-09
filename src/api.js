// VeriVoice API Client Service
const API_BASE = 'http://localhost:8000/api';

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

export async function transcribeAudioBlob(audioBlob, sessionId = null, activeTargetId = null) {
  const formData = new FormData();
  const filename = audioBlob.type === 'audio/wav' ? 'mic_recording.wav' : 'mic_recording.webm';
  formData.append('audio', audioBlob, filename);
  if (sessionId) formData.append('session_id', sessionId);
  if (activeTargetId) formData.append('active_target_id', activeTargetId);

  const res = await fetch(`${API_BASE}/voice/transcribe`, {
    method: 'POST',
    body: formData
  });
  if (!res.ok) throw new Error(`Transcription error: ${res.statusText}`);
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

