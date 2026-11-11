import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Volume2, CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  Search, Filter, ChevronRight, ArrowUpRight, ArrowDownRight, ShieldCheck,
  User, Phone, MapPin, CreditCard, Calendar, FileText, Settings, BarChart3,
  History, LayoutDashboard, Radio, Play, Pause, RotateCcw, Check, X,
  Sliders, Bell, Download, ExternalLink, HelpCircle, Sparkles, Building,
  Layers, Lock, Eye, AlertCircle, Info, ChevronDown, Clock, Timer, ShieldAlert,
  Menu, ChevronUp, Zap, CheckCircle, LogOut, Home, Mail, Wallet, Activity, Cpu,
  Server, MessageSquare
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  fetchHealthAPI,
  fetchDashboardMetrics,
  fetchDetailedAnalytics,
  fetchSessions,
  fetchSessionDetails,
  createSession,
  updateSession,
  transcribeAudioBlob,
  transcribeSampleAudioAPI,
  processDialogueAPI,
  fetchVoiceStatusAPI,
  synthesizeSpeechAPI,
  extractEntitiesFromText,
  confirmEntityAPI,
  correctEntityAPI,
  downloadComplianceCSV,
  fetchCurrentUser
} from './api';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import RegisterPage from './components/RegisterPage';

// --- PHONETIC ALPHABET DICTIONARY ---
const NATO_PHONETIC = {
  A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo',
  F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliet',
  K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar',
  P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango',
  U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu',
  '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
  '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine'
};

const INDIAN_BANKING_PHONETIC = {
  A: 'Apple', B: 'Bombay', C: 'Chennai', D: 'Delhi', E: 'Elephant',
  F: 'Faridabad', G: 'Gujarat', H: 'Haryana', I: 'India', J: 'Jaipur',
  K: 'Kolkata', L: 'Lucknow', M: 'Mumbai', N: 'Nagpur', O: 'Orissa',
  P: 'Pune', Q: 'Queen', R: 'Ranchi', S: 'Shimla', T: 'Tamil',
  U: 'Uttar', 'V': 'Varanasi', W: 'West', X: 'X-ray', Y: 'Yamuna', Z: 'Zari',
  '0': 'Zero', '1': 'One', '2': 'Two', '3': 'Three', '4': 'Four',
  '5': 'Five', '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine'
};

const ENTITY_ICONS = {
  name: User,
  phone: Phone,
  email: Mail,
  address: MapPin,
  amount: Wallet,
  dob: Calendar,
  account: CreditCard,
  id_doc: FileText
};

const INITIAL_ENTITIES = [
  {
    id: 'name',
    label: 'Full Name',
    value: '',
    type: 'alpha',
    confidence: 0,
    status: 'waiting',
    history: [],
    phoneticSummary: 'Waiting for vocal input...',
    icon: User,
    verifiedAt: null
  },
  {
    id: 'phone',
    label: 'Phone Number',
    value: '',
    type: 'numeric',
    confidence: 0,
    status: 'waiting',
    history: [],
    phoneticSummary: 'Waiting for vocal input...',
    icon: Phone,
    verifiedAt: null
  },
  {
    id: 'email',
    label: 'Email Address',
    value: '',
    type: 'email',
    confidence: 0,
    status: 'waiting',
    history: [],
    phoneticSummary: 'Waiting for vocal input...',
    icon: Mail,
    verifiedAt: null
  },
  {
    id: 'address',
    label: 'Residential Address',
    value: '',
    type: 'address',
    confidence: 0,
    status: 'waiting',
    history: [],
    phoneticSummary: 'Waiting for vocal input...',
    icon: MapPin,
    verifiedAt: null
  },
  {
    id: 'amount',
    label: 'Amount (INR)',
    value: '',
    type: 'amount',
    confidence: 0,
    status: 'waiting',
    history: [],
    phoneticSummary: 'Waiting for vocal input...',
    icon: Wallet,
    verifiedAt: null
  },
  {
    id: 'dob',
    label: 'Date of Birth',
    value: '',
    type: 'date',
    confidence: 0,
    status: 'waiting',
    history: [],
    phoneticSummary: 'Waiting for vocal input...',
    icon: Calendar,
    verifiedAt: null
  },
  {
    id: 'account',
    label: 'Account Number',
    value: '',
    type: 'numeric',
    confidence: 0,
    status: 'waiting',
    history: [],
    phoneticSummary: 'Waiting for vocal input...',
    icon: CreditCard,
    verifiedAt: null
  },
  {
    id: 'id_doc',
    label: 'National ID / PAN',
    value: '',
    type: 'alphanumeric',
    confidence: 0,
    status: 'waiting',
    history: [],
    phoneticSummary: 'Waiting for vocal input...',
    icon: FileText,
    verifiedAt: null
  }
];

const HISTORICAL_SESSIONS = [];

// Modern EchoTrust Brand Logo Component (Resonant Sound-Wave & Trust Shield - Emerald Edition)
function EchoTrustLogo({ className = "w-6 h-6" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="echoTrustGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#34D399" />
          <stop offset="0.5" stopColor="#10B981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      {/* Outer Protective Trust Shield */}
      <path 
        d="M12 2.5L4 6.2V11.5C4 16.8 7.4 21.2 12 22.5C16.6 21.2 20 16.8 20 11.5V6.2L12 2.5Z" 
        stroke="url(#echoTrustGrad)" 
        strokeWidth="1.75" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="url(#echoTrustGrad)" 
        fillOpacity="0.18" 
      />
      {/* Resonant Acoustic Waveform Bars */}
      <rect x="7" y="10.5" width="1.5" height="3" rx="0.75" fill="#34D399" />
      <rect x="9.5" y="8" width="1.5" height="8" rx="0.75" fill="#6EE7B7" />
      <rect x="12" y="6" width="1.5" height="12" rx="0.75" fill="#FFFFFF" />
      <rect x="14.5" y="8" width="1.5" height="8" rx="0.75" fill="#10B981" />
      <rect x="17" y="10.5" width="1.5" height="3" rx="0.75" fill="#059669" />
    </svg>
  );
}

function EchoTrustDashboard({ user, onLogout, onGoHome }) {
  // Navigation State - Defaults to Analytics as requested in the redesign prompt!
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'dashboard', 'live', 'entities', 'history', 'settings', 'audit_logs'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('Last 30 Days');
  
  // Live Verification Session State (starts empty, populated only from real sessions)
  const [currentSessionId, setCurrentSessionId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [appNo, setAppNo] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [callDuration, setCallDuration] = useState(0); // starts at 00:00
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeEntityIndex, setActiveEntityIndex] = useState(null); // null until an entity is being verified
  const [entities, setEntities] = useState(INITIAL_ENTITIES);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState(null);
  const [correctionInput, setCorrectionInput] = useState('');
  const [audioFeedbackNotice, setAudioFeedbackNotice] = useState('');
  const [errorBanner, setErrorBanner] = useState('');
  const [verificationSummary, setVerificationSummary] = useState('');
  const [selectedSttLanguage, setSelectedSttLanguage] = useState('indic-auto'); // 'indic-auto' (Hindi + English + Hinglish)
  const [sttEngineStatus, setSttEngineStatus] = useState('Gnani Prisma-v3.0 (indic-auto)');
  const [selectedTtsVoice, setSelectedTtsVoice] = useState('Devansh'); // Selected conversational Indian Male Hinglish tone (Timbre v3.0)
  const [selectedTtsModel, setSelectedTtsModel] = useState('timbre-v3.0');
  const [voiceApiStatus, setVoiceApiStatus] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);

  // Real-time audio waveform visualizer bars (22 frequency slots)
  const [audioWaveformHeights, setAudioWaveformHeights] = useState(
    [35, 60, 20, 85, 95, 45, 100, 70, 40, 90, 65, 30, 80, 50, 25, 90, 40, 75, 30, 60, 85, 20]
  );
  
  // Web Audio Context, MediaRecorder & Barge-In Monitor Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);
  const activeAudioRef = useRef(null);
  const audioAnimationIntervalRef = useRef(null);
  const currentPlaybackIdRef = useRef(0);
  const bargeInStreamRef = useRef(null);
  const bargeInCtxRef = useRef(null);
  const bargeInRafRef = useRef(null);
  const creatingSessionPromiseRef = useRef(null);
  const currentSessionIdRef = useRef('');
  const activeTargetIdRef = useRef('name');

  // Full Automation (Autonomous Voice Loop) State & Refs
  const [isAutonomousMode, setIsAutonomousMode] = useState(true);
  const isAutonomousModeRef = useRef(true);
  const isRecordingRef = useRef(false);
  const isProcessingAudioRef = useRef(false);
  const hasSpokenInTurnRef = useRef(false);
  const lastSpokenTimeRef = useRef(null);

  // Settings state
  const [phoneticStandard, setPhoneticStandard] = useState('nato');
  const [autoPassThreshold, setAutoPassThreshold] = useState(90);
  const [mandatoryGateThreshold, setMandatoryGateThreshold] = useState(75);
  const [autoRejectThreshold, setAutoRejectThreshold] = useState(60);

  // Dashboard & History live backend state (zero fake numbers)
  const [dashboardStats, setDashboardStats] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('All Statuses');
  const [historyChannelFilter, setHistoryChannelFilter] = useState('All Channels');
  const [analyticsData, setAnalyticsData] = useState(null);

  // Real-time dialogue log (starts empty, only displays real speech / typed input)
  const [dialogue, setDialogue] = useState([]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    if (activeEntityIndex !== null && entities[activeEntityIndex]) {
      activeTargetIdRef.current = entities[activeEntityIndex].id;
    }
  }, [activeEntityIndex, entities]);

  const hydrateSessionFromBackend = (sessionData) => {
    if (!sessionData) return;
    const s = sessionData.session || sessionData;
    const sid = s.id || s.session_id || '';
    if (sid) {
      setCurrentSessionId(sid);
      currentSessionIdRef.current = sid;
      try { sessionStorage.setItem('echotrust_active_session_id', sid); } catch (e) {}
    }
    if (s.customer_name && s.customer_name !== 'Pending Identification' && s.customer_name !== 'New Applicant') {
      setCustomerName(s.customer_name);
    }
    if (s.customer_code || s.customer_id) setCustomerId(s.customer_code || s.customer_id);
    if (s.app_no) setAppNo(s.app_no);
    if (s.verification_summary) setVerificationSummary(s.verification_summary);

    const dbEntities = Array.isArray(s.entities) ? s.entities : [];
    if (dbEntities.length > 0) {
      setEntities(INITIAL_ENTITIES.map(base => {
        const match = dbEntities.find(de => (de.entity_type || de.id) === base.id);
        if (!match) return { ...base };
        return {
          ...base,
          value: match.value || '',
          confidence: Math.round(match.confidence || 0),
          status: match.status || 'waiting',
          history: match.history || (match.value ? [match.value] : []),
          phoneticSummary: match.phonetic_summary || match.phoneticSummary || 'Waiting for vocal input...',
          verifiedAt: match.verified_at || match.verifiedAt || null,
        };
      }));
    }

    const logs = Array.isArray(s.dialogue_log) ? s.dialogue_log : [];
    if (logs.length > 0) {
      setDialogue(logs.map((m, idx) => ({
        id: m.id || `msg-${idx}`,
        sender: m.sender === 'customer' ? 'user' : m.sender,
        text: m.text || '',
        phonetic: m.action === 'confirm_entity',
        time: m.timestamp ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '',
      })));
    }

    if (s.active_target_id) {
      activeTargetIdRef.current = s.active_target_id;
      const targetIdx = INITIAL_ENTITIES.findIndex(e => e.id === s.active_target_id);
      setActiveEntityIndex(targetIdx !== -1 ? targetIdx : null);
    }
  };

  const recoverActiveSession = async () => {
    try {
      const savedSid = sessionStorage.getItem('echotrust_active_session_id');
      if (savedSid) {
        const details = await fetchSessionDetails(savedSid);
        if (details && details.id && details.status === 'In Progress') {
          hydrateSessionFromBackend(details);
        } else if (details && details.status !== 'In Progress') {
          sessionStorage.removeItem('echotrust_active_session_id');
        }
      }
    } catch (e) {
      try { sessionStorage.removeItem('echotrust_active_session_id'); } catch (err) {}
    }
  };

  const loadHealthStatus = async () => {
    const h = await fetchHealthAPI();
    if (h) setHealthStatus(h);
  };

  // Load live data from Backend API on mount & tab changes + auto-recovery
  useEffect(() => {
    loadHealthStatus();
    recoverActiveSession();
    loadDashboardData();
    loadAnalyticsData();
    loadSessionsList();
    loadVoiceStatus();
  }, []);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    const poll = setInterval(() => {
      loadDashboardData();
      loadHealthStatus();
    }, 10000);
    return () => clearInterval(poll);
  }, [activeTab]);

  const loadVoiceStatus = async () => {
    try {
      const status = await fetchVoiceStatusAPI();
      if (status) {
        setVoiceApiStatus(status);
        if (status.tts && status.tts.voice) {
          setSelectedTtsVoice(status.tts.voice);
        }
      }
    } catch (e) {
      console.warn('Voice status check:', e);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard') {
      loadDashboardData();
      loadHealthStatus();
    } else if (activeTab === 'history' || activeTab === 'audit_logs') {
      loadSessionsList();
    } else if (activeTab === 'analytics') {
      loadAnalyticsData();
    }
  }, [activeTab]);

  const loadDashboardData = async () => {
    try {
      const data = await fetchDashboardMetrics();
      if (data) {
        setDashboardStats(data);
        if (data.services) {
          setHealthStatus(prev => ({ ...(prev || { backend: { connected: true, status: 'Online' } }), ...data.services }));
        }
        if (Array.isArray(data.recent_sessions)) {
          const mapped = data.recent_sessions.map(s => ({
            id: s.id,
            customer: s.customer || s.customer_name || 'Pending Identification',
            customerId: s.customerId || s.customer_id || '',
            appNo: s.app_no,
            entityCount: s.entity_count || 8,
            initialConf: Math.round(s.initial_conf || 0),
            finalConf: Math.round(s.final_conf || 0),
            corrections: s.corrections || 0,
            status: s.status || 'In Progress',
            time: new Date(s.updated_at || s.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            channel: s.channel || 'Automated Voice Agent'
          }));
          setRecentSessions(mapped);
        }
      }
    } catch (err) {
      setErrorBanner(`Dashboard sync error: ${err.message || 'Backend unreachable'}`);
    }
  };

  const loadSessionsList = async () => {
    try {
      const data = await fetchSessions({
        search: historySearch,
        status: historyStatusFilter,
        channel: historyChannelFilter
      });
      if (data && data.sessions) {
        const mapped = data.sessions.map(s => ({
          id: s.id,
          customer: s.customer_name || s.customer || 'Pending Identification',
          customerId: s.customer_code || s.customer_id || '',
          appNo: s.app_no,
          entityCount: s.entity_count || 8,
          initialConf: Math.round(s.initial_conf || 0),
          finalConf: Math.round(s.final_conf || 0),
          corrections: s.corrections || 0,
          status: s.status || 'In Progress',
          time: new Date(s.updated_at || s.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          channel: s.channel || 'Automated Voice Agent'
        }));
        setHistoryList(mapped);
      }
    } catch (err) {
      console.warn('Sessions list API error:', err);
    }
  };

  const loadAnalyticsData = async () => {
    try {
      const data = await fetchDetailedAnalytics();
      if (data) {
        setAnalyticsData(data);
      }
    } catch (err) {
      console.warn('Analytics API error:', err);
    }
  };

  // Switch session into Live Verification (full DB hydration)
  const inspectSession = async (sess) => {
    try {
      setCurrentSessionId(sess.id);
      currentSessionIdRef.current = sess.id;
      setCustomerName(sess.customer === 'Pending Identification' ? '' : sess.customer);
      setCustomerId(sess.customerId);
      setAppNo(sess.appNo);
      setActiveTab('live');

      const details = await fetchSessionDetails(sess.id);
      if (details) {
        hydrateSessionFromBackend(details);
      }
    } catch (err) {
      setErrorBanner(`Could not load session details: ${err.message}`);
      setActiveTab('live');
    }
  };

  // NATO Phonetic helper
  const getPhoneticSpelling = (text) => {
    if (!text) return [];
    const dict = phoneticStandard === 'indian' ? INDIAN_BANKING_PHONETIC : NATO_PHONETIC;
    const clean = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return clean.split('').map(char => ({
      char,
      code: dict[char] || char
    }));
  };

  const ensureSessionActive = async (forceNew = false) => {
    if (!forceNew && currentSessionIdRef.current) return currentSessionIdRef.current;
    if (!forceNew && creatingSessionPromiseRef.current) {
      return creatingSessionPromiseRef.current;
    }

    const createTask = (async () => {
      try {
        const created = await createSession({
          customer_name: 'Pending Identification',
          channel: 'Automated Voice Agent',
          status: 'In Progress',
          entity_count: 8,
        });
        const sid = created.id;
        setCurrentSessionId(sid);
        currentSessionIdRef.current = sid;
        setCustomerId(created.customer_code || created.customer_id || '');
        setAppNo(created.app_no || '');
        setVerificationSummary(created.verification_summary || '');
        try { sessionStorage.setItem('echotrust_active_session_id', sid); } catch (e) {}
        return sid;
      } catch (err) {
        setErrorBanner(`Database session error: ${err.message}. Falling back to local session ID.`);
        const fallbackId = `SES-${Math.floor(10000 + Math.random() * 90000)}`;
        setCurrentSessionId(fallbackId);
        currentSessionIdRef.current = fallbackId;
        setCustomerId(`CUST-${Math.floor(1000 + Math.random() * 9000)}`);
        setAppNo(`LOAN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
        return fallbackId;
      } finally {
        creatingSessionPromiseRef.current = null;
      }
    })();

    creatingSessionPromiseRef.current = createTask;
    return createTask;
  };

  // Live session timer ticker (counts only once a session has started or while recording)
  useEffect(() => {
    let interval;
    if (currentSessionId || isRecording) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [currentSessionId, isRecording]);

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  const stopBargeInMonitor = () => {
    if (bargeInRafRef.current) {
      cancelAnimationFrame(bargeInRafRef.current);
      bargeInRafRef.current = null;
    }
    if (bargeInStreamRef.current) {
      bargeInStreamRef.current.getTracks().forEach(t => t.stop());
      bargeInStreamRef.current = null;
    }
    if (bargeInCtxRef.current) {
      bargeInCtxRef.current.close().catch(() => {});
      bargeInCtxRef.current = null;
    }
  };

  const startBargeInMonitor = async () => {
    if (!isAutonomousModeRef.current || isRecordingRef.current) return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    stopBargeInMonitor();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      bargeInStreamRef.current = stream;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      bargeInCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);

      const data = new Uint8Array(analyser.frequencyBinCount);
      const startedAt = Date.now();
      let hotFrames = 0;

      const checkSpeech = () => {
        if (!activeAudioRef.current || isRecordingRef.current || !isAutonomousModeRef.current) {
          stopBargeInMonitor();
          return;
        }
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;

        // 450ms echo guard + sustained voice > threshold triggers automatic barge-in
        if (Date.now() - startedAt > 450 && avg > 34) {
          hotFrames += 1;
          if (hotFrames >= 5) {
            stopBargeInMonitor();
            interruptAudioPlayback();
            setAudioFeedbackNotice('Voice interruption detected — listening to you now...');
            startMicrophoneCapture();
            return;
          }
        } else {
          hotFrames = Math.max(0, hotFrames - 1);
        }
        bargeInRafRef.current = requestAnimationFrame(checkSpeech);
      };
      bargeInRafRef.current = requestAnimationFrame(checkSpeech);
    } catch {
      // Permission not yet granted or denied cleanly; manual interrupt button remains available
    }
  };

  const interruptAudioPlayback = () => {
    currentPlaybackIdRef.current += 1;
    stopBargeInMonitor();
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.currentTime = 0;
        activeAudioRef.current.src = "";
        activeAudioRef.current.onplay = null;
        activeAudioRef.current.onended = null;
        activeAudioRef.current.onerror = null;
      } catch (e) {}
      activeAudioRef.current = null;
    }
    if (audioAnimationIntervalRef.current) {
      clearInterval(audioAnimationIntervalRef.current);
      audioAnimationIntervalRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch (e) {}
    }
    setIsPlayingAudio(false);
    setAudioFeedbackNotice('');
    setAudioWaveformHeights([35, 60, 20, 85, 95, 45, 100, 70, 40, 90, 65, 30, 80, 50, 25, 90, 40, 75, 30, 60, 85, 20]);
  };

  // Text-to-Speech Readback using Official Gnani Timbre v3.0 (Default: Devansh Male Conversational Voice)
  const speakReadBack = async (text, customSpelling = null, forceAutoListen = null) => {
    let speechContent = customSpelling || text;
    if (!speechContent || !speechContent.trim()) return;

    interruptAudioPlayback();
    const myPlaybackId = currentPlaybackIdRef.current;

    setIsPlayingAudio(true);
    setAudioFeedbackNotice(`Gnani Timbre v3.0 (${selectedTtsVoice}): Synthesizing Hinglish voice...`);

    const startWaveformAnimation = () => {
      if (audioAnimationIntervalRef.current) clearInterval(audioAnimationIntervalRef.current);
      audioAnimationIntervalRef.current = setInterval(() => {
        setAudioWaveformHeights(prev => prev.map(() => Math.floor(Math.random() * 75) + 25));
      }, 90);
    };

    const stopWaveformAnimation = () => {
      stopBargeInMonitor();
      if (audioAnimationIntervalRef.current) {
        clearInterval(audioAnimationIntervalRef.current);
        audioAnimationIntervalRef.current = null;
      }
      setAudioWaveformHeights([35, 60, 20, 85, 95, 45, 100, 70, 40, 90, 65, 30, 80, 50, 25, 90, 40, 75, 30, 60, 85, 20]);
      setIsPlayingAudio(false);
      setAudioFeedbackNotice('');
    };

    try {
      const audioUrl = await synthesizeSpeechAPI(speechContent, {
        voice: selectedTtsVoice || 'Devansh',
        model: selectedTtsModel || 'timbre-v3.0',
        speed: 1.0
      });

      if (myPlaybackId !== currentPlaybackIdRef.current) {
        if (audioUrl) {
          try { URL.revokeObjectURL(audioUrl); } catch (e) {}
        }
        return;
      }

      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause();
          activeAudioRef.current.src = "";
        } catch (e) {}
        activeAudioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      audio.onplay = () => {
        if (myPlaybackId !== currentPlaybackIdRef.current) {
          try { audio.pause(); audio.src = ""; } catch (e) {}
          return;
        }
        setIsPlayingAudio(true);
        startWaveformAnimation();
        setAudioFeedbackNotice(`EchoTrust AI (${selectedTtsVoice} • Timbre v3.0): "${speechContent.slice(0, 58)}..."`);
        startBargeInMonitor();
      };

      audio.onended = () => {
        if (myPlaybackId === currentPlaybackIdRef.current) {
          stopWaveformAnimation();
          activeAudioRef.current = null;
          const shouldListen = forceAutoListen !== null ? forceAutoListen : isAutonomousModeRef.current;
          if (shouldListen && isAutonomousModeRef.current) {
            setAudioFeedbackNotice('EchoTrust AI is listening... Speak naturally into your microphone.');
            setTimeout(() => {
              if (isAutonomousModeRef.current && !isRecordingRef.current && !isProcessingAudioRef.current && !activeAudioRef.current) {
                startMicrophoneCapture();
              }
            }, 350);
          }
        }
        try { URL.revokeObjectURL(audioUrl); } catch (e) {}
      };

      audio.onerror = (e) => {
        console.warn('Gnani TTS playback error:', e);
        if (myPlaybackId === currentPlaybackIdRef.current) {
          stopWaveformAnimation();
          activeAudioRef.current = null;
          setErrorBanner('Audio playback blocked or failed. Allow browser audio/autoplay permissions or click Play on any message.');
        }
        try { URL.revokeObjectURL(audioUrl); } catch (err) {}
      };

      await audio.play();
    } catch (apiErr) {
      if (apiErr && (apiErr.name === 'AbortError' || apiErr.message?.includes('interrupted') || apiErr.message?.includes('abort'))) {
        return;
      }
      if (myPlaybackId === currentPlaybackIdRef.current) {
        stopWaveformAnimation();
        setErrorBanner(`Gnani TTS error (${selectedTtsVoice}): ${apiErr.message || 'Audio synthesis failed'}`);
        setAudioFeedbackNotice('TTS unavailable — read the AI response above or respond via mic/text.');
        if (isAutonomousModeRef.current) {
          setTimeout(() => {
            if (isAutonomousModeRef.current && !isRecordingRef.current && !isProcessingAudioRef.current) {
              startMicrophoneCapture();
            }
          }, 500);
        }
      }
    }
  };

  // Full Automation: Create DB session, greet via Gnani Timbre v3.0 (Devansh), and start hands-free voice loop
  const handleStartAutomatedSession = async () => {
    setErrorBanner('');
    interruptAudioPlayback();
    setEntities(INITIAL_ENTITIES.map(e => ({ ...e })));
    setCustomerName('');
    setCallDuration(0);
    setActiveEntityIndex(0);
    activeTargetIdRef.current = 'name';
    hasSpokenInTurnRef.current = false;
    lastSpokenTimeRef.current = null;

    setIsAutonomousMode(true);
    isAutonomousModeRef.current = true;

    const sid = await ensureSessionActive(true);
    if (!sid) return;

    const openingGreeting = "Namaste! Main EchoTrust AI Verification Officer hoon. Aaj hum aapki KYC details verify karenge. Shuru karne ke liye kripya apna poora naam batayein?";

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDialogue([
      {
        id: Date.now(),
        sender: 'ai',
        text: openingGreeting,
        phonetic: false,
        time: timeNow
      }
    ]);

    loadDashboardData();
    await speakReadBack(openingGreeting, null, true);
  };

  // Unified Backend State Synchronizer (Single Source of Truth from FastAPI + SQLite/Supabase)
  const syncBackendTurnState = (res, fallbackTranscript = null) => {
    if (!res) return;

    if (res.session_id) {
      setCurrentSessionId(res.session_id);
      currentSessionIdRef.current = res.session_id;
      try { sessionStorage.setItem('echotrust_active_session_id', res.session_id); } catch (e) {}
    }
    if (res.customer_id) setCustomerId(res.customer_id);
    if (res.app_no) setAppNo(res.app_no);
    if (res.verification_summary) setVerificationSummary(res.verification_summary);

    if (res.entities && typeof res.entities === 'object' && !Array.isArray(res.entities)) {
      setEntities(INITIAL_ENTITIES.map(base => {
        const be = res.entities[base.id];
        if (!be) return { ...base };
        return {
          ...base,
          value: be.value || '',
          confidence: Math.round(be.confidence || 0),
          status: be.status || 'waiting',
          history: be.history || (be.value ? [be.value] : []),
          phoneticSummary: be.phoneticSummary || be.phonetic_summary || 'Waiting for vocal input...',
          verifiedAt: be.verifiedAt || be.verified_at || null,
        };
      }));

      if (res.entities.name && res.entities.name.value) {
        setCustomerName(res.entities.name.value);
      }
    } else if (res.extracted_entities && res.extracted_entities.length > 0) {
      applyExtractedEntities(res.extracted_entities, fallbackTranscript || '', res.confidence || 92, false);
    }

    if (Array.isArray(res.dialogue_log) && res.dialogue_log.length > 0) {
      setDialogue(res.dialogue_log.map((m, idx) => ({
        id: m.id || `turn-${idx}-${m.sender}`,
        sender: m.sender === 'customer' ? 'user' : m.sender,
        text: m.text || '',
        phonetic: m.action === 'confirm_entity',
        time: m.timestamp
          ? new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      })));
    }

    if (res.active_target_id) {
      activeTargetIdRef.current = res.active_target_id;
      const targetIdx = INITIAL_ENTITIES.findIndex(e => e.id === res.active_target_id);
      if (targetIdx !== -1) setActiveEntityIndex(targetIdx);
    } else if (res.action === 'all_confirmed') {
      activeTargetIdRef.current = null;
      setActiveEntityIndex(null);
      try { sessionStorage.removeItem('echotrust_active_session_id'); } catch (e) {}
    }

    // Auto-refresh Dashboard, Analytics & Health status from DB
    loadDashboardData();
    loadAnalyticsData();
    loadHealthStatus();
  };

  // Play and Transcribe reference audio with Official Gnani STT
  const handleProcessSampleAudio = async () => {
    if (isProcessingAudio) {
      setAudioFeedbackNotice('Please wait for current speech processing to complete...');
      return;
    }
    setErrorBanner('');
    const activeSess = await ensureSessionActive();
    setIsProcessingAudio(true);
    isProcessingAudioRef.current = true;
    setAudioFeedbackNotice(`Transcribing reference sample with Official Gnani STT (${selectedSttLanguage})...`);

    interruptAudioPlayback();

    try {
      const targetId = isCorrecting && correctionTarget ? correctionTarget.id : activeTargetIdRef.current;
      const res = await transcribeSampleAudioAPI(activeSess, targetId, selectedSttLanguage);

      syncBackendTurnState(res, res?.transcript);
      if (res && res.transcript) {
        const conf = res.confidence || 94.0;
        setSttEngineStatus(`Gnani ${res.model || 'prisma-v3.0'} (${res.language_code || selectedSttLanguage})`);
        const aiReply = res.reply || res.ai_response_text;
        if (aiReply) {
          await speakReadBack(aiReply, null, false);
        }
        setAudioFeedbackNotice(`Transcribed successfully via Official Gnani STT (${conf}% confidence)`);
      }
    } catch (err) {
      setErrorBanner(`Sample audio STT failed: ${err.message}`);
      setAudioFeedbackNotice('Failed to process sample audio with Gnani STT API.');
    } finally {
      setIsProcessingAudio(false);
      isProcessingAudioRef.current = false;
    }
  };

  // Convert browser-recorded audio blob (e.g. WebM/OGG) to clean 16kHz mono 16-bit PCM WAV for EchoTrust STT
  const convertBlobToWav = async (blob) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      
      const targetSampleRate = 16000;
      const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
        1,
        Math.max(1, Math.ceil(audioBuffer.duration * targetSampleRate)),
        targetSampleRate
      );
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);
      const renderedBuffer = await offlineCtx.startRendering();
      
      const channelData = renderedBuffer.getChannelData(0);
      
      // Calculate Peak Amplitude for dynamic gain normalization (boosts quiet voice, avoids clipping)
      let maxPeak = 0;
      for (let i = 0; i < channelData.length; i++) {
        const absVal = Math.abs(channelData[i]);
        if (absVal > maxPeak) maxPeak = absVal;
      }
      const gainMultiplier = maxPeak > 0.02 ? Math.min(3.5, 0.92 / maxPeak) : 1.0;

      const wavBuffer = new ArrayBuffer(44 + channelData.length * 2);
      const view = new DataView(wavBuffer);
      
      const writeString = (view, offset, string) => {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      };
      
      writeString(view, 0, 'RIFF');
      view.setUint32(4, 36 + channelData.length * 2, true);
      writeString(view, 8, 'WAVE');
      writeString(view, 12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true); // PCM format
      view.setUint16(22, 1, true); // Mono
      view.setUint32(24, targetSampleRate, true);
      view.setUint32(28, targetSampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeString(view, 36, 'data');
      view.setUint32(40, channelData.length * 2, true);
      
      let offset = 44;
      for (let i = 0; i < channelData.length; i++, offset += 2) {
        const s = Math.max(-1, Math.min(1, channelData[i] * gainMultiplier));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      }
      await ctx.close().catch(() => {});
      return new Blob([wavBuffer], { type: 'audio/wav' });
    } catch (e) {
      console.warn('WAV conversion fallback, using original audio blob:', e);
      return blob;
    }
  };

  // Real-time microphone audio capture with Web Audio API & VAD auto start/stop
  const startMicrophoneCapture = async () => {
    try {
      stopBargeInMonitor();
      await ensureSessionActive();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorBanner('Microphone access is not supported by your browser. Use Chrome/Edge HTTPS or type responses below.');
        return;
      }

      setAudioFeedbackNotice('Activating noise-suppressed microphone for Hindi/English/Hinglish speech...');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        }
      });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateWaveform = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          const newHeights = [];
          for (let i = 0; i < 22; i++) {
            const index = Math.floor((i / 22) * bufferLength);
            const val = dataArray[index] || 15;
            sum += val;
            const percentage = Math.max(15, Math.min(100, Math.round((val / 255) * 100)));
            newHeights.push(percentage);
          }
          setAudioWaveformHeights(newHeights);

          const avgVolume = sum / 22;
          const now = Date.now();
          if (avgVolume > 20) {
            hasSpokenInTurnRef.current = true;
            lastSpokenTimeRef.current = now;
          } else if (hasSpokenInTurnRef.current && lastSpokenTimeRef.current) {
            const silenceMs = now - lastSpokenTimeRef.current;
            if (isAutonomousModeRef.current && silenceMs > 1300) {
              hasSpokenInTurnRef.current = false;
              lastSpokenTimeRef.current = null;
              stopMicrophoneCapture();
              return;
            }
          }

          animationFrameRef.current = requestAnimationFrame(updateWaveform);
        }
      };
      animationFrameRef.current = requestAnimationFrame(updateWaveform);

      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const rawBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const wavBlob = await convertBlobToWav(rawBlob);
        await handleAudioCaptured(wavBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      isRecordingRef.current = true;
      hasSpokenInTurnRef.current = false;
      lastSpokenTimeRef.current = null;
      setAudioFeedbackNotice('Listening in real time... Speak clearly in Hindi, English, or Hinglish.');
    } catch (err) {
      setIsRecording(false);
      isRecordingRef.current = false;
      const deniedMsg = `Microphone permission denied or unavailable (${err.message || 'Permission denied'}). Grant mic access or type below to continue.`;
      setErrorBanner(deniedMsg);
      setAudioFeedbackNotice(deniedMsg);
    }
  };

  const stopMicrophoneCapture = () => {
    isRecordingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
    }
    setIsRecording(false);
  };

  const handleToggleRecording = () => {
    if (isProcessingAudio) {
      setAudioFeedbackNotice('Gnani STT is actively transcribing previous audio. Please wait a moment...');
      return;
    }
    if (isRecording) {
      stopMicrophoneCapture();
    } else {
      // Interrupt any playing audio before recording
      interruptAudioPlayback();
      startMicrophoneCapture();
    }
  };

  const handleAudioCaptured = async (audioBlob) => {
    if (!audioBlob || audioBlob.size < 250) {
      setAudioFeedbackNotice('Vocal audio was too brief. Please speak clearly into your microphone.');
      setIsProcessingAudio(false);
      isProcessingAudioRef.current = false;
      if (isAutonomousModeRef.current) {
        setTimeout(() => {
          if (isAutonomousModeRef.current && !isRecordingRef.current && !activeAudioRef.current) {
            startMicrophoneCapture();
          }
        }, 1200);
      }
      return;
    }

    const activeSess = await ensureSessionActive();
    setErrorBanner('');
    setIsProcessingAudio(true);
    isProcessingAudioRef.current = true;
    setAudioFeedbackNotice(`Transcribing with Official Gnani STT (Prisma-v3.0 ${selectedSttLanguage})...`);

    try {
      const targetId = isCorrecting && correctionTarget ? correctionTarget.id : activeTargetIdRef.current;
      const lastTranscripts = dialogue.filter(m => m.sender === 'user').map(m => m.text).slice(-2).join(' ');
      const res = await transcribeAudioBlob(audioBlob, activeSess, targetId, selectedSttLanguage, lastTranscripts);

      if (res && res.status === 'error') {
        const errMsg = res.error || 'Gnani STT error. Please speak again.';
        setErrorBanner(errMsg);
        setAudioFeedbackNotice(errMsg);
        return;
      }

      if (res && res.transcript) {
        const conf = res.confidence || 94.0;
        setSttEngineStatus(`Gnani ${res.model || 'prisma-v3.0'} (${res.language_code || selectedSttLanguage})`);
        syncBackendTurnState(res, res.transcript);

        const aiReply = res.reply || res.ai_response_text;
        if (aiReply) {
          const keepLooping = res.action !== 'all_confirmed';
          await speakReadBack(aiReply, null, keepLooping);
        }
        setAudioFeedbackNotice(`Transcribed via Gnani STT (${conf}% confidence)`);
      } else {
        setAudioFeedbackNotice('Speech was empty or unclear. Please repeat.');
      }
    } catch (err) {
      const msg = err.message || 'Check microphone, network connection, or Gnani API credentials';
      setErrorBanner(`Audio processing error: ${msg}`);
      setAudioFeedbackNotice(`Audio processing error: ${msg}`);
      if (isAutonomousModeRef.current) {
        setTimeout(() => {
          if (isAutonomousModeRef.current && !isRecordingRef.current && !activeAudioRef.current) {
            startMicrophoneCapture();
          }
        }, 1800);
      }
    } finally {
      setIsProcessingAudio(false);
      isProcessingAudioRef.current = false;
    }
  };

  const applyExtractedEntities = (extractedList, rawTranscript, acousticConf, shouldSpeak = true) => {
    let targetEntity = null;

    setEntities(prevEntities => {
      const updated = [...prevEntities];
      extractedList.forEach(ext => {
        const idx = updated.findIndex(e => e.id === ext.id);
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            value: ext.value,
            confidence: Math.round(ext.confidence),
            status: ext.status || 'pending',
            phoneticSummary: ext.phoneticSummary,
            history: [...(updated[idx].history || []), ext.value]
          };
          if (!targetEntity) {
            targetEntity = updated[idx];
            setActiveEntityIndex(idx);
          }
        }
        if (ext.id === 'name' && ext.value) {
          setCustomerName(ext.value);
        }
      });
      return updated;
    });

    if (targetEntity && shouldSpeak) {
      const phonetics = getPhoneticSpelling(targetEntity.value);
      const spelledOut = phonetics.map(p => `${p.char} as in ${p.code}`).join(', ');
      const aiPromptText = `Maine aapka ${targetEntity.label} note kiya hai: "${targetEntity.value}". Spelling verify kar lijiye: ${spelledOut}. Kya ye sahi hai?`;

      setDialogue(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: aiPromptText,
          phonetic: true,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }
      ]);

      speakReadBack(aiPromptText);
    }
  };

  const handleSimulatedSpeechInput = async (inputText) => {
    if (!inputText || !inputText.trim()) return;

    interruptAudioPlayback();
    setErrorBanner('');
    const activeSess = await ensureSessionActive();

    setIsProcessingAudio(true);
    isProcessingAudioRef.current = true;
    setAudioFeedbackNotice('Processing customer input with EchoTrust AI Engine...');

    try {
      const targetId = isCorrecting && correctionTarget ? correctionTarget.id : activeTargetIdRef.current;
      const res = await processDialogueAPI(inputText, activeSess, targetId, null, 95.0);
      syncBackendTurnState(res, inputText);

      const aiReply = res?.reply || res?.ai_response_text;
      if (aiReply) {
        const keepLooping = isAutonomousModeRef.current && res.action !== 'all_confirmed';
        await speakReadBack(aiReply, null, keepLooping);
      }
    } catch (err) {
      setErrorBanner(`Dialogue processing failed: ${err.message || 'Check backend server connection.'}`);
      setAudioFeedbackNotice('Dialogue processing error: Check backend connection.');
    } finally {
      setIsProcessingAudio(false);
      isProcessingAudioRef.current = false;
    }
  };

  const handleConfirmEntity = async (entityId) => {
    const ent = entities.find(e => e.id === entityId);
    if (!ent || !ent.value) return;

    const activeSess = await ensureSessionActive();
    try {
      await confirmEntityAPI(
        activeSess,
        entityId,
        ent.type,
        ent.value,
        Math.max(ent.confidence, 95)
      );

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const nextEntities = entities.map(item =>
        item.id === entityId
          ? { ...item, status: 'verified', confidence: Math.max(item.confidence, 95), verifiedAt: timeStr }
          : item
      );
      setEntities(nextEntities);

      const timeSecs = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setDialogue(prev => [
        ...prev,
        { id: Date.now(), sender: 'user', text: `Yes, ${ent.label} is correct.`, time: timeSecs },
        { id: Date.now() + 1, sender: 'ai', text: `${ent.label} (${ent.value}) verified aur save ho gaya hai.`, time: timeSecs }
      ]);

      const nextPendingIndex = nextEntities.findIndex(e => e.id !== entityId && e.status !== 'verified' && e.value);
      const nextMissingIndex = nextPendingIndex !== -1 ? nextPendingIndex : nextEntities.findIndex(e => e.id !== entityId && e.status !== 'verified');
      if (nextMissingIndex !== -1) {
        setActiveEntityIndex(nextMissingIndex);
        const nextEnt = nextEntities[nextMissingIndex];
        activeTargetIdRef.current = nextEnt.id;
        if (nextEnt.value) {
          const nextPhonetics = getPhoneticSpelling(nextEnt.value).map(p => `${p.char} as in ${p.code}`).join(', ');
          speakReadBack(`Agla detail ${nextEnt.label}: ${nextEnt.value} (${nextPhonetics}). Kya ye sahi hai?`);
        } else {
          speakReadBack(`Bahut badhiya, ${ent.label} confirm ho gaya! Ab kripya apna ${nextEnt.label} batayein.`);
        }
      } else {
        activeTargetIdRef.current = null;
        setActiveEntityIndex(null);
        speakReadBack(`Dhanyawad! Aapke saare ${nextEntities.length} KYC details verify ho gaye hain.`);
      }

      loadDashboardData();
      loadAnalyticsData();
    } catch (err) {
      setErrorBanner(`Entity confirmation error: ${err.message}`);
    }
  };

  const initiateCorrection = (entity) => {
    setCorrectionTarget(entity);
    setCorrectionInput(entity.value);
    setIsCorrecting(true);
  };

  const submitCorrection = async () => {
    if (!correctionTarget || !correctionInput.trim()) return;
    const activeSess = await ensureSessionActive();

    try {
      const res = await correctEntityAPI(
        activeSess,
        correctionTarget.id,
        correctionTarget.type,
        correctionTarget.value,
        correctionInput,
        correctionTarget.confidence,
        95
      );

      const newVal = res?.corrected_value || correctionInput;
      const newConf = Math.round(res?.confidence || 94);
      const updatedPhonetics = getPhoneticSpelling(newVal)
        .map(p => `${p.char} as in ${p.code}`)
        .join(', ');

      setEntities(prev => prev.map(ent => {
        if (ent.id === correctionTarget.id) {
          return {
            ...ent,
            value: newVal,
            confidence: newConf,
            status: 'pending', // Corrected values still require confirmation!
            history: [...ent.history, newVal],
            phoneticSummary: updatedPhonetics.slice(0, 48) + '...'
          };
        }
        return ent;
      }));

      const readbackMsg = res?.readback_prompt || `Updating ${correctionTarget.label} to "${newVal}". Phonetic check: ${updatedPhonetics.slice(0, 80)}. Kya ab ye sahi hai?`;
      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setDialogue(prev => [
        ...prev,
        {
          id: Date.now(),
          sender: 'user',
          text: `No, correct ${correctionTarget.label} to: ${newVal}.`,
          time: timeNow
        },
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: readbackMsg,
          phonetic: true,
          time: timeNow
        }
      ]);
      setIsCorrecting(false);

      speakReadBack(readbackMsg);
      loadDashboardData();
      loadAnalyticsData();
    } catch (err) {
      setErrorBanner(`Correction error: ${err.message}`);
      setIsCorrecting(false);
    }
  };

  const getConfidenceBadge = (confidence) => {
    if (confidence >= autoPassThreshold) {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        bar: 'bg-emerald-500',
        dot: 'bg-emerald-500',
        label: 'High Confidence'
      };
    }
    if (confidence >= mandatoryGateThreshold) {
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        bar: 'bg-amber-500',
        dot: 'bg-amber-500',
        label: 'Medium Confidence'
      };
    }
    return {
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      bar: 'bg-rose-500',
      dot: 'bg-rose-500',
      label: 'Low - Action Required'
    };
  };

  const currentFocusedEntity = activeEntityIndex !== null ? entities[activeEntityIndex] : null;
  const hasActiveFocusedEntity = Boolean(currentFocusedEntity && currentFocusedEntity.value && currentFocusedEntity.value.trim().length > 0);

  // Navigation Items matching the redesign specification:
  const NAV_ITEMS = [
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'live', label: 'Live Verification', icon: Mic, badge: 'Active' },
    { id: 'entities', label: 'Entity Analysis', icon: Layers },
    { id: 'history', label: 'History', icon: History },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'audit_logs', label: 'Audit Logs', icon: FileText }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 flex font-sans antialiased">
      {/* =========================================================
          SECTION 1: FIXED CLEAN LIGHT SIDEBAR ON THE LEFT
         ========================================================= */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white text-slate-800 flex flex-col justify-between border-r border-slate-200 shadow-sm transition-transform duration-300 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className="flex-1 overflow-y-auto">
          {/* EchoTrust Logo and Branding */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setActiveTab('analytics'); setMobileMenuOpen(false); }}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 via-teal-600 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-500/20">
                <EchoTrustLogo className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-lg tracking-tight text-slate-900">EchoTrust</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    AI Voice
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">Every Voice. Verified with Trust.</p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="px-3 py-4">
            <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Core Modules
            </div>
            <nav className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 text-white font-bold shadow-md shadow-emerald-600/25'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`flex items-center space-x-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white border border-white/30'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-emerald-500'} animate-ping`}></span>
                        <span>{item.badge}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Sidebar Pinned Footer: Home Shortcut & User Profile with Logout */}
        <div className="p-3 border-t border-slate-100 bg-slate-50/70 space-y-2 shrink-0">
          {/* Back to Landing Page Shortcut */}
          {onGoHome && (
            <button
              onClick={onGoHome}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition cursor-pointer shadow-2xs group"
              title="Return to Public Landing Page"
            >
              <div className="flex items-center space-x-2.5">
                <Home className="w-4 h-4 text-emerald-600 group-hover:scale-105 transition-transform" />
                <span>View Landing Page</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 transition-colors" />
            </button>
          )}

          {/* User Profile Card with Direct Logout Button */}
          <div className="p-2.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-green-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-emerald-500/20 shadow-xs shrink-0">
                {user?.name ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'AK'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 truncate leading-tight">
                  {user?.name || 'Ananya Kapoor'}
                </div>
                <div className="text-[10px] text-slate-400 truncate font-medium">
                  {user?.role || 'Senior Verification Officer'}
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer shrink-0 border border-transparent hover:border-rose-100"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for mobile sidebar */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* =========================================================
          SECTION 2: MAIN DASHBOARD AREA (Light Blue Background)
         ========================================================= */}
      <div className="lg:ml-64 flex-1 flex flex-col min-h-screen">
        {/* Top Header Section */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200/90 shadow-2xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
            {/* Title & Subtitle + Mobile Toggle */}
            <div className="flex items-center space-x-3 min-w-0">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                title="Open Navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight truncate">
                  {activeTab === 'analytics'
                    ? 'Voice Recognition & Read-Back Analytics'
                    : activeTab === 'dashboard'
                    ? 'Executive Verification Dashboard'
                    : activeTab === 'live'
                    ? 'Live Voice Entity Verification'
                    : activeTab === 'entities'
                    ? 'Extracted Entity Diagnostic Analysis'
                    : activeTab === 'history' || activeTab === 'audit_logs'
                    ? 'Verification History & Audit Trail'
                    : 'System & Engine Configuration'}
                </h1>
                <p className="text-xs text-slate-500 hidden sm:block truncate mt-0.5">
                  {activeTab === 'analytics'
                    ? 'Real-time insights into voice capture precision, phonetic correction rates, and latency.'
                    : 'BFSI acoustic entity extraction, phonetic read-back confirmation, and correction loop management.'}
                </p>
              </div>
            </div>

            {/* Right Controls: System Status Badge, Date Filter Dropdown, Notification Icon */}
            <div className="flex items-center space-x-3 shrink-0">
              {/* Active System Status Pill */}
              <div className="hidden sm:inline-flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-xs font-semibold shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>System Active</span>
              </div>

              {/* Date Filter Dropdown */}
              <div className="relative">
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition shadow-2xs cursor-pointer">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  <select
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-transparent border-none outline-none text-xs font-semibold text-slate-700 cursor-pointer pr-1"
                  >
                    <option value="Last 24 Hours">Last 24 Hours</option>
                    <option value="Last 7 Days">Last 7 Days</option>
                    <option value="Last 30 Days">Last 30 Days</option>
                    <option value="Custom Range">Custom Range</option>
                  </select>
                </div>
              </div>

              {/* Notification Icon */}
              <button
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition border border-slate-200 shadow-2xs cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white"></span>
              </button>
            </div>
          </div>
        </header>

        {/* =========================================================
            MAIN CONTENT CONTAINER
           ========================================================= */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Explicit Error / Permission Alert Banner (never fails silently) */}
          {errorBanner && (
            <div className="bg-rose-50 border border-rose-200 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs text-rose-900 shadow-xs">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-medium">{errorBanner}</span>
              </div>
              <button
                onClick={() => setErrorBanner('')}
                className="text-rose-700 hover:underline font-semibold ml-4 cursor-pointer shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Audio Feedback Notification Banner (if any) */}
          {audioFeedbackNotice && (
            <div className="bg-indigo-50 border border-indigo-200 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs text-indigo-900 shadow-xs animate-fadeIn">
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-indigo-600 animate-bounce" />
                <span className="font-medium">{audioFeedbackNotice}</span>
              </div>
              <button
                onClick={() => {
                  interruptAudioPlayback();
                  setAudioFeedbackNotice('');
                }}
                className="text-indigo-700 hover:underline font-semibold cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* =========================================================
              TAB: ANALYTICS (THE REDESIGNED SHOWCASE)
             ========================================================= */}
          {activeTab === 'analytics' && (() => {
            const ds = analyticsData?.dashboard_stats || dashboardStats || {};
            const mlInfo = analyticsData?.ml_learning_status || analyticsData?.ml_model_insights;
            const corrChart = analyticsData?.corrections_by_entity_chart || [];
            const confChart = analyticsData?.confidence_distribution_chart || [];
            return (
            <div className="space-y-6">
              {/* --- REAL BACKEND ANALYTICS KPI CARDS --- */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all border-l-4 border-l-emerald-600">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Entity Confirmation Accuracy</p>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{ds.entity_accuracy ?? 0}%</span>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      {ds.verified_entities ?? 0} / {ds.total_entities ?? 0} entities
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 font-medium">Real confirmed entities ratio in database</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all border-l-4 border-l-teal-500">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Corrections Resolved</p>
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-100">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{ds.corrections_run ?? 0}</span>
                    <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-lg border border-teal-200">
                      {mlInfo?.status === 'trained' ? 'ML Fitted' : 'Accumulating'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 font-medium">Logged phonetic disambiguation corrections</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all border-l-4 border-l-purple-600">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Average Confidence</p>
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100">
                      <Timer className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{ds.average_confidence ?? 0}%</span>
                    <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                      8 BFSI Entities
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 font-medium">Mean acoustic & validation score from DB</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all border-l-4 border-l-rose-500">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Flagged / Failed Verifications</p>
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">{ds.failed_verifications ?? 0}</span>
                    <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                      {ds.pending_confirmations ?? 0} pending
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 font-medium">Unconfirmed / rejected KYC records blocked</p>
                </div>
              </div>

              {/* --- TWO REAL-DATA CHARTS --- */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Confirmed vs Corrected by Entity</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Live counts directly aggregated from SQLite/Supabase logs</p>
                    </div>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={corrChart} margin={{ top: 15, right: 10, left: -10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="entity" stroke="#64748B" fontSize={11} fontWeight={600} tickLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                        <Bar dataKey="autoConfirmed" fill="#10B981" name="Confirmed" radius={[5, 5, 0, 0]} />
                        <Bar dataKey="corrections" fill="#F59E0B" name="Corrected" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Confidence Score Distribution</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Acoustic confidence brackets from extracted entity records</p>
                    </div>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={confChart} margin={{ top: 15, right: 10, left: -10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="bracket" stroke="#64748B" fontSize={11} fontWeight={600} tickLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }} />
                        <Area type="monotone" dataKey="count" stroke="#8B5CF6" strokeWidth={3} fill="url(#purpleGradient)" name="Entities in Bracket" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {mlInfo && (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-slate-900 text-sm">Correction Machine Learning Engine</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {mlInfo.status === 'trained' ? 'Model Trained & Active' : 'Accumulating Samples'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {mlInfo.message || 'Analyzing phonetic substitutions from database correction logs.'}
                      </p>
                    </div>
                  </div>
                  {mlInfo.top_acoustic_confusions && mlInfo.top_acoustic_confusions.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="text-slate-400 font-semibold">Learned Confusions:</span>
                      {mlInfo.top_acoustic_confusions.slice(0, 3).map((item, idx) => (
                        <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-mono text-[11px] font-bold border border-slate-200">
                          {item.substitution}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })()}

          {/* =========================================================
              TAB: DASHBOARD
             ========================================================= */}
          {activeTab === 'dashboard' && (() => {
            const sttInfo = healthStatus?.stt || voiceApiStatus?.stt || {};
            const ttsInfo = healthStatus?.tts || voiceApiStatus?.tts || {};
            const llmInfo = healthStatus?.llm || voiceApiStatus?.llm || {};
            const dbInfo = healthStatus?.database || {};
            const recentConvs = dashboardStats?.recent_conversations || [];
            return (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Automated Platform Telemetry & Executive Dashboard</h2>
                  <p className="text-xs text-slate-500">100% live database metrics, Gnani AI STT/TTS service status, and real-time verification logs</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => { loadDashboardData(); loadHealthStatus(); }}
                    className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold text-xs flex items-center space-x-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('live')}
                    className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  >
                    <Mic className="w-4 h-4" />
                    <span>Open Live Session</span>
                  </button>
                </div>
              </div>

              {/* 7 Real Database Statistics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                {[
                  { title: 'Total Sessions', value: (dashboardStats?.total_sessions ?? 0).toLocaleString(), desc: 'All DB records', color: 'border-l-emerald-600' },
                  { title: 'Active Calls', value: (dashboardStats?.active_conversations ?? 0).toLocaleString(), desc: 'In progress', color: 'border-l-blue-500' },
                  { title: 'Completed', value: (dashboardStats?.completed_verifications ?? 0).toLocaleString(), desc: 'Verified OK', color: 'border-l-teal-500' },
                  { title: 'Pending Confirms', value: (dashboardStats?.pending_confirmations ?? 0).toLocaleString(), desc: 'Unconfirmed slots', color: 'border-l-amber-500' },
                  { title: 'Failed / Rejected', value: (dashboardStats?.failed_verifications ?? 0).toLocaleString(), desc: 'Mismatch / blocked', color: 'border-l-rose-500' },
                  { title: 'Entity Accuracy', value: `${dashboardStats?.entity_accuracy ?? 0}%`, desc: `${dashboardStats?.verified_entities ?? 0}/${dashboardStats?.total_entities ?? 0} verified`, color: 'border-l-emerald-500' },
                  { title: 'Avg Confidence', value: `${dashboardStats?.average_confidence ?? 0}%`, desc: 'Mean STT/KYC', color: 'border-l-indigo-500' },
                ].map((stat, idx) => (
                  <div key={idx} className={`bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-xs border-l-4 ${stat.color}`}>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{stat.title}</p>
                    <div className="mt-1.5 text-2xl font-extrabold text-slate-900">{stat.value}</div>
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">{stat.desc}</p>
                  </div>
                ))}
              </div>

              {/* Live API / STT / TTS / LLM Health Status Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <Server className="w-4 h-4 text-emerald-600" />
                      <span>Backend & Database</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${dbInfo.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      {dbInfo.connected ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 font-mono">{dbInfo.engine || 'SQLite Local'}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Strict JWT + unconfirmed isolation</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <Mic className="w-4 h-4 text-teal-600" />
                      <span>Gnani STT Engine</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sttInfo.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {sttInfo.status || (sttInfo.connected ? 'Ready' : 'Offline')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 font-mono">{sttInfo.model || 'prisma-v3.0'} • {sttInfo.language_code || 'indic-auto'}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {sttInfo.last_latency_ms ? `Latency: ${sttInfo.last_latency_ms}ms (${sttInfo.last_detected_language || 'hi/en'})` : 'hi-IN + en-IN Hinglish'}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <Volume2 className="w-4 h-4 text-indigo-600" />
                      <span>Gnani TTS Engine</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ttsInfo.connected ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {ttsInfo.status || (ttsInfo.connected ? 'Ready' : 'Offline')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 font-mono">{ttsInfo.model || 'timbre-v3.0'} • {ttsInfo.voice || 'Devansh'}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {ttsInfo.last_latency_ms ? `Latency: ${ttsInfo.last_latency_ms}ms` : 'Male Conversational Hinglish'}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <Cpu className="w-4 h-4 text-purple-600" />
                      <span>Conversation / LLM</span>
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${llmInfo.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {llmInfo.configured ? llmInfo.status || 'Connected' : 'Missing Key (NLU Active)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 font-mono truncate">{llmInfo.provider || 'deterministic-nlu'}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{llmInfo.model || 'BFSI Multi-Turn State Machine'}</p>
                </div>
              </div>

              {/* Recent Conversation History & Recent Sessions */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                        <MessageSquare className="w-4 h-4 text-emerald-600" />
                        <span>Recent Conversation History</span>
                      </h3>
                      <p className="text-[11px] text-slate-500">Latest real customer dialogues stored in DB</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3 flex-1 overflow-y-auto max-h-80">
                    {recentConvs.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400 italic">
                        No recorded conversations yet. Start a live verification session to inspect dialogue turns.
                      </div>
                    ) : recentConvs.map((conv, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-900">{conv.customer} <span className="font-mono text-[10px] text-slate-400">({conv.session_id})</span></span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">{conv.turns} turns</span>
                        </div>
                        <p className="text-slate-600 line-clamp-2 italic">"{conv.last_message}"</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Verification Activity Table */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                  <div className="p-4 border-b border-slate-100 flex justify-between items-center gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Recent Verification Sessions</h3>
                      <p className="text-[11px] text-slate-500">Live feed of DB sessions and confirmations</p>
                    </div>
                    <button onClick={() => setActiveTab('history')} className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold flex items-center cursor-pointer">
                      <span>View All</span>
                      <ChevronRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                        <tr>
                          <th className="py-3 px-4">Session & Customer</th>
                          <th className="py-3 px-4">Confidence</th>
                          <th className="py-3 px-4">Corrections</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {recentSessions.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 italic">No database sessions yet.</td>
                          </tr>
                        ) : recentSessions.map((sess) => (
                          <tr key={sess.id} className="hover:bg-emerald-50/30 transition">
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">{sess.customer}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{sess.id}</div>
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">{sess.finalConf}%</td>
                            <td className="py-3 px-4">{sess.corrections}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${sess.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-teal-50 text-teal-800 border border-teal-200'}`}>
                                {sess.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button onClick={() => inspectSession(sess)} className="text-emerald-700 hover:underline font-semibold cursor-pointer">Inspect</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* =========================================================
              TAB: LIVE VERIFICATION
             ========================================================= */}
          {activeTab === 'live' && (
            <div className="space-y-6">
              {/* Customer Banner */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-xs border ${
                    customerName ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400 border-slate-200'
                  }`}>
                    {customerName ? customerName.split(' ').map(n => n[0]).join('').slice(0, 2) : <User className="w-6 h-6 text-slate-400" />}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        {customerName || (currentSessionId ? 'Awaiting Customer Identification...' : 'Ready for Verification Call')}
                      </h2>
                      <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${
                        currentSessionId
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border-slate-200'
                      }`}>
                        {currentSessionId ? 'Live Call / Session Active' : 'Session Idle'}
                      </span>
                      {isAutonomousMode && (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-800 border border-emerald-300">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Autonomous Voice Loop Active</span>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 text-xs text-slate-500 mt-0.5">
                      <span>Customer ID: <strong className="text-slate-700 font-mono">{customerId || 'Waiting for capture...'}</strong></span>
                      <span>App No: <strong className="text-slate-700 font-mono">{appNo || 'Pending'}</strong></span>
                      <span>Session ID: <strong className="text-slate-700 font-mono">{currentSessionId || 'None'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Call Controls */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
                  <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : isPlayingAudio ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    <span className="text-xs font-mono font-bold text-slate-800">{formatDuration(callDuration)}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      {isRecording ? 'Listening...' : isPlayingAudio ? 'AI Speaking' : 'Live Call'}
                    </span>
                  </div>

                  {isPlayingAudio && (
                    <button
                      onClick={interruptAudioPlayback}
                      className="flex items-center space-x-1.5 px-3 py-2 rounded-xl font-semibold text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition shadow-xs cursor-pointer animate-pulse"
                      title="Interrupt AI Speech"
                    >
                      <Pause className="w-3.5 h-3.5 text-amber-700 fill-current" />
                      <span>Interrupt AI</span>
                    </button>
                  )}

                  {/* Primary 1-Click Automated Call Start */}
                  <button
                    onClick={handleStartAutomatedSession}
                    disabled={isProcessingAudio}
                    className="flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-md hover:shadow-lg transition cursor-pointer"
                    title="Start Automated Hands-Free Verification Call (Plays Shivani greeting & auto-listens)"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-200" />
                    <span>{currentSessionId ? 'Restart Automated Call' : 'Start Automated KYC Call'}</span>
                  </button>

                  {/* Auto-Loop Toggle Button */}
                  <button
                    onClick={() => {
                      setIsAutonomousMode(prev => {
                        const next = !prev;
                        isAutonomousModeRef.current = next;
                        if (!next && isRecordingRef.current) {
                          stopMicrophoneCapture();
                        }
                        return next;
                      });
                    }}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                      isAutonomousMode
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-100 text-slate-600 border-slate-300'
                    }`}
                    title="Toggle Hands-Free Voice Auto-Loop"
                  >
                    <span className={`w-2 h-2 rounded-full ${isAutonomousMode ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
                    <span>{isAutonomousMode ? 'Auto: ON' : 'Auto: OFF'}</span>
                  </button>

                  {/* Manual Mic Button */}
                  <button
                    onClick={handleToggleRecording}
                    disabled={isProcessingAudio}
                    className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl font-semibold text-xs shadow-sm transition cursor-pointer ${
                      isRecording
                        ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                        : isProcessingAudio
                        ? 'bg-indigo-600 text-white cursor-wait'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                    }`}
                    title={isRecording ? 'Click to stop speech and process' : 'Manual Mic Capture'}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isRecording ? 'Listening (Stop)' : isProcessingAudio ? 'Processing...' : 'Manual Mic'}</span>
                  </button>

                  <button
                    onClick={handleProcessSampleAudio}
                    disabled={isProcessingAudio}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-xl font-semibold text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 transition shadow-xs cursor-pointer"
                    title="Play and transcribe reference audio"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                    <span>Reference Audio</span>
                  </button>
                </div>
              </div>

              {/* Main Interactive Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Voice Interaction & Dialogue Panel (7 Cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Waveform Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
                    <div className="p-4 bg-[#0A1A12] text-white flex flex-wrap items-center justify-between gap-3 border-b border-emerald-950">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                          <Radio className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-semibold text-white">Live Voice Entity Capture & Synthesizer</h3>
                            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-1.5 py-0.5 rounded font-mono">
                              Official Gnani AI Active
                            </span>
                          </div>
                          <p className="text-[11px] text-emerald-300/70">
                            STT: Prisma-v3.0 ({selectedSttLanguage === 'indic-auto' ? 'Auto Hinglish (hi-IN + en-IN)' : selectedSttLanguage}) | TTS: Timbre-v3.0 ({selectedTtsVoice})
                          </p>
                        </div>
                      </div>

                      {/* STT Language & Voice Controls */}
                      <div className="flex flex-wrap items-center gap-2.5">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[11px] text-emerald-300/80 font-medium">STT Lang:</span>
                          <select
                            value={selectedSttLanguage}
                            onChange={(e) => setSelectedSttLanguage(e.target.value)}
                            className="bg-emerald-950/90 text-emerald-100 text-xs rounded-lg border border-emerald-700/60 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                            title="STT Language (Hindi, English, and Hinglish Auto)"
                          >
                            <option value="indic-auto">Hindi + English + Hinglish (Auto)</option>
                            <option value="hi-IN">Hindi / Hinglish (hi-IN)</option>
                            <option value="en-IN">English / Hinglish (en-IN)</option>
                          </select>
                        </div>

                        {/* Voice Tone Selector */}
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[11px] text-emerald-300/80 font-medium">Voice:</span>
                          <select
                            value={selectedTtsVoice}
                            onChange={(e) => setSelectedTtsVoice(e.target.value)}
                            className="bg-emerald-950/90 text-emerald-100 text-xs rounded-lg border border-emerald-700/60 px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                            title="Select Gnani Timbre v3.0 Voice Tone"
                          >
                            <option value="Devansh">Devansh (Indian Male - Selected Default)</option>
                            <option value="Yashraj">Yashraj (Indian Male - Deep Tone)</option>
                            <option value="Shubham">Shubham (Indian Male - Conversational)</option>
                            <option value="Prakash">Prakash (Indian Male - BFSI)</option>
                            <option value="Shivani">Shivani (Indian Female - Hinglish)</option>
                            <option value="Kaveri">Kaveri (Indian Female - v2.5)</option>
                            <option value="Nalini">Nalini (Indian Female - v2.5)</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Real-time Dynamic Audio Waveform */}
                    <div className="bg-gradient-to-b from-[#0A1A12] to-[#040C08] px-6 py-4 flex items-center justify-center border-t border-emerald-950">
                      <div className="flex items-center space-x-1.5 h-12 w-full max-w-md justify-center">
                        {audioWaveformHeights.map((h, i) => (
                          <div
                            key={i}
                            className={`w-1.5 rounded-full transition-all duration-150 ${
                              isRecording || isPlayingAudio
                                ? 'bg-gradient-to-t from-emerald-500 via-teal-400 to-green-300'
                                : 'bg-slate-800'
                            }`}
                            style={{ height: isRecording || isPlayingAudio ? `${h}%` : '20%' }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Conversation Stream */}
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex-1 max-h-[380px] overflow-y-auto space-y-3">
                      {dialogue.length === 0 ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 border border-emerald-100">
                            <Mic className="w-6 h-6" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-800">No Dialogue Messages Yet</h4>
                          <p className="text-xs text-slate-500 max-w-sm mt-1">
                            Click <strong>"Start Voice Capture"</strong> or <strong>"Play & Transcribe generated-audio.wav"</strong> or type below to begin real-time speech verification.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="text-center">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                              Live Voice Stream Active
                            </span>
                          </div>

                          {dialogue.map((msg) => (
                            <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                              <div className="flex items-center space-x-1.5 mb-1 px-1">
                                <span className="text-[10px] font-bold text-slate-500 capitalize">
                                  {msg.sender === 'ai' ? '🤖 EchoTrust AI' : `👤 Customer (${customerName ? customerName.split(' ')[0] : 'Speaker'})`}
                                </span>
                                <span className="text-[9px] text-slate-400">{msg.time}</span>
                              </div>
                              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed ${
                                msg.sender === 'user' ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-br-xs' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                              }`}>
                                <p>{msg.text}</p>
                                {msg.phonetic && (
                                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                      Phonetic Read-Back Enabled
                                    </span>
                                    <button onClick={() => speakReadBack(msg.text)} className="text-[10px] font-semibold text-slate-600 hover:text-emerald-700 flex items-center space-x-1 cursor-pointer">
                                      <Volume2 className="w-3 h-3" />
                                      <span>Re-hear</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Quick Simulated Input */}
                    <div className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Simulate customer speech input (e.g. My name is Rahul Sharma or PAN ABCDE1234F)..."
                        className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            handleSimulatedSpeechInput(e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          if (hasActiveFocusedEntity) {
                            const phonetics = getPhoneticSpelling(currentFocusedEntity.value).map(p => `${p.char} as in ${p.code}`).join(', ');
                            speakReadBack(`Please confirm your captured ${currentFocusedEntity.label}: ${currentFocusedEntity.value}. Phonetic confirmation: ${phonetics}. Is this accurate?`);
                          } else {
                            speakReadBack("EchoTrust intelligent voice verification system active. Please speak your full name, phone number, or address.");
                          }
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Speak AI Prompt</span>
                      </button>
                    </div>
                  </div>

                  {/* Phonetic Disambiguation Engine Panel */}
                  <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-teal-950 text-white rounded-2xl p-5 shadow-lg relative overflow-hidden border border-emerald-900/50">
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-bold text-sm tracking-wide uppercase text-emerald-200">
                          Phonetic Disambiguation Engine
                        </h3>
                      </div>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border ${
                        hasActiveFocusedEntity && currentFocusedEntity
                          ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                          : 'bg-slate-800/80 text-slate-400 border-slate-700'
                      }`}>
                        {hasActiveFocusedEntity && currentFocusedEntity
                          ? `Active Target: ${currentFocusedEntity.label}`
                          : 'Engine Idle / Standby'}
                      </span>
                    </div>

                    {hasActiveFocusedEntity && currentFocusedEntity ? (
                      <>
                        {/* NATO Decomposed Chips */}
                        <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 relative z-10 mb-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs text-emerald-200">Captured Value:</span>
                            <span className="font-mono text-sm font-bold text-white tracking-wider bg-black/40 px-2.5 py-0.5 rounded border border-white/10">
                              {currentFocusedEntity.value}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                            {getPhoneticSpelling(currentFocusedEntity.value).map((item, idx) => (
                              <div key={idx} className="flex items-center space-x-1 bg-white/15 px-2 py-1 rounded-md text-xs border border-white/15">
                                <span className="font-bold text-emerald-300 font-mono">{item.char}</span>
                                <span className="text-slate-300 text-[10px]">→</span>
                                <span className="text-white font-medium">{item.code}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="bg-black/40 rounded-xl p-4 border border-emerald-900/60 relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-bold text-white">"Did we capture your information correctly?"</div>
                            <div className="text-[11px] text-emerald-300/80">Awaiting customer vocal confirmation or agent override</div>
                          </div>
                          <div className="flex items-center space-x-2 w-full sm:w-auto">
                            <button
                              onClick={() => {
                                speakReadBack(`Spelling confirmation for ${currentFocusedEntity.label}: ${getPhoneticSpelling(currentFocusedEntity.value).map(p => `${p.char} as in ${p.code}`).join('. ')}. Is this correct?`);
                              }}
                              className="px-3 py-2 bg-emerald-800 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Play Gnani Voice</span>
                            </button>
                            <button
                              onClick={() => handleConfirmEntity(currentFocusedEntity.id)}
                              className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-900/30 transition cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                              <span>Yes, Confirm</span>
                            </button>
                            <button
                              onClick={() => initiateCorrection(currentFocusedEntity)}
                              className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-rose-900/30 transition cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                              <span>No, Correct It</span>
                            </button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="bg-white/5 backdrop-blur-md rounded-xl p-6 border border-white/10 text-center relative z-10 my-2">
                        <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                          <Sparkles className="w-6 h-6 animate-pulse" />
                        </div>
                        <h4 className="text-sm font-semibold text-white mb-1">Awaiting Entity Verification</h4>
                        <p className="text-xs text-slate-300/80 max-w-sm mx-auto">
                          Speak into the microphone or click "Play & Transcribe generated-audio.wav" to extract customer entities and activate real-time phonetic disambiguation.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Captured Entity Cards & Confidence (5 Cols) */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm tracking-tight flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>Captured Entities & Confidence</span>
                    </h3>
                    <span className="text-xs font-semibold text-slate-500">
                      {entities.filter(e => e.status === 'verified').length} of {entities.length} Confirmed
                    </span>
                  </div>

                  {entities.map((entity, idx) => {
                    const Icon = entity.icon || ENTITY_ICONS[entity.id] || User;
                    const confStyle = getConfidenceBadge(entity.confidence);
                    const isSelected = activeEntityIndex === idx;
                    const hasValue = Boolean(entity.value && entity.value.trim().length > 0);

                    return (
                      <div
                        key={entity.id}
                        onClick={() => {
                          if (hasValue) setActiveEntityIndex(idx);
                        }}
                        className={`bg-white rounded-2xl p-4 border transition-all shadow-xs relative ${
                          hasValue ? 'cursor-pointer' : 'cursor-default opacity-85'
                        } ${
                          isSelected && hasValue
                            ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2.5">
                            <div className={`p-2 rounded-xl ${isSelected && hasValue ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">{entity.label}</div>
                              <div className="font-mono text-sm font-semibold text-slate-800 tracking-tight mt-0.5">
                                {hasValue ? (
                                  entity.value
                                ) : (
                                  <span className="text-slate-400 font-sans italic font-normal text-xs">Waiting for vocal input...</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${hasValue ? confStyle.bg : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                            {hasValue ? `${entity.confidence}% Conf.` : '0% Conf.'}
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${hasValue ? confStyle.bar : 'bg-slate-200'}`}
                              style={{ width: `${hasValue ? entity.confidence : 0}%` }}
                            />
                          </div>
                        </div>

                        {/* Phonetics Preview */}
                        <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                          <span className="truncate pr-2">
                            <strong>Phonetics:</strong>{' '}
                            {hasValue ? (
                              entity.phoneticSummary
                            ) : (
                              <span className="italic text-slate-400">No phonetics captured yet</span>
                            )}
                          </span>
                          {hasValue && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                speakReadBack(`Entity ${entity.label}: ${entity.value}`);
                              }}
                              className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Action buttons */}
                        {hasValue && (
                          <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                initiateCorrection(entity);
                              }}
                              className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            >
                              Manual Edit
                            </button>
                            {entity.status !== 'verified' && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleConfirmEntity(entity.id);
                                }}
                                className="px-3 py-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs flex items-center space-x-1 cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                <span>Confirm Match</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB: ENTITY ANALYSIS
             ========================================================= */}
          {activeTab === 'entities' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Entity Extraction & Confidence Diagnostics</h2>
                  <p className="text-xs text-slate-500">Fine-grained acoustic confidence scores and validation rule compliance</p>
                </div>
                <span className="text-xs bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 font-medium shadow-2xs">
                  Showing {entities.length} Extracted Entities for <strong>{currentSessionId || 'No Active Session'}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {entities.map((entity) => {
                  const Icon = entity.icon || ENTITY_ICONS[entity.id] || User;
                  const conf = getConfidenceBadge(entity.confidence);
                  const phonetics = getPhoneticSpelling(entity.value);
                  const hasVal = Boolean(entity.value && entity.value.trim().length > 0);

                  return (
                    <div key={entity.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{entity.type}</span>
                              <h3 className="font-bold text-slate-900 text-sm">{entity.label}</h3>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${hasVal ? conf.bg : 'bg-slate-100 text-slate-400 border-slate-200'}`}>
                            {hasVal ? `${entity.confidence}%` : '0%'}
                          </span>
                        </div>

                        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="text-[10px] text-slate-400 font-semibold uppercase">Extracted Text</div>
                          <div className="font-mono font-bold text-slate-800 text-base mt-0.5">
                            {hasVal ? entity.value : <span className="text-slate-400 font-sans italic font-normal text-xs">Waiting for vocal input...</span>}
                          </div>
                        </div>

                        <div className="mt-3">
                          <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                            <span>NATO Breakdown:</span>
                            {hasVal && (
                              <button
                                onClick={() => speakReadBack(`${entity.label}: ${phonetics.map(p => p.code).join(' ')}`)}
                                className="text-[11px] text-emerald-700 hover:underline flex items-center space-x-0.5 cursor-pointer font-semibold"
                              >
                                <Volume2 className="w-3 h-3" />
                                <span>Audio</span>
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                            {phonetics.length > 0 ? (
                              phonetics.slice(0, 8).map((p, i) => (
                                <span key={i} className="text-[11px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-mono">
                                  <strong>{p.char}</strong>:{p.code}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-slate-400 italic">No breakdown captured</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-[11px] text-slate-400">Status: <strong className="text-slate-700 capitalize">{entity.status}</strong></div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => initiateCorrection(entity)} className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border rounded-lg cursor-pointer">Correct</button>
                          <button onClick={() => handleConfirmEntity(entity.id)} className="px-3 py-1 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg cursor-pointer shadow-xs">Confirm</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* =========================================================
              TAB: HISTORY & AUDIT LOGS
             ========================================================= */}
          {(activeTab === 'history' || activeTab === 'audit_logs') && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Verification Session History & Audit Trail</h2>
                  <p className="text-xs text-slate-500">Immutable audit log of customer affirmations, phonetic prompts, and overrides</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await downloadComplianceCSV();
                    } catch (err) {
                      setErrorBanner(`Compliance CSV export failed: ${err.message}`);
                    }
                  }}
                  className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export Compliance CSV</span>
                </button>
              </div>

              {/* Filter Toolbar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Search Customer / Session</label>
                  <input
                    type="text"
                    placeholder="e.g. Rahul, SES-94812"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    onBlur={loadSessionsList}
                    onKeyDown={(e) => e.key === 'Enter' && loadSessionsList()}
                    className="w-full border rounded-xl p-2 bg-slate-50 border-slate-200 focus:bg-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Verification Status</label>
                  <select
                    value={historyStatusFilter}
                    onChange={(e) => {
                      setHistoryStatusFilter(e.target.value);
                      loadSessionsList();
                    }}
                    className="w-full border rounded-xl p-2 bg-slate-50 border-slate-200 cursor-pointer outline-none"
                  >
                    <option>All Statuses</option>
                    <option>Verified</option>
                    <option>In Progress</option>
                    <option>Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Application Channel</label>
                  <select
                    value={historyChannelFilter}
                    onChange={(e) => {
                      setHistoryChannelFilter(e.target.value);
                      loadSessionsList();
                    }}
                    className="w-full border rounded-xl p-2 bg-slate-50 border-slate-200 cursor-pointer outline-none"
                  >
                    <option>All Channels</option>
                    <option>Inbound IVR</option>
                    <option>Agent Voice Stream</option>
                    <option>Web RTC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-semibold">Confidence Bracket</label>
                  <select className="w-full border rounded-xl p-2 bg-slate-50 border-slate-200 cursor-pointer outline-none">
                    <option>Any Confidence</option>
                    <option>&gt; 90% (High Confidence)</option>
                    <option>70% - 90% (Moderate)</option>
                    <option>&lt; 70% (Manual Triggered)</option>
                  </select>
                </div>
              </div>

              {/* Sessions Table */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                    <tr>
                      <th className="p-3.5">Session ID</th>
                      <th className="p-3.5">Customer & App ID</th>
                      <th className="p-3.5">Channel</th>
                      <th className="p-3.5">Initial Conf.</th>
                      <th className="p-3.5">Final Conf.</th>
                      <th className="p-3.5">Corrections</th>
                      <th className="p-3.5">Result</th>
                      <th className="p-3.5">Timestamp</th>
                      <th className="p-3.5 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyList.map((item) => (
                      <tr key={item.id} className="hover:bg-emerald-50/30 transition">
                        <td className="p-3.5 font-mono font-bold text-emerald-700">{item.id}</td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-900">{item.customer}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{item.appNo}</div>
                        </td>
                        <td className="p-3.5 text-slate-600">{item.channel}</td>
                        <td className="p-3.5 font-semibold text-slate-600">{item.initialConf}%</td>
                        <td className="p-3.5 font-bold text-slate-900">
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            {item.finalConf}%
                          </span>
                        </td>
                        <td className="p-3.5 font-medium">
                          {item.corrections > 0 ? (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                              {item.corrections} loop(s)
                            </span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            item.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-teal-50 text-teal-800 border border-teal-200'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 whitespace-nowrap">{item.time}</td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => inspectSession(item)}
                            className="text-emerald-700 hover:text-emerald-900 font-semibold p-1 hover:bg-emerald-50 rounded cursor-pointer"
                          >
                            Audit Audio
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =========================================================
              TAB: SETTINGS
             ========================================================= */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-4xl">
              <div>
                <h2 className="text-xl font-bold text-slate-900">System & Phonetic Engine Configuration</h2>
                <p className="text-xs text-slate-500">Configure speech recognition parameters, phonetic dictionaries, and compliance thresholds</p>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs divide-y divide-slate-100">
                {/* Confidence Thresholds */}
                <div className="p-5 space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                    <Sliders className="w-4 h-4 text-emerald-600" />
                    <span>Confidence Threshold Gates</span>
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <label className="text-xs font-semibold text-slate-600">Auto-Pass Threshold</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <input
                          type="number"
                          value={autoPassThreshold}
                          onChange={(e) => setAutoPassThreshold(Number(e.target.value))}
                          className="w-16 p-1.5 text-xs border rounded-lg bg-white font-bold outline-none focus:border-emerald-500"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Accepts with single verbal confirmation</p>
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <label className="text-xs font-semibold text-slate-600">Mandatory Read-Back Gate</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <input
                          type="number"
                          value={mandatoryGateThreshold}
                          onChange={(e) => setMandatoryGateThreshold(Number(e.target.value))}
                          className="w-16 p-1.5 text-xs border rounded-lg bg-white font-bold outline-none focus:border-emerald-500"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Forces full NATO spelling read-back</p>
                    </div>
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                      <label className="text-xs font-semibold text-slate-600">Auto-Reject / Agent Route</label>
                      <div className="flex items-center space-x-2 mt-1">
                        <input
                          type="number"
                          value={autoRejectThreshold}
                          onChange={(e) => setAutoRejectThreshold(Number(e.target.value))}
                          className="w-16 p-1.5 text-xs border rounded-lg bg-white font-bold outline-none focus:border-emerald-500"
                        />
                        <span className="text-xs text-slate-500">%</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">Escalates directly to human supervisor</p>
                    </div>
                  </div>
                </div>

                {/* Phonetic Standard */}
                <div className="p-5 space-y-4">
                  <h3 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                    <Radio className="w-4 h-4 text-emerald-600" />
                    <span>Read-Back Phonetic Standardization</span>
                  </h3>
                  <div className="space-y-2">
                    <label onClick={() => setPhoneticStandard('nato')} className="flex items-center space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input type="radio" name="phoneticStd" checked={phoneticStandard === 'nato'} onChange={() => setPhoneticStandard('nato')} className="text-emerald-600 focus:ring-emerald-500" />
                      <div>
                        <div className="text-xs font-bold text-slate-800">ICAO / NATO Phonetic Standard (Recommended)</div>
                        <div className="text-[11px] text-slate-500">Alpha, Bravo, Charlie, Delta, Romeo, Uniform... Global BFSI benchmark</div>
                      </div>
                    </label>
                    <label onClick={() => setPhoneticStandard('indian')} className="flex items-center space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input type="radio" name="phoneticStd" checked={phoneticStandard === 'indian'} onChange={() => setPhoneticStandard('indian')} className="text-emerald-600 focus:ring-emerald-500" />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Indian Banking Colloquial Standard</div>
                        <div className="text-[11px] text-slate-500">A for Apple, B for Bombay, C for Chennai, D for Delhi...</div>
                      </div>
                    </label>
                    <label onClick={() => setPhoneticStandard('numeric')} className="flex items-center space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input type="radio" name="phoneticStd" checked={phoneticStandard === 'numeric'} onChange={() => setPhoneticStandard('numeric')} className="text-emerald-600 focus:ring-emerald-500" />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Digit-Grouped Numeric Read-Back</div>
                        <div className="text-[11px] text-slate-500">Read in pairs (e.g., 98-76-54) or individual digits (9, 8, 7, 6, 5, 4)</div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Save CTA */}
                <div className="p-5 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setAutoPassThreshold(90);
                      setMandatoryGateThreshold(75);
                      setAutoRejectThreshold(60);
                      setPhoneticStandard('nato');
                      setAudioFeedbackNotice('Configuration reset to BFSI standard defaults.');
                    }}
                    className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Reset Defaults
                  </button>
                  <button
                    onClick={() => {
                      setAudioFeedbackNotice('Configuration successfully saved to active verification cluster.');
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer"
                  >
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* =========================================================
          INTERACTIVE CORRECTION LOOP MODAL
         ========================================================= */}
      {isCorrecting && correctionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2 text-rose-600">
                <RotateCcw className="w-5 h-5 animate-spin" />
                <h3 className="font-bold text-base text-slate-900">Initiate Correction Loop</h3>
              </div>
              <button
                onClick={() => setIsCorrecting(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <strong>Customer signaled mismatch.</strong> Please capture the corrected value. EchoTrust will automatically regenerate phonetic read-back prompts and prompt the customer for final verification.
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase">Target Entity</label>
                <div className="text-sm font-bold text-slate-800 mt-0.5">{correctionTarget.label}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase">Previously Parsed Value</label>
                <div className="font-mono text-xs bg-slate-100 text-slate-600 p-2 rounded-lg line-through mt-0.5">
                  {correctionTarget.value}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Enter Corrected Value (Voice or Manual Text)</label>
                <input
                  type="text"
                  value={correctionInput}
                  onChange={(e) => setCorrectionInput(e.target.value)}
                  className="mt-1 w-full border border-slate-300 rounded-xl p-2.5 text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              {/* Dynamic Live Phonetic Preview */}
              {correctionInput && (
                <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100">
                  <div className="text-[11px] font-semibold text-emerald-900 mb-1">
                    Live Phonetic Read-Back Preview:
                  </div>
                  <div className="flex flex-wrap gap-1 text-[11px] text-emerald-800 font-mono">
                    {getPhoneticSpelling(correctionInput).map((item, idx) => (
                      <span key={idx} className="bg-white px-1.5 py-0.5 rounded-md shadow-2xs border border-emerald-200">
                        <strong>{item.char}</strong>-{item.code}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end space-x-3">
              <button
                onClick={() => setIsCorrecting(false)}
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={submitCorrection}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 transition cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Save & Synthesize Read-Back</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =========================================================
// MAIN APP COMPONENT (Application Flow & Session Controller)
// Landing Page → Login/Register → Authentication → Dashboard
// =========================================================
export default function App() {
  const [currentView, setCurrentView] = useState('landing'); // Always start on Landing Page!
  const [token, setToken] = useState(() => {
    return localStorage.getItem('echotrust_token') || sessionStorage.getItem('echotrust_token') || '';
  });
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('echotrust_user') || sessionStorage.getItem('echotrust_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Global 401 unauthorized listener + token verification on load
  useEffect(() => {
    const onUnauthorized = () => {
      setToken('');
      setUser(null);
      setCurrentView('login');
    };
    window.addEventListener('echotrust:unauthorized', onUnauthorized);
    return () => window.removeEventListener('echotrust:unauthorized', onUnauthorized);
  }, []);

  useEffect(() => {
    if (token) {
      fetchCurrentUser(token)
        .then(res => {
          if (res && res.user) {
            setUser(res.user);
          }
        })
        .catch(() => {
          localStorage.removeItem('echotrust_token');
          localStorage.removeItem('echotrust_user');
          sessionStorage.removeItem('echotrust_token');
          sessionStorage.removeItem('echotrust_user');
          setToken('');
          setUser(null);
        });
    }
  }, [token]);

  const handleNavigate = (view) => {
    if (view === 'dashboard' && !user && !token) {
      setCurrentView('login');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (newToken, newUser, rememberMe = true) => {
    setToken(newToken);
    setUser(newUser);
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('echotrust_token', newToken);
    storage.setItem('echotrust_user', JSON.stringify(newUser));
    setCurrentView('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    localStorage.removeItem('echotrust_token');
    localStorage.removeItem('echotrust_user');
    sessionStorage.removeItem('echotrust_token');
    sessionStorage.removeItem('echotrust_user');
    setToken('');
    setUser(null);
    setCurrentView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (currentView === 'login') {
    return (
      <LoginPage 
        onNavigate={handleNavigate} 
        onLoginSuccess={handleLoginSuccess} 
      />
    );
  }

  if (currentView === 'register') {
    return (
      <RegisterPage 
        onNavigate={handleNavigate} 
        onLoginSuccess={handleLoginSuccess} 
      />
    );
  }

  if (currentView === 'dashboard') {
    if (!user && !token) {
      return (
        <LoginPage 
          onNavigate={handleNavigate} 
          onLoginSuccess={handleLoginSuccess} 
        />
      );
    }
    return (
      <EchoTrustDashboard 
        user={user} 
        onLogout={handleLogout} 
        onGoHome={() => handleNavigate('landing')} 
      />
    );
  }

  // Default: Landing Page is always the first page visitors see!
  return (
    <LandingPage 
      onNavigate={handleNavigate} 
      user={user} 
      onLogout={handleLogout} 
    />
  );
}
