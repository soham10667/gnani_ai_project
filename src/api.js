const API_BASE = '/api';

export function getStoredToken() {
  return (
    localStorage.getItem('echotrust_token') ||
    sessionStorage.getItem('echotrust_token') ||
    ''
  );
}

export function clearStoredAuth() {
  localStorage.removeItem('echotrust_token');
  localStorage.removeItem('echotrust_user');
  sessionStorage.removeItem('echotrust_token');
  sessionStorage.removeItem('echotrust_user');
}

async function parseErrorDetail(res, fallback) {
  try {
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (data?.detail) {
        return typeof data.detail === 'string'
          ? data.detail
          : JSON.stringify(data.detail);
      }
      if (data?.message) return data.message;
    } else {
      const txt = await res.text();
      if (txt) return txt.slice(0, 240);
    }
  } catch {
    // ignore parse failure
  }
  return fallback || `HTTP ${res.status} Error`;
}

export async function authFetch(path, options = {}) {
  const token = options.tokenOverride || getStoredToken();
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (networkErr) {
    throw new Error(
      `Network error connecting to EchoTrust backend (${networkErr?.message || 'connection refused'})`
    );
  }

  if (res.status === 401 && !options.skipAuthReset) {
    clearStoredAuth();
    window.dispatchEvent(new CustomEvent('echotrust:unauthorized'));
  }

  return res;
}

// --- HEALTH & SYSTEM DIAGNOSTICS ---
export async function fetchHealthAPI() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    return {
      status: 'offline',
      backend: { status: 'Offline', connected: false, error: err?.message },
      database: { status: 'Unknown', connected: false },
      stt: { status: 'Unknown', connected: false },
      tts: { status: 'Unknown', connected: false },
      llm: { status: 'Unknown', connected: false },
    };
  }
}

// --- AUTHENTICATION APIs ---
export async function loginAPI(email, password) {
  const res = await authFetch('/auth/login', {
    method: 'POST',
    skipAuthReset: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, 'Invalid email or password'));
  }
  return res.json();
}

export async function registerAPI(name, email, password, role, organization) {
  const res = await authFetch('/auth/register', {
    method: 'POST',
    skipAuthReset: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, role, organization }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, 'Registration failed'));
  }
  return res.json();
}

export async function fetchCurrentUser(token) {
  const res = await authFetch('/auth/me', {
    tokenOverride: token,
    skipAuthReset: true,
  });
  if (!res.ok) throw new Error('Invalid or expired session token');
  return res.json();
}

// --- DASHBOARD & ANALYTICS APIs ---
export async function fetchDashboardStats() {
  const res = await authFetch('/analytics/dashboard');
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to load dashboard stats'));
  return res.json();
}

export async function fetchAnalyticsSummary() {
  const res = await authFetch('/analytics/summary');
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to fetch analytics summary'));
  return res.json();
}

export async function fetchCorrectionLogs() {
  const res = await authFetch('/analytics/correction-logs');
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to fetch correction logs'));
  return res.json();
}

// --- SESSIONS APIs ---
export async function fetchSessions(searchOrOpts = '', status = '', channel = '') {
  const opts =
    searchOrOpts && typeof searchOrOpts === 'object'
      ? searchOrOpts
      : { search: searchOrOpts, status, channel };

  const params = new URLSearchParams();
  if (opts.search) params.append('search', opts.search);
  if (opts.status && opts.status !== 'All Statuses') params.append('status', opts.status);
  if (opts.channel && opts.channel !== 'All Channels') params.append('channel', opts.channel);

  const res = await authFetch(`/sessions/?${params.toString()}`);
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to load verification sessions'));
  return res.json();
}

export async function fetchSessionById(sessionId) {
  const res = await authFetch(`/sessions/${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Session not found'));
  return res.json();
}

export async function createSession(sessionData = {}) {
  const res = await authFetch('/sessions/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sessionData),
  });
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to create verification session'));
  return res.json();
}

export async function updateSession(sessionId, updates) {
  const res = await authFetch(`/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to update verification session'));
  return res.json();
}

// --- ENTITIES APIs ---
export async function extractEntitiesAPI(text, confidence = 90.0, targetId = null) {
  const res = await authFetch('/entities/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      acoustic_confidence: confidence,
      target_entity_id: targetId,
    }),
  });
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Entity extraction failed'));
  return res.json();
}

export async function confirmEntityAPI(
  sessionId,
  entityId,
  entityType,
  confirmedValue,
  confidence,
  manualFallback = true
) {
  const res = await authFetch('/entities/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      entity_id: entityId,
      entity_type: entityType,
      confirmed_value: confirmedValue,
      confidence,
      manual_fallback: manualFallback,
    }),
  });
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Entity confirmation failed'));
  return res.json();
}

export async function correctEntityAPI(
  sessionId,
  entityId,
  entityType,
  originalValue,
  correctedValue,
  origConf,
  corrConf
) {
  const res = await authFetch('/entities/correct', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      entity_id: entityId,
      entity_type: entityType,
      original_value: originalValue,
      corrected_value: correctedValue,
      original_conf: origConf,
      corrected_conf: corrConf,
    }),
  });
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Entity correction failed'));
  return res.json();
}

// --- VOICE, STT, TTS & DIALOGUE APIs ---
export async function fetchVoiceStatusAPI() {
  try {
    const res = await authFetch('/voice/status');
    if (res.ok) return await res.json();
  } catch {
    // ignore and fallback to public health endpoint
  }
  const health = await fetchHealthAPI();
  return {
    stt: health?.stt || {},
    tts: health?.tts || {},
    llm: health?.llm || {},
    database: health?.database || {},
  };
}

export async function transcribeAudioBlob(
  audioBlob,
  sessionIdOrFilename = null,
  targetId = null,
  language = 'indic-auto',
  previousText = null,
  phoneticScheme = null
) {
  const filename =
    sessionIdOrFilename && typeof sessionIdOrFilename === 'string' && sessionIdOrFilename.includes('.')
      ? sessionIdOrFilename
      : 'recording.wav';
  const sessionId =
    sessionIdOrFilename && typeof sessionIdOrFilename === 'string' && !sessionIdOrFilename.includes('.')
      ? sessionIdOrFilename
      : null;

  const formData = new FormData();
  formData.append('audio', audioBlob, filename);
  formData.append('language', language || 'indic-auto');
  if (sessionId) formData.append('session_id', sessionId);
  if (targetId) formData.append('target_id', targetId);
  if (previousText) formData.append('previous_text', previousText);
  if (phoneticScheme) formData.append('phonetic_scheme', phoneticScheme);

  const res = await authFetch('/voice/transcribe', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, 'Voice transcription request failed'));
  }
  return res.json();
}

export async function processDialogueAPI(
  text,
  sessionId = null,
  activeTargetId = null,
  entities = null,
  acousticConfidence = 92.0,
  phoneticScheme = null
) {
  const res = await authFetch('/voice/process-dialogue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      session_id: sessionId,
      active_target_id: activeTargetId,
      entities,
      acoustic_confidence: acousticConfidence,
      phonetic_scheme: phoneticScheme,
    }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, 'Dialogue processing failed'));
  }
  return res.json();
}

export async function synthesizeSpeechAPI(
  text,
  voiceOrOptions = 'Devansh',
  model = 'timbre-v3.0',
  language = null,
  speed = 1.0
) {
  const opts =
    voiceOrOptions && typeof voiceOrOptions === 'object'
      ? voiceOrOptions
      : { voice: voiceOrOptions, model, language, speed };

  const res = await authFetch('/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      voice: opts.voice || 'Devansh',
      model: opts.model || 'timbre-v3.0',
      language: opts.language || null,
      speed: opts.speed || 1.0,
    }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, 'Speech synthesis failed'));
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function fetchSampleAudioBlob() {
  const res = await authFetch('/voice/sample-audio');
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to fetch sample audio'));
  return res.blob();
}

export async function transcribeSampleAudioAPI(
  sessionId = null,
  targetId = null,
  language = 'indic-auto'
) {
  const formData = new FormData();
  formData.append('language', language || 'indic-auto');
  if (sessionId) formData.append('session_id', sessionId);
  if (targetId) formData.append('target_id', targetId);

  const res = await authFetch('/voice/transcribe-sample', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, 'Sample transcription failed'));
  }
  return res.json();
}

export async function downloadComplianceCSV() {
  const res = await authFetch('/analytics/export-csv');
  if (!res.ok) {
    throw new Error(await parseErrorDetail(res, 'Failed to export compliance audit CSV'));
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'echotrust_compliance_audit.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- LIVE CALL CONTROL & REALTIME PUSH ---
export async function startCallAPI(sessionId = 'new', { flowEntities = null, phoneticScheme = 'indian' } = {}) {
  const res = await authFetch(`/sessions/${encodeURIComponent(sessionId || 'new')}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      flow_entities: flowEntities,
      phonetic_scheme: phoneticScheme,
    }),
  });
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to start verification call'));
  return res.json();
}

export async function endCallAPI(sessionId) {
  const res = await authFetch(`/sessions/${encodeURIComponent(sessionId)}/end`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to end verification call'));
  return res.json();
}

export async function setPhoneticSchemeAPI(sessionId, phoneticScheme) {
  const res = await authFetch(`/sessions/${encodeURIComponent(sessionId)}/scheme`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phonetic_scheme: phoneticScheme }),
  });
  if (!res.ok) throw new Error(await parseErrorDetail(res, 'Failed to switch phonetic scheme'));
  return res.json();
}

export function getSessionEventsWebSocketUrl(sessionId) {
  if (typeof window === 'undefined' || !sessionId) return '';
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = getStoredToken() || '';
  return `${proto}//${window.location.host}/api/ws/sessions/${encodeURIComponent(sessionId)}?token=${encodeURIComponent(token)}`;
}

export function getSessionEventsSseUrl(sessionId) {
  if (!sessionId) return '';
  const token = getStoredToken() || '';
  return `/api/sessions/${encodeURIComponent(sessionId)}/events?token=${encodeURIComponent(token)}`;
}

export function getAudioClipUrl(clipRef) {
  if (!clipRef) return '';
  const token = getStoredToken() || '';
  return `/api/voice/clips/${encodeURIComponent(clipRef)}?token=${encodeURIComponent(token)}`;
}

// Backwards-compatible aliases used by existing components
export const fetchDashboardMetrics = fetchDashboardStats;
export const fetchDetailedAnalytics = fetchAnalyticsSummary;
export const fetchSessionDetails = fetchSessionById;
export const extractEntitiesFromText = extractEntitiesAPI;

