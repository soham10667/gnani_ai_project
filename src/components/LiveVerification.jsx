import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  PhoneCall, PhoneOff, User, Phone, CreditCard, Mail, MapPin, Calendar,
  Wallet, FileText, Check, Edit3, RotateCcw, Clock, ShieldAlert, ChevronDown,
  ChevronUp, Play, Pause, Send, Radio, WifiOff, Loader2, Sparkles, Sliders
} from 'lucide-react';
import {
  fetchSessionDetails,
  startCallAPI,
  endCallAPI,
  setPhoneticSchemeAPI,
  transcribeAudioBlob,
  processDialogueAPI,
  synthesizeSpeechAPI,
  confirmEntityAPI,
  correctEntityAPI,
  getSessionEventsWebSocketUrl,
  getSessionEventsSseUrl,
  getAudioClipUrl,
} from '../api';
import {
  POST_TTS_COOLDOWN_MS,
  convertBlobToWavWithMetrics,
  computeWaveformBars,
  IDLE_WAVEFORM_BARS,
} from '../utils/audioUtils';

const IS_DEMO_ENABLED =
  Boolean(import.meta?.env?.DEV) || import.meta?.env?.VITE_ENABLE_DEMO_MODE === 'true';

const DEFAULT_FLOW = ['name', 'phone', 'pan', 'email', 'pincode', 'address'];

const FLOW_PRESETS = [
  { id: 'default_6', label: 'Standard 6 KYC Fields', entities: ['name', 'phone', 'pan', 'email', 'pincode', 'address'] },
  { id: 'fast_3', label: 'Express 3 (Name, Phone, PAN)', entities: ['name', 'phone', 'pan'] },
  { id: 'full_8', label: 'Extended 8 BFSI Fields', entities: ['name', 'phone', 'email', 'address', 'amount', 'dob', 'account', 'id_doc'] },
];

const FIELD_META = {
  name: { label: 'Full Name', icon: User },
  phone: { label: 'Phone Number', icon: Phone },
  pan: { label: 'PAN Card', icon: CreditCard },
  email: { label: 'Email Address', icon: Mail },
  pincode: { label: 'Pincode', icon: MapPin },
  address: { label: 'Residential Address', icon: MapPin },
  amount: { label: 'Amount (INR)', icon: Wallet },
  dob: { label: 'Date of Birth', icon: Calendar },
  account: { label: 'Account Number', icon: CreditCard },
  id_doc: { label: 'National ID / PAN', icon: FileText },
};

const STATE_STYLES = {
  waiting: {
    label: 'Waiting',
    pill: 'bg-slate-100 text-slate-600 border-slate-200',
    border: 'border-slate-200',
  },
  captured: {
    label: 'Captured',
    pill: 'bg-amber-50 text-amber-800 border-amber-200',
    border: 'border-amber-300',
  },
  readback_sent: {
    label: 'Read-back sent',
    pill: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    border: 'border-indigo-300',
  },
  confirmed: {
    label: 'Confirmed',
    pill: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    border: 'border-emerald-300',
  },
  verified: {
    label: 'Confirmed',
    pill: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    border: 'border-emerald-300',
  },
  corrected: {
    label: 'Corrected',
    pill: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    border: 'border-cyan-300',
  },
  escalated: {
    label: 'Escalated',
    pill: 'bg-rose-50 text-rose-800 border-rose-300',
    border: 'border-rose-400',
  },
};

function formatClockTime(isoOrStr) {
  if (!isoOrStr) return '--:--:--';
  if (/^\d{1,2}:\d{2}(:\d{2})?/.test(isoOrStr) && !isoOrStr.includes('T')) {
    return isoOrStr;
  }
  const d = new Date(isoOrStr);
  if (Number.isNaN(d.getTime())) return String(isoOrStr).slice(0, 8);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

function formatTimer(secs) {
  const s = Math.max(0, Number(secs) || 0);
  const mins = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

export default function LiveVerification({
  initialSessionId = '',
  sttLanguage = 'indic-auto',
  onSttLanguageChange,
  ttsVoice = 'Devansh',
  onTtsVoiceChange,
  onSessionSync,
}) {
  // Core server-owned session snapshot state
  const [sessionId, setSessionId] = useState(initialSessionId || '');
  const [sessionState, setSessionState] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState('default_6');
  const [phoneticScheme, setPhoneticScheme] = useState('indian');

  // Call & Half-duplex audio state
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [micState, setMicState] = useState('standby'); // 'standby' | 'listening' | 'speaking' | 'processing' | 'denied'
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [wsStatus, setWsStatus] = useState('idle'); // 'idle' | 'connecting' | 'connected' | 'sse' | 'disconnected'
  const [waveformBars, setWaveformBars] = useState(IDLE_WAVEFORM_BARS);

  // Explicit error states: loading | stt_failure | mic_permission_denied | network_drop | low_audio_quality
  const [errorState, setErrorState] = useState(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);

  // UI inspection & inline edit state
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [editingFieldId, setEditingFieldId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [expandedConfirmed, setExpandedConfirmed] = useState({});
  const [auditOpen, setAuditOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [playingClipRef, setPlayingClipRef] = useState(null);

  // Refs to avoid stale closures inside audio/VAD/WS callbacks
  const sessionIdRef = useRef(sessionId);
  const sessionStateRef = useRef(sessionState);
  const isAutoModeRef = useRef(isAutoMode);
  const isPlayingAudioRef = useRef(isPlayingAudio);
  const phoneticSchemeRef = useRef(phoneticScheme);
  const unmountedRef = useRef(false);

  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const micAudioCtxRef = useRef(null);
  const micRafRef = useRef(null);
  const vadSilenceTimerRef = useRef(null);
  const vadMaxTimerRef = useRef(null);
  const cooldownTimerRef = useRef(null);
  const activeTtsAudioRef = useRef(null);
  const ttsAudioCtxRef = useRef(null);
  const ttsRafRef = useRef(null);
  const activeClipAudioRef = useRef(null);
  const wsRef = useRef(null);
  const sseRef = useRef(null);
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);

  useEffect(() => {
    isAutoModeRef.current = isAutoMode;
  }, [isAutoMode]);

  useEffect(() => {
    isPlayingAudioRef.current = isPlayingAudio;
  }, [isPlayingAudio]);

  useEffect(() => {
    phoneticSchemeRef.current = phoneticScheme;
  }, [phoneticScheme]);

  // Apply authoritative server snapshot cleanly
  const applyServerState = useCallback(
    (payload) => {
      if (!payload) return;
      const sid = payload.session_id || payload.id || sessionIdRef.current;
      if (sid && sid !== sessionIdRef.current) {
        setSessionId(sid);
      }

      const normalized = {
        ...payload,
        session_id: sid,
        flow_entities: payload.flow_entities || DEFAULT_FLOW,
        entities_list:
          Array.isArray(payload.entities_list)
            ? payload.entities_list
            : Array.isArray(payload.entities)
            ? payload.entities
            : [],
        dialogue_log: payload.dialogue_log || [],
        audit_trail: payload.audit_trail || [],
        metrics: payload.metrics || {
          confirmed_count: payload.verified_count ?? 0,
          total_fields: (payload.flow_entities || DEFAULT_FLOW).length,
          first_pass_accuracy: 0,
          correction_rate: 0,
          avg_turns_per_field: 0,
          escalation_count: 0,
        },
      };

      setSessionState(normalized);
      if (normalized.phonetic_scheme) {
        setPhoneticScheme(normalized.phonetic_scheme);
      }
      if (onSessionSync) {
        onSessionSync(normalized);
      }
    },
    [onSessionSync]
  );

  // Clean shutdown of mic stream without triggering processing
  const stopMicStream = useCallback((processAudio = false) => {
    if (micRafRef.current) {
      cancelAnimationFrame(micRafRef.current);
      micRafRef.current = null;
    }
    if (vadSilenceTimerRef.current) {
      clearTimeout(vadSilenceTimerRef.current);
      vadSilenceTimerRef.current = null;
    }
    if (vadMaxTimerRef.current) {
      clearTimeout(vadMaxTimerRef.current);
      vadMaxTimerRef.current = null;
    }
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') {
      if (!processAudio) {
        rec.onstop = null;
      }
      try {
        rec.stop();
      } catch {
        // ignore stop error
      }
    }
    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    if (micAudioCtxRef.current) {
      micAudioCtxRef.current.close().catch(() => {});
      micAudioCtxRef.current = null;
    }
    if (!processAudio && !isPlayingAudioRef.current) {
      setMicState((prev) => (prev === 'denied' ? 'denied' : 'standby'));
      setWaveformBars(IDLE_WAVEFORM_BARS);
    }
  }, []);

  const stopTtsAudio = useCallback(() => {
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    if (ttsRafRef.current) {
      cancelAnimationFrame(ttsRafRef.current);
      ttsRafRef.current = null;
    }
    if (activeTtsAudioRef.current) {
      try {
        activeTtsAudioRef.current.pause();
        activeTtsAudioRef.current.src = '';
      } catch {
        // ignore
      }
      activeTtsAudioRef.current = null;
    }
    if (ttsAudioCtxRef.current) {
      ttsAudioCtxRef.current.close().catch(() => {});
      ttsAudioCtxRef.current = null;
    }
    isPlayingAudioRef.current = false;
    setIsPlayingAudio(false);
    setWaveformBars(IDLE_WAVEFORM_BARS);
    setMicState((prev) => (prev === 'speaking' ? 'standby' : prev));
  }, []);

  // Unmount cleanup
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      stopMicStream(false);
      stopTtsAudio();
      if (wsRef.current) wsRef.current.close();
      if (sseRef.current) sseRef.current.close();
      if (activeClipAudioRef.current) {
        activeClipAudioRef.current.pause();
      }
    };
  }, [stopMicStream, stopTtsAudio]);

  // Load initialSessionId if supplied from History / Dashboard Inspect button
  const loadSessionSnapshot = useCallback(
    async (sid) => {
      if (!sid) return;
      setIsLoadingSession(true);
      setErrorState(null);
      try {
        const data = await fetchSessionDetails(sid);
        const rawEntities = data.entities || [];
        const flow = data.flow_entities || DEFAULT_FLOW;
        const shaped = {
          ...data,
          session_id: data.id,
          session_status: data.status,
          call_status: data.call_status || (data.status === 'In Progress' ? 'Idle' : data.status),
          flow_entities: flow,
          active_target_id: data.active_target_id,
          entities_list: rawEntities
            .filter((e) => flow.includes(e.entity_type || e.id))
            .map((e) => ({
              ...e,
              id: e.entity_type || e.id,
              stt_confidence: e.stt_confidence ?? e.confidence ?? 0,
              validator_confidence: e.validator_confidence ?? 0,
              previousValue: e.previous_value || '',
              phoneticSummary: e.phonetic_summary || '',
              phoneticDetails: e.phonetic_details || [],
              charConfidences: e.char_confidences || [],
              diffOps: e.diff_ops || [],
              status: e.status === 'verified' ? 'confirmed' : e.status,
            })),
        };
        applyServerState(shaped);
      } catch (err) {
        const msg = err?.message || 'Unable to load verification session';
        const isNet = /failed to fetch|network|unreachable|502|503|504/i.test(msg);
        setErrorState({
          type: isNet ? 'network_drop' : 'stt_failure',
          message: msg,
        });
      } finally {
        setIsLoadingSession(false);
      }
    },
    [applyServerState]
  );

  useEffect(() => {
    if (initialSessionId && initialSessionId !== sessionIdRef.current) {
      setSessionId(initialSessionId);
      loadSessionSnapshot(initialSessionId);
    }
  }, [initialSessionId, loadSessionSnapshot]);

  // Zero-polling real-time WebSocket (with SSE fallback) tied strictly to active sessionId
  const connectRealtimeChannel = useCallback(
    (sid) => {
      if (!sid) return;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }

      setWsStatus('connecting');
      const wsUrl = getSessionEventsWebSocketUrl(sid);
      let pingTimer = null;

      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (unmountedRef.current) return;
          setWsStatus('connected');
          setErrorState((prev) => (prev?.type === 'network_drop' ? null : prev));
          pingTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send('ping');
            }
          }, 20000);
        };

        ws.onmessage = (evt) => {
          if (unmountedRef.current) return;
          try {
            const msg = JSON.parse(evt.data);
            if ((msg.type === 'session_state' || msg.type === 'session_snapshot') && msg.data) {
              applyServerState(msg.data);
            }
          } catch {
            // ignore non-json pong
          }
        };

        ws.onerror = () => {
          if (pingTimer) clearInterval(pingTimer);
          if (unmountedRef.current) return;
          // Fallback cleanly to SSE if WebSocket fails
          try {
            const sse = new EventSource(getSessionEventsSseUrl(sid));
            sseRef.current = sse;
            setWsStatus('sse');
            sse.addEventListener('session_snapshot', (e) => {
              try {
                const parsed = JSON.parse(e.data);
                if (parsed?.data) applyServerState(parsed.data);
              } catch {
                // ignore
              }
            });
            sse.addEventListener('session_state', (e) => {
              try {
                const parsed = JSON.parse(e.data);
                if (parsed?.data) applyServerState(parsed.data);
              } catch {
                // ignore
              }
            });
            sse.onerror = () => {
              setWsStatus('disconnected');
              setErrorState({
                type: 'network_drop',
                message: 'Real-time session connection dropped. Click Reconnect to restore live updates.',
              });
            };
          } catch {
            setWsStatus('disconnected');
          }
        };

        ws.onclose = (ev) => {
          if (pingTimer) clearInterval(pingTimer);
          if (unmountedRef.current) return;
          if (ev.code !== 1000 && !sseRef.current) {
            setWsStatus('disconnected');
          }
        };
      } catch {
        setWsStatus('disconnected');
      }
    },
    [applyServerState]
  );

  useEffect(() => {
    if (!sessionId) return;
    connectRealtimeChannel(sessionId);
    return () => {
      if (wsRef.current) wsRef.current.close(1000, 'Session switched');
      if (sseRef.current) sseRef.current.close();
    };
  }, [sessionId, connectRealtimeChannel]);

  // Live call duration timer (ticks only while call_status === 'Live')
  const callStatus = sessionState?.call_status || (sessionId ? 'Idle' : 'Idle');
  useEffect(() => {
    if (callStatus !== 'Live') return;
    const t = setInterval(() => {
      setCallSeconds((c) => c + 1);
    }, 1000);
    return () => clearInterval(t);
  }, [callStatus]);

  // Auto-scroll transcript cleanly when new message arrives
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [sessionState?.dialogue_log?.length]);

  // Capture user speech with half-duplex guard & VAD silence auto-stop
  const startMicCapture = useCallback(async () => {
    if (isPlayingAudioRef.current) {
      // Half-duplex rule: NEVER open mic while TTS is speaking
      return;
    }
    const st = sessionStateRef.current;
    if (st && (st.call_status === 'Ended' || st.call_status === 'Escalated' || st.session_status === 'Verified')) {
      return;
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicState('denied');
      setErrorState({
        type: 'mic_permission_denied',
        message: 'Microphone API unavailable in this browser. Grant HTTPS/localhost access or type customer input below.',
      });
      return;
    }

    stopMicStream(false);
    setErrorState((prev) => (prev?.type === 'mic_permission_denied' || prev?.type === 'low_audio_quality' ? null : prev));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (unmountedRef.current || isPlayingAudioRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      mediaStreamRef.current = stream;
      setMicState('listening');

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      micAudioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      const chunks = [];
      let speechDetected = false;
      let stopped = false;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const finishCapture = () => {
        if (stopped) return;
        stopped = true;
        if (vadSilenceTimerRef.current) clearTimeout(vadSilenceTimerRef.current);
        if (vadMaxTimerRef.current) clearTimeout(vadMaxTimerRef.current);
        if (micRafRef.current) cancelAnimationFrame(micRafRef.current);
        if (recorder.state !== 'inactive') {
          try {
            recorder.stop();
          } catch {
            // ignore
          }
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (micAudioCtxRef.current) {
          micAudioCtxRef.current.close().catch(() => {});
          micAudioCtxRef.current = null;
        }
        setWaveformBars(IDLE_WAVEFORM_BARS);

        if (unmountedRef.current || chunks.length === 0) {
          setMicState('standby');
          return;
        }
        if (!speechDetected) {
          setMicState('standby');
          setErrorState({
            type: 'low_audio_quality',
            message: 'No clear speech detected (low audio energy). Please ask the customer to speak clearly and click Retry.',
          });
          return;
        }

        const rawBlob = new Blob(chunks, { type: mimeType || 'audio/webm' });
        setMicState('processing');
        const { wavBlob, peak } = await convertBlobToWavWithMetrics(rawBlob);
        if (peak < 0.008 || wavBlob.size < 300) {
          setMicState('standby');
          setErrorState({
            type: 'low_audio_quality',
            message: 'Captured microphone audio is too quiet or corrupted. Check microphone input and retry.',
          });
          return;
        }

        try {
          const stNow = sessionStateRef.current;
          const res = await transcribeAudioBlob(
            wavBlob,
            sessionIdRef.current || 'recording.wav',
            stNow?.active_target_id || null,
            sttLanguage,
            null,
            phoneticSchemeRef.current
          );
          if (res?.session_id && !sessionIdRef.current) {
            setSessionId(res.session_id);
          }
          if (res) {
            applyServerState(res);
          }
          setErrorState(null);
          if (res?.reply) {
            await speakText(res.reply, res);
          } else {
            setMicState('standby');
          }
        } catch (err) {
          const msg = err?.message || 'STT transcription request failed';
          const isNet = /failed to fetch|network|unreachable/i.test(msg);
          const isLow = /low audio|too short|empty/i.test(msg);
          setErrorState({
            type: isNet ? 'network_drop' : isLow ? 'low_audio_quality' : 'stt_failure',
            message: msg,
          });
          setMicState('standby');
        }
      };

      const timeDomain = new Uint8Array(analyser.fftSize);
      const tick = () => {
        if (stopped || unmountedRef.current || isPlayingAudioRef.current) return;
        setWaveformBars(computeWaveformBars(analyser, 24));
        analyser.getByteTimeDomainData(timeDomain);
        let sq = 0;
        for (let i = 0; i < timeDomain.length; i++) {
          const norm = (timeDomain[i] - 128) / 128;
          sq += norm * norm;
        }
        const rms = Math.sqrt(sq / timeDomain.length);
        if (rms > 0.025) {
          speechDetected = true;
          if (vadSilenceTimerRef.current) {
            clearTimeout(vadSilenceTimerRef.current);
            vadSilenceTimerRef.current = null;
          }
        } else if (speechDetected && !vadSilenceTimerRef.current) {
          vadSilenceTimerRef.current = setTimeout(() => {
            finishCapture();
          }, 1350);
        }
        micRafRef.current = requestAnimationFrame(tick);
      };

      recorder.start(250);
      micRafRef.current = requestAnimationFrame(tick);

      // Guard cap: stop after 11s to avoid unbounded recording
      vadMaxTimerRef.current = setTimeout(() => {
        finishCapture();
      }, 11000);
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
      setMicState(denied ? 'denied' : 'standby');
      setErrorState({
        type: denied ? 'mic_permission_denied' : 'low_audio_quality',
        message: denied
          ? 'Microphone permission denied. Allow microphone access in browser site settings and click Retry.'
          : err?.message || 'Failed to open microphone device.',
      });
    }
  }, [applyServerState, stopMicStream, sttLanguage]);

  // Half-duplex AI TTS playback: mutes mic strictly before playing, waits 450ms cooldown after ending before auto-listen
  const speakText = useCallback(
    async (text, latestState = null) => {
      if (!text || !text.trim()) return;
      stopMicStream(false);
      stopTtsAudio();

      isPlayingAudioRef.current = true;
      setIsPlayingAudio(true);
      setMicState('speaking');

      try {
        const audioUrl = await synthesizeSpeechAPI(text, {
          voice: ttsVoice || 'Devansh',
          model: 'timbre-v3.0',
          speed: 1.0,
        });
        if (unmountedRef.current) {
          URL.revokeObjectURL(audioUrl);
          return;
        }

        const audio = new Audio(audioUrl);
        activeTtsAudioRef.current = audio;

        // Real FFT waveform driven from TTS output
        try {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          const ctx = new AudioCtx();
          ttsAudioCtxRef.current = ctx;
          const src = ctx.createMediaElementSource(audio);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.72;
          src.connect(analyser);
          analyser.connect(ctx.destination);
          const anim = () => {
            if (!isPlayingAudioRef.current || unmountedRef.current) return;
            setWaveformBars(computeWaveformBars(analyser, 24));
            ttsRafRef.current = requestAnimationFrame(anim);
          };
          ttsRafRef.current = requestAnimationFrame(anim);
        } catch {
          // AudioContext unavailable fallback still plays clean HTMLAudioElement
        }

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (ttsRafRef.current) cancelAnimationFrame(ttsRafRef.current);
          if (ttsAudioCtxRef.current) {
            ttsAudioCtxRef.current.close().catch(() => {});
            ttsAudioCtxRef.current = null;
          }
          isPlayingAudioRef.current = false;
          setIsPlayingAudio(false);
          setWaveformBars(IDLE_WAVEFORM_BARS);
          setMicState('standby');

          const st = latestState || sessionStateRef.current;
          const done =
            !st ||
            st.call_status === 'Ended' ||
            st.call_status === 'Escalated' ||
            st.session_status === 'Verified' ||
            st.action === 'all_verified' ||
            st.action === 'escalated';

          if (!unmountedRef.current && isAutoModeRef.current && !done) {
            cooldownTimerRef.current = setTimeout(() => {
              startMicCapture();
            }, POST_TTS_COOLDOWN_MS);
          }
        };

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          isPlayingAudioRef.current = false;
          setIsPlayingAudio(false);
          setMicState('standby');
        };

        await audio.play();
      } catch (err) {
        isPlayingAudioRef.current = false;
        setIsPlayingAudio(false);
        setMicState('standby');
        setWaveformBars(IDLE_WAVEFORM_BARS);
        setErrorState({
          type: 'stt_failure',
          message: err?.message || 'Gnani TTS speech playback failed.',
        });
      }
    },
    [startMicCapture, stopMicStream, stopTtsAudio, ttsVoice]
  );

  // Start / Restart Call (single button in Call Header)
  const handleStartCall = async () => {
    stopMicStream(false);
    stopTtsAudio();
    setErrorState(null);
    setCallSeconds(0);
    setEditingFieldId(null);
    setSelectedFieldId(null);
    const preset = FLOW_PRESETS.find((p) => p.id === selectedPreset);

    try {
      const resp = await startCallAPI('new', {
        flowEntities: preset ? preset.entities : DEFAULT_FLOW,
        phoneticScheme,
      });
      applyServerState(resp);
      if (resp?.reply) {
        await speakText(resp.reply, resp);
      }
    } catch (err) {
      const msg = err?.message || 'Could not start verification call';
      setErrorState({
        type: /failed to fetch|network/i.test(msg) ? 'network_drop' : 'stt_failure',
        message: msg,
      });
    }
  };

  const handleEndCall = async () => {
    stopMicStream(false);
    stopTtsAudio();
    if (!sessionId) return;
    try {
      const resp = await endCallAPI(sessionId);
      applyServerState(resp);
    } catch (err) {
      setErrorState({ type: 'network_drop', message: err?.message || 'Failed to end session cleanly' });
    }
  };

  const handleSchemeChange = async (newScheme) => {
    setPhoneticScheme(newScheme);
    if (!sessionId) return;
    try {
      const resp = await setPhoneticSchemeAPI(sessionId, newScheme);
      applyServerState(resp);
    } catch (err) {
      setErrorState({ type: 'network_drop', message: err?.message || 'Failed to update phonetic scheme' });
    }
  };

  // Manual / Simulated utterance submission through authoritative ConversationAgent
  const submitTextUtterance = async (textToSubmit, simulatedConfidence = 91.0) => {
    const clean = (textToSubmit || '').trim();
    if (!clean) return;
    setErrorState(null);
    stopMicStream(false);
    try {
      const resp = await processDialogueAPI(
        clean,
        sessionId || null,
        sessionState?.active_target_id || null,
        null,
        simulatedConfidence,
        phoneticScheme
      );
      if (resp?.session_id && !sessionIdRef.current) {
        setSessionId(resp.session_id);
      }
      applyServerState(resp);
      setManualText('');
      if (resp?.reply) {
        await speakText(resp.reply, resp);
      }
    } catch (err) {
      setErrorState({
        type: /failed to fetch|network/i.test(err?.message || '') ? 'network_drop' : 'stt_failure',
        message: err?.message || 'Failed to process dialogue turn',
      });
    }
  };

  // Manual Fallback Confirm button [Enter]
  const handleManualConfirm = useCallback(
    async (entity) => {
      if (!sessionId || !entity || !entity.value) return;
      stopMicStream(false);
      try {
        const res = await confirmEntityAPI(
          sessionId,
          entity.db_id || `${sessionId}__${entity.id}`,
          entity.id,
          entity.value,
          entity.validator_confidence ?? entity.stt_confidence ?? entity.confidence ?? 95,
          true
        );
        if (res?.session_state) {
          applyServerState(res.session_state);
          if (res.session_state.reply) {
            await speakText(res.session_state.reply, res.session_state);
          }
        }
      } catch (err) {
        setErrorState({
          type: 'stt_failure',
          message: err?.message || 'Manual confirmation failed',
        });
      }
    },
    [applyServerState, sessionId, speakText, stopMicStream]
  );

  // Manual Edit [E] -> /api/entities/correct -> triggers fresh phonetic readback
  const handleSaveEdit = async (entity) => {
    const nextVal = (editDraft || '').trim();
    if (!sessionId || !entity || !nextVal) return;
    stopMicStream(false);
    try {
      const res = await correctEntityAPI(
        sessionId,
        entity.db_id || `${sessionId}__${entity.id}`,
        entity.id,
        entity.value || '',
        nextVal,
        entity.stt_confidence ?? entity.confidence ?? 75,
        96
      );
      setEditingFieldId(null);
      setEditDraft('');
      if (res?.session_state) {
        applyServerState(res.session_state);
      }
      if (res?.readback_prompt) {
        await speakText(res.readback_prompt, res?.session_state);
      }
    } catch (err) {
      setErrorState({
        type: 'stt_failure',
        message: err?.message || 'Manual correction failed',
      });
    }
  };

  // Determine ordered flow entities and currently focused entity
  const flowOrder = sessionState?.flow_entities || DEFAULT_FLOW;
  const entitiesById = {};
  (sessionState?.entities_list || []).forEach((e) => {
    const key = e.entity_type || e.id;
    entitiesById[key] = e;
  });

  const orderedEntities = flowOrder.map((eid) => {
    const existing = entitiesById[eid];
    const meta = FIELD_META[eid] || { label: eid.toUpperCase(), icon: FileText };
    if (existing) {
      return { ...existing, id: eid, label: existing.label || meta.label, icon: meta.icon };
    }
    return {
      id: eid,
      entity_type: eid,
      label: meta.label,
      icon: meta.icon,
      value: '',
      previousValue: '',
      status: 'waiting',
      stt_confidence: 0,
      validator_confidence: 0,
      validation_passed: true,
      failed_rule: '',
      phoneticSummary: '',
      phoneticDetails: [],
      charConfidences: [],
      diffOps: [],
      readback_text: '',
      attempts: 0,
      failed_attempts: 0,
    };
  });

  const activeFieldId =
    selectedFieldId && flowOrder.includes(selectedFieldId)
      ? selectedFieldId
      : sessionState?.active_target_id ||
        orderedEntities.find((e) => e.status === 'readback_sent' || e.status === 'captured' || e.status === 'corrected')?.id ||
        orderedEntities.find((e) => e.status === 'waiting')?.id ||
        flowOrder[0];

  const activeEntity = orderedEntities.find((e) => e.id === activeFieldId) || orderedEntities[0];

  // Re-hear phonetic readback [R]
  const handleRehear = useCallback(
    async (entity) => {
      if (!entity) return;
      const text =
        entity.readback_text ||
        (entity.value
          ? `Aapka ${entity.label} ${entity.value} hai. ${entity.phoneticSummary || ''}. Kya ye sahi hai?`
          : sessionStateRef.current?.reply || `Kripya apna ${entity.label} batayein.`);
      await speakText(text);
    },
    [speakText]
  );

  // Scoped Keyboard Shortcuts: Enter = Confirm fallback, E = Edit, R = Re-hear
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = (e.target?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) {
        return;
      }
      if (!activeEntity || editingFieldId) return;

      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleRehear(activeEntity);
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setSelectedFieldId(activeEntity.id);
        setEditingFieldId(activeEntity.id);
        setEditDraft(activeEntity.value || '');
      } else if (e.key === 'Enter') {
        if (
          activeEntity.value &&
          activeEntity.status !== 'confirmed' &&
          activeEntity.status !== 'verified' &&
          activeEntity.status !== 'escalated' &&
          activeEntity.validation_passed !== false
        ) {
          e.preventDefault();
          handleManualConfirm(activeEntity);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeEntity, editingFieldId, handleManualConfirm, handleRehear]);

  const playAuditClip = (clipRef) => {
    if (!clipRef) return;
    if (activeClipAudioRef.current) {
      activeClipAudioRef.current.pause();
      activeClipAudioRef.current = null;
      if (playingClipRef === clipRef) {
        setPlayingClipRef(null);
        return;
      }
    }
    const url = getAudioClipUrl(clipRef);
    const a = new Audio(url);
    activeClipAudioRef.current = a;
    setPlayingClipRef(clipRef);
    a.onended = () => setPlayingClipRef(null);
    a.onerror = () => {
      setPlayingClipRef(null);
      setErrorState({ type: 'low_audio_quality', message: `Unable to play recorded clip (${clipRef}).` });
    };
    a.play().catch(() => setPlayingClipRef(null));
  };

  const metrics = sessionState?.metrics || {
    confirmed_count: orderedEntities.filter((e) => e.status === 'confirmed' || e.status === 'verified').length,
    total_fields: flowOrder.length,
    first_pass_accuracy: 0,
    correction_rate: 0,
    avg_turns_per_field: 0,
    escalation_count: orderedEntities.filter((e) => e.status === 'escalated').length,
  };

  const callStatusBadge =
    callStatus === 'Live'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : callStatus === 'Escalated'
      ? 'bg-rose-50 text-rose-800 border-rose-200'
      : callStatus === 'Ended'
      ? 'bg-slate-100 text-slate-700 border-slate-300'
      : 'bg-slate-100 text-slate-500 border-slate-200';

  const micLabelMap = {
    listening: { text: 'Listening', cls: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500 animate-ping' },
    speaking: { text: 'AI Speaking (Mic Muted)', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500 animate-pulse' },
    processing: { text: 'Processing STT...', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500 animate-pulse' },
    denied: { text: 'Mic Denied', cls: 'bg-rose-100 text-rose-800 border-rose-300', dot: 'bg-rose-600' },
    standby: { text: 'Standby', cls: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
  };
  const micBadge = micLabelMap[micState] || micLabelMap.standby;

  // Render active entity card details (used cleanly for active / expanded confirmed cards)
  const renderExpandedEntityCard = (entity, isFocused = true) => {
    const st = STATE_STYLES[entity.status] || STATE_STYLES.waiting;
    const Icon = entity.icon || FileText;
    const hasVal = Boolean(entity.value && entity.value.trim().length > 0);
    const charConfs = Array.isArray(entity.charConfidences) ? entity.charConfidences : [];
    const phonDetails = Array.isArray(entity.phoneticDetails) ? entity.phoneticDetails : [];
    const diffOps = Array.isArray(entity.diffOps) ? entity.diffOps : [];
    const isEditing = editingFieldId === entity.id;
    const isConfirmed = entity.status === 'confirmed' || entity.status === 'verified';
    const isEscalated = entity.status === 'escalated';

    return (
      <div
        key={entity.id}
        className={`bg-white rounded-2xl border-2 p-4 shadow-sm transition-all ${
          isFocused ? 'ring-2 ring-emerald-500/20 border-emerald-400' : st.border
        }`}
      >
        {/* Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-xl border ${isConfirmed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isEscalated ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900 text-sm">{entity.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${st.pill}`}>
                  {st.label}
                </span>
                {entity.attempts > 0 && (
                  <span className="text-[11px] font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    Attempt {entity.attempts}/3
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* TWO SEPARATE CONFIDENCE BADGES (STT vs Validator) */}
          <div className="flex items-center space-x-2">
            <span
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                !hasVal
                  ? 'bg-slate-50 text-slate-400 border-slate-200'
                  : (entity.stt_confidence ?? 0) >= 85
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : (entity.stt_confidence ?? 0) >= 65
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
              title="Gnani Speech-to-Text acoustic confidence"
            >
              STT: {hasVal ? `${Math.round(entity.stt_confidence ?? 0)}%` : '--'}
            </span>
            <span
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border ${
                !hasVal
                  ? 'bg-slate-50 text-slate-400 border-slate-200'
                  : entity.validation_passed === false
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : (entity.validator_confidence ?? 0) >= 85
                  ? 'bg-teal-50 text-teal-700 border-teal-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title="Deterministic BFSI entity rule validator confidence"
            >
              Validator: {hasVal ? `${Math.round(entity.validator_confidence ?? 0)}%` : '--'}
            </span>
          </div>
        </div>

        {/* Captured Value or Inline Edit Box */}
        <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Captured Value
            </span>
            {entity.previousValue && entity.previousValue !== entity.value && (
              <div className="flex items-center space-x-1.5 text-[11px]">
                <span className="text-slate-400 font-semibold">Diff:</span>
                {diffOps.length > 0 ? (
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200">
                    {diffOps.map((op, i) =>
                      op.op === 'del' ? (
                        <span key={i} className="bg-rose-100 text-rose-700 line-through px-0.5 rounded-xs mx-0.5">
                          {op.text}
                        </span>
                      ) : op.op === 'ins' ? (
                        <span key={i} className="bg-emerald-100 text-emerald-800 font-bold px-0.5 rounded-xs mx-0.5">
                          {op.text}
                        </span>
                      ) : (
                        <span key={i} className="text-slate-700">
                          {op.text}
                        </span>
                      )
                    )}
                  </span>
                ) : (
                  <span className="font-mono text-slate-600">
                    <span className="line-through text-rose-600 mr-1">{entity.previousValue}</span>
                    -&gt; <span className="font-bold text-emerald-700">{entity.value}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                autoFocus
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit(entity);
                  if (e.key === 'Escape') setEditingFieldId(null);
                }}
                className="flex-1 px-3 py-1.5 bg-white border border-emerald-400 rounded-lg text-sm font-mono font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <button
                onClick={() => handleSaveEdit(entity)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Save & Re-read
              </button>
              <button
                onClick={() => setEditingFieldId(null)}
                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="font-mono font-bold text-lg text-slate-900 break-words">
              {hasVal ? entity.value : <span className="text-slate-400 font-sans text-sm font-normal italic">Waiting for customer speech...</span>}
            </div>
          )}
        </div>

        {/* Validator Rule Result */}
        {hasVal && (
          <div className={`mt-2.5 px-3 py-2 rounded-xl border text-xs flex items-center space-x-2 ${
            entity.validation_passed === false
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50/70 border-emerald-200/70 text-emerald-800'
          }`}>
            {entity.validation_passed === false ? (
              <>
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-semibold">Rule Failed: {entity.validation_message || entity.failed_rule}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{entity.validation_message || 'Rule check passed'}</span>
              </>
            )}
          </div>
        )}

        {/* Merged Inline Character-by-Character Phonetic Chips & Low-Confidence Highlighting */}
        {hasVal && (phonDetails.length > 0 || charConfs.length > 0) && (
          <div className="mt-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
              <span>Phonetic Read-Back Breakdown ({phoneticScheme === 'indian' ? 'Indian-Friendly' : 'NATO'})</span>
              {charConfs.some((c) => c.low_conf) && (
                <span className="text-amber-700 font-semibold normal-case">Highlighted chars have low acoustic/validator certainty</span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(charConfs.length > 0 ? charConfs : phonDetails).map((item, idx) => {
                const ch = item.char;
                if (ch === ' ') {
                  return <span key={idx} className="px-1 text-slate-300 text-xs self-center">/</span>;
                }
                const word = phonDetails[idx]?.code || item.code || ch;
                const low = Boolean(item.low_conf);
                const bad = Boolean(item.invalid_rule);
                return (
                  <span
                    key={idx}
                    title={item.reason || `Char ${ch}: ${item.conf ?? 90}%`}
                    className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg text-[11px] font-mono border ${
                      bad
                        ? 'bg-rose-50 text-rose-800 border-rose-300 ring-1 ring-rose-300 font-bold'
                        : low
                        ? 'bg-amber-50 text-amber-800 border-amber-300 ring-1 ring-amber-300 font-bold'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span className="font-bold">{ch}</span>
                    <span className="text-slate-400">{phoneticScheme === 'indian' ? 'se' : '->'}</span>
                    <span>{word}</span>
                  </span>
                );
              })}
            </div>
            {entity.readback_text && (
              <div className="mt-2 text-xs text-indigo-900 bg-indigo-50/70 border border-indigo-200/70 rounded-xl px-3 py-2 font-medium">
                <span className="text-[10px] font-bold uppercase text-indigo-500 mr-1.5">Read-back:</span>
                "{entity.readback_text}"
              </div>
            )}
          </div>
        )}

        {/* Escalated Notice */}
        {isEscalated && (
          <div className="mt-3 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-semibold">Escalated to Human Verification Officer after 3 failed attempts.</span>
          </div>
        )}

        {/* Card Action Bar */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleRehear(entity)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1.5 cursor-pointer"
              title="Re-hear Phonetic Read-back (Shortcut: R)"
            >
              <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Re-hear</span>
              <kbd className="text-[10px] bg-white px-1 rounded border border-slate-300 text-slate-500">R</kbd>
            </button>
            <button
              onClick={() => {
                setSelectedFieldId(entity.id);
                setEditingFieldId(entity.id);
                setEditDraft(entity.value || '');
              }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1.5 cursor-pointer"
              title="Manual Edit Value (Shortcut: E)"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-600" />
              <span>Edit</span>
              <kbd className="text-[10px] bg-white px-1 rounded border border-slate-300 text-slate-500">E</kbd>
            </button>
          </div>

          {!isConfirmed && !isEscalated && hasVal && (
            <button
              onClick={() => handleManualConfirm(entity)}
              disabled={entity.validation_passed === false}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer ${
                entity.validation_passed === false
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                  : 'bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300'
              }`}
              title="Manual Confirm Fallback (Shortcut: Enter)"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm Match</span>
              <kbd className="text-[10px] bg-slate-50 px-1 rounded border border-emerald-200 text-emerald-600">Enter</kbd>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* =========================================================
          1. COMPACT 1-ROW CALL HEADER
         ========================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 px-4 py-3 shadow-xs flex flex-wrap lg:flex-nowrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 min-w-0">
          <div className="flex items-center space-x-2 min-w-0">
            <span className="font-bold text-slate-900 text-sm truncate">
              {sessionState?.customer_name || 'Pending Customer'}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${callStatusBadge}`}>
              {callStatus}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            ID: <strong className="font-mono text-slate-700">{sessionState?.customer_id || '--'}</strong>
          </span>
          <span className="text-xs text-slate-500">
            App: <strong className="font-mono text-slate-700">{sessionState?.app_no || '--'}</strong>
          </span>
          <span className="text-xs text-slate-500">
            Session: <strong className="font-mono text-slate-700">{sessionId || 'Not Started'}</strong>
          </span>
          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-slate-100 border border-slate-200 text-xs font-mono font-bold text-slate-800">
            <Clock className="w-3 h-3 text-slate-500" />
            <span>{formatTimer(callSeconds)}</span>
          </span>
          {sessionId && (
            <span
              className={`inline-flex items-center space-x-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                wsStatus === 'connected' || wsStatus === 'sse'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
              title="Real-time server push link"
            >
              <Radio className="w-3 h-3" />
              <span>{wsStatus === 'connected' ? 'WS Live' : wsStatus === 'sse' ? 'SSE Live' : wsStatus}</span>
            </span>
          )}
        </div>

        {/* Single Call Controls Cluster */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {callStatus !== 'Live' && (
            <select
              value={selectedPreset}
              onChange={(e) => setSelectedPreset(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-slate-700 outline-none"
              title="Select configurable verification fields"
            >
              {FLOW_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}

          {/* ONE Auto / Manual Toggle */}
          <button
            onClick={() => setIsAutoMode((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              isAutoMode
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
            title="Toggle hands-free auto-listen after AI TTS read-back"
          >
            {isAutoMode ? 'Auto Loop: ON' : 'Manual Mode'}
          </button>

          {/* End Call when Live */}
          {callStatus === 'Live' && sessionId && (
            <button
              onClick={handleEndCall}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center space-x-1.5 cursor-pointer"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span>End Call</span>
            </button>
          )}

          {/* ONE Start / Restart Call Button */}
          <button
            onClick={handleStartCall}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-sm flex items-center space-x-1.5 cursor-pointer"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>{sessionId ? 'Restart Call' : 'Start Verification Call'}</span>
          </button>
        </div>
      </div>

      {/* =========================================================
          2. SESSION SUMMARY STRIP
         ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { label: 'Fields Confirmed', val: `${metrics.confirmed_count ?? 0} of ${metrics.total_fields ?? flowOrder.length}` },
          { label: 'First-Pass Accuracy', val: `${metrics.first_pass_accuracy ?? 0}%` },
          { label: 'Correction Rate', val: `${metrics.correction_rate ?? 0}%` },
          { label: 'Avg Turns / Field', val: `${metrics.avg_turns_per_field ?? 0}` },
          { label: 'Escalation Count', val: `${metrics.escalation_count ?? 0}`, danger: (metrics.escalation_count ?? 0) > 0 },
        ].map((m, idx) => (
          <div key={idx} className="bg-white rounded-xl border border-slate-200/90 px-3.5 py-2.5 shadow-2xs flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500">{m.label}</span>
            <span className={`text-sm font-extrabold font-mono ${m.danger ? 'text-rose-600' : 'text-slate-900'}`}>
              {m.val}
            </span>
          </div>
        ))}
      </div>

      {/* =========================================================
          3. PROPER STATE BANNERS (loading, stt_failure, mic_denied, network_drop, low_audio)
         ========================================================= */}
      {isLoadingSession && (
        <div className="bg-slate-100 border border-slate-200 px-4 py-2.5 rounded-xl flex items-center space-x-2 text-xs text-slate-700">
          <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          <span className="font-semibold">Loading verification session snapshot...</span>
        </div>
      )}

      {errorState && (
        <div className="bg-rose-50 border border-rose-200 px-4 py-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs text-rose-900">
          <div className="flex items-center space-x-2">
            {errorState.type === 'network_drop' ? (
              <WifiOff className="w-4 h-4 text-rose-600 shrink-0" />
            ) : errorState.type === 'mic_permission_denied' ? (
              <MicOff className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-semibold uppercase text-[10px] px-1.5 py-0.5 rounded bg-rose-100 border border-rose-200">
              {errorState.type.replace(/_/g, ' ')}
            </span>
            <span className="font-medium">{errorState.message}</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (errorState.type === 'network_drop' && sessionId) {
                  connectRealtimeChannel(sessionId);
                  loadSessionSnapshot(sessionId);
                } else {
                  startMicCapture();
                }
              }}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] flex items-center space-x-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Retry</span>
            </button>
            <button
              onClick={() => setErrorState(null)}
              className="text-rose-700 hover:underline font-semibold text-[11px] cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* =========================================================
          4. MAIN 2-COLUMN LIVE OFFICER CONSOLE
         ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN: Conversation Panel + Half-Duplex Audio */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
          {/* Audio Waveform & Half-Duplex State Header */}
          <div className="p-4 border-b border-slate-100 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className={`inline-flex items-center space-x-2 px-2.5 py-1 rounded-full text-xs font-bold border ${micBadge.cls}`}>
                <span className={`w-2 h-2 rounded-full ${micBadge.dot}`}></span>
                <span>Mic: {micBadge.text}</span>
              </div>

              <div className="flex items-center space-x-1.5">
                {isPlayingAudio ? (
                  <button
                    onClick={stopTtsAudio}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 flex items-center space-x-1 cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Stop AI Audio</span>
                  </button>
                ) : micState === 'listening' ? (
                  <button
                    onClick={() => stopMicStream(true)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center space-x-1 cursor-pointer"
                  >
                    <MicOff className="w-3.5 h-3.5" />
                    <span>Stop &amp; Transcribe</span>
                  </button>
                ) : (
                  <button
                    onClick={startMicCapture}
                    disabled={micState === 'processing'}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white flex items-center space-x-1 cursor-pointer"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Speak / Listen</span>
                  </button>
                )}
              </div>
            </div>

            {/* Real Web Audio FFT Waveform */}
            <div className="h-12 bg-slate-900 rounded-xl px-3 flex items-center justify-between gap-1 border border-slate-800">
              {waveformBars.map((h, i) => (
                <div
                  key={i}
                  style={{ height: `${Math.max(8, Math.min(100, h))}%` }}
                  className={`flex-1 rounded-full transition-all duration-75 ${
                    micState === 'listening'
                      ? 'bg-rose-400'
                      : micState === 'speaking'
                      ? 'bg-emerald-400'
                      : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>

            {/* Voice Config Strip (Scheme, Lang, TTS Tone) */}
            <div className="grid grid-cols-3 gap-2 text-[11px]">
              <label className="flex flex-col space-y-0.5">
                <span className="text-slate-400 font-bold uppercase text-[9px]">Phonetic Scheme</span>
                <select
                  value={phoneticScheme}
                  onChange={(e) => handleSchemeChange(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 outline-none"
                >
                  <option value="indian">Indian (A se Amit)</option>
                  <option value="nato">NATO (A for Alpha)</option>
                </select>
              </label>
              <label className="flex flex-col space-y-0.5">
                <span className="text-slate-400 font-bold uppercase text-[9px]">STT Language</span>
                <select
                  value={sttLanguage}
                  onChange={(e) => onSttLanguageChange && onSttLanguageChange(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 outline-none"
                >
                  <option value="indic-auto">Hinglish Auto</option>
                  <option value="hi-IN">Hindi (hi-IN)</option>
                  <option value="en-IN">English (en-IN)</option>
                </select>
              </label>
              <label className="flex flex-col space-y-0.5">
                <span className="text-slate-400 font-bold uppercase text-[9px]">TTS Voice</span>
                <select
                  value={ttsVoice}
                  onChange={(e) => onTtsVoiceChange && onTtsVoiceChange(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 font-semibold text-slate-700 outline-none"
                >
                  <option value="Devansh">Devansh (Timbre v3)</option>
                  <option value="Yashraj">Yashraj (Timbre v3)</option>
                </select>
              </label>
            </div>
          </div>

          {/* Tagged Conversation Messages */}
          <div className="p-4 space-y-3 h-[380px] overflow-y-auto bg-slate-50/30">
            {(sessionState?.dialogue_log || []).length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-4">
                <Mic className="w-8 h-8 mb-2 text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">Click Start Verification Call to begin automated Hinglish KYC verification.</p>
                <p className="text-[11px] mt-1">AI speech runs half-duplex so prompts are never echoed back into customer STT.</p>
              </div>
            ) : (
              (sessionState.dialogue_log || []).map((msg, idx) => {
                const role = msg.role || (msg.sender === 'ai' ? 'agent' : 'customer');
                const isAgent = role === 'agent';
                const msgField = msg.field || msg.target_id;
                return (
                  <div key={idx} className={`flex flex-col ${isAgent ? 'items-start' : 'items-end'}`}>
                    <div className="flex items-center space-x-1.5 mb-1 text-[10px] text-slate-400 font-semibold">
                      <span className={`uppercase font-bold px-1.5 py-0.2 rounded ${
                        isAgent ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {role}
                      </span>
                      {msgField && (
                        <span className="font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {msgField}
                        </span>
                      )}
                      <span>{formatClockTime(msg.timestamp)}</span>
                    </div>
                    <div
                      className={`max-w-[90%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed border ${
                        isAgent
                          ? 'bg-white border-slate-200 text-slate-800 rounded-tl-xs shadow-2xs'
                          : 'bg-emerald-600 border-emerald-700 text-white rounded-tr-xs shadow-xs'
                      }`}
                    >
                      <p>{msg.text}</p>
                      <div className="mt-1.5 flex items-center justify-end gap-2">
                        {isAgent ? (
                          <button
                            onClick={() => speakText(msg.text)}
                            className="text-[10px] font-semibold text-emerald-700 hover:underline flex items-center space-x-1 cursor-pointer"
                          >
                            <Volume2 className="w-3 h-3" />
                            <span>Re-hear</span>
                          </button>
                        ) : msg.audio_clip_ref ? (
                          <button
                            onClick={() => playAuditClip(msg.audio_clip_ref)}
                            className="text-[10px] font-semibold text-emerald-100 hover:text-white flex items-center space-x-1 cursor-pointer"
                          >
                            <Play className="w-3 h-3" />
                            <span>{playingClipRef === msg.audio_clip_ref ? 'Stop Clip' : 'Play Clip'}</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Manual Fallback Transcript Composer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitTextUtterance(manualText);
            }}
            className="p-3 border-t border-slate-100 bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="Manual fallback: type customer reply (e.g. Mera naam Rahul hai / Haan / Nahi, H hai)..."
              className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-emerald-400"
            />
            <button
              type="submit"
              disabled={!manualText.trim()}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send</span>
            </button>
          </form>

          {/* Demo Helper Strictly Gated to Dev / Demo Flag */}
          {IS_DEMO_ENABLED && (
            <div className="px-3 py-2 bg-amber-50/70 border-t border-amber-200/80 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="font-bold text-amber-800 flex items-center space-x-1 mr-1">
                <Sparkles className="w-3 h-3" />
                <span>Simulate customer speech input:</span>
              </span>
              {[
                { label: '"Mera naam Raul hai"', val: 'Mera naam Raul hai', conf: 74 },
                { label: '"Nahi, H hai"', val: 'Nahi, H hai', conf: 92 },
                { label: '"Haan"', val: 'Haan sahi hai', conf: 96 },
                { label: 'Bad Name ("confirm kar sakta hoon")', val: 'confirm kar sakta hoon', conf: 91 },
              ].map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => submitTextUtterance(s.val, s.conf)}
                  className="px-2 py-0.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-md font-semibold cursor-pointer"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Focused Active Entity Card + Collapsed Confirmed / Minimal Waiting */}
        <div className="lg:col-span-7 space-y-3">
          {/* Active / Focused Card (Dominant) */}
          {activeEntity && renderExpandedEntityCard(activeEntity, true)}

          {/* Confirmed & Corrected Fields (Collapsed 1-line, click to expand) */}
          <div className="space-y-2">
            {orderedEntities
              .filter((e) => e.id !== activeEntity?.id && (e.status === 'confirmed' || e.status === 'verified'))
              .map((entity) => {
                const isExp = Boolean(expandedConfirmed[entity.id]);
                if (isExp) {
                  return (
                    <div key={entity.id} className="space-y-1">
                      {renderExpandedEntityCard(entity, false)}
                      <button
                        onClick={() => setExpandedConfirmed((p) => ({ ...p, [entity.id]: false }))}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 ml-2 cursor-pointer"
                      >
                        Collapse {entity.label}
                      </button>
                    </div>
                  );
                }
                return (
                  <div
                    key={entity.id}
                    onClick={() => setExpandedConfirmed((p) => ({ ...p, [entity.id]: true }))}
                    className="bg-white rounded-xl border border-emerald-200 px-3.5 py-2.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-emerald-50/40 transition"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="text-xs font-bold text-slate-700 shrink-0">{entity.label}</span>
                      <span className="font-mono text-xs font-bold text-slate-900 truncate">{entity.value}</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        Confirmed
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 shrink-0 text-[11px] font-mono text-slate-500">
                      <span>STT {Math.round(entity.stt_confidence ?? 0)}%</span>
                      <span>Val {Math.round(entity.validator_confidence ?? 0)}%</span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                );
              })}

            {/* Other Non-Waiting Cards (e.g. Captured / Escalated not currently active) */}
            {orderedEntities
              .filter(
                (e) =>
                  e.id !== activeEntity?.id &&
                  e.status !== 'confirmed' &&
                  e.status !== 'verified' &&
                  e.status !== 'waiting'
              )
              .map((entity) => renderExpandedEntityCard(entity, false))}

            {/* Waiting Fields (Minimal 1-line) */}
            {orderedEntities
              .filter((e) => e.id !== activeEntity?.id && e.status === 'waiting')
              .map((entity) => (
                <div
                  key={entity.id}
                  onClick={() => setSelectedFieldId(entity.id)}
                  className="bg-white/70 rounded-xl border border-slate-200/80 px-3.5 py-2 flex items-center justify-between text-xs text-slate-500 cursor-pointer hover:border-slate-300"
                >
                  <div className="flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-600">{entity.label}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200">
                    Waiting
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* =========================================================
          5. COLLAPSIBLE SESSION AUDIT TRAIL
         ========================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <button
          onClick={() => setAuditOpen((v) => !v)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition cursor-pointer"
        >
          <div className="flex items-center space-x-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-900 text-xs sm:text-sm">
              Session Audit Trail ({(sessionState?.audit_trail || []).length} events)
            </span>
            <span className="text-[11px] text-slate-400">
              Every phonetic read-back, customer response, correction &amp; audio clip ref
            </span>
          </div>
          {auditOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </button>

        {auditOpen && (
          <div className="border-t border-slate-100 divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {(sessionState?.audit_trail || []).length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400 italic">No audit events recorded for this session yet.</div>
            ) : (
              (sessionState.audit_trail || []).map((ev, i) => (
                <div key={i} className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-slate-400">{formatClockTime(ev.timestamp)}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                      {ev.event_type}
                    </span>
                    {ev.field && (
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10px]">
                        {ev.field}
                      </span>
                    )}
                    <span className="text-slate-800 truncate">{ev.text}</span>
                    {ev.before !== undefined && ev.after !== undefined && (
                      <span className="font-mono text-[11px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        <span className="line-through text-rose-600 mr-1">{ev.before}</span>-&gt;{' '}
                        <span className="text-emerald-700 font-bold ml-1">{ev.after}</span>
                      </span>
                    )}
                  </div>
                  {ev.audio_clip_ref && (
                    <button
                      onClick={() => playAuditClip(ev.audio_clip_ref)}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 text-[11px] font-semibold flex items-center space-x-1 cursor-pointer shrink-0"
                    >
                      <Play className="w-3 h-3" />
                      <span>{playingClipRef === ev.audio_clip_ref ? 'Playing...' : ev.audio_clip_ref}</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

