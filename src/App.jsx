import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Volume2, CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  Search, Filter, ChevronRight, ArrowUpRight, ArrowDownRight, ShieldCheck,
  User, Phone, MapPin, CreditCard, Calendar, FileText, Settings, BarChart3,
  History, LayoutDashboard, Radio, Play, Pause, RotateCcw, Check, X,
  Sliders, Bell, Download, ExternalLink, HelpCircle, Sparkles, Building,
  Layers, Lock, Eye, AlertCircle, Info, ChevronDown, Clock, Timer, ShieldAlert,
  Menu, ChevronUp, Zap, CheckCircle, LogOut, Home
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  fetchDashboardMetrics,
  fetchDetailedAnalytics,
  fetchSessions,
  fetchSessionDetails,
  transcribeAudioBlob,
  transcribeSampleAudioAPI,
  processDialogueAPI,
  fetchVoiceStatusAPI,
  synthesizeSpeechAPI,
  getTTSAudioUrl,
  extractEntitiesFromText,
  confirmEntityAPI,
  correctEntityAPI,
  downloadComplianceCSVUrl,
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
  address: MapPin,
  account: CreditCard,
  dob: Calendar,
  id_doc: FileText
};

const INITIAL_ENTITIES = [
  {
    id: 'name',
    label: 'Full Name',
    value: '',
    type: 'alpha',
    confidence: 0,
    status: 'waiting', // 'waiting', 'pending', 'verified', 'corrected', 'flagged'
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

const HISTORICAL_SESSIONS = [
  {
    id: 'SES-94812',
    customer: 'Rahul Sharma',
    customerId: 'CUST-8021',
    appNo: 'LOAN-2025-881',
    entityCount: 6,
    initialConf: 82,
    finalConf: 96,
    corrections: 1,
    status: 'In Progress',
    time: 'Today, 10:45 AM',
    channel: 'Inbound IVR'
  },
  {
    id: 'SES-94811',
    customer: 'Priya Narang',
    customerId: 'CUST-7944',
    appNo: 'INS-HLT-904',
    entityCount: 5,
    initialConf: 94,
    finalConf: 99,
    corrections: 0,
    status: 'Verified',
    time: 'Today, 09:30 AM',
    channel: 'Agent Voice Stream'
  },
  {
    id: 'SES-94808',
    customer: 'Amitabh Sen',
    customerId: 'CUST-7210',
    appNo: 'CC-PREM-412',
    entityCount: 6,
    initialConf: 69,
    finalConf: 95,
    corrections: 3,
    status: 'Verified',
    time: 'Yesterday, 04:15 PM',
    channel: 'Inbound IVR'
  },
  {
    id: 'SES-94799',
    customer: 'Sneha Kulkarni',
    customerId: 'CUST-6891',
    appNo: 'MORTG-7721',
    entityCount: 6,
    initialConf: 58,
    finalConf: 64,
    corrections: 2,
    status: 'Rejected',
    time: 'Yesterday, 02:40 PM',
    channel: 'Web RTC'
  },
  {
    id: 'SES-94782',
    customer: 'David George',
    customerId: 'CUST-6502',
    appNo: 'SAV-ACC-119',
    entityCount: 4,
    initialConf: 91,
    finalConf: 98,
    corrections: 0,
    status: 'Verified',
    time: '24 May, 11:20 AM',
    channel: 'Inbound IVR'
  }
];

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
  const [selectedSttLanguage, setSelectedSttLanguage] = useState('hi-IN'); // 'hi-IN' (Hindi/Hinglish) or 'en-IN' (English/Hinglish)
  const [sttEngineStatus, setSttEngineStatus] = useState('Gnani Prisma-v3.0 (hi-IN)');
  const [selectedTtsVoice, setSelectedTtsVoice] = useState('Shivani'); // Reference audio tone match (Shivani Indian Female Tone)
  const [selectedTtsModel, setSelectedTtsModel] = useState('timbre-v3.0');
  const [voiceApiStatus, setVoiceApiStatus] = useState(null);

  // Real-time audio waveform visualizer bars (22 frequency slots)
  const [audioWaveformHeights, setAudioWaveformHeights] = useState(
    [35, 60, 20, 85, 95, 45, 100, 70, 40, 90, 65, 30, 80, 50, 25, 90, 40, 75, 30, 60, 85, 20]
  );
  
  // Web Audio Context & MediaRecorder Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);
  const streamRef = useRef(null);
  const activeAudioRef = useRef(null);
  const audioAnimationIntervalRef = useRef(null);
  const currentPlaybackIdRef = useRef(0); // Sequence token to guarantee strict single-audio stream and zero overlaps

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

  // Dashboard & History live backend state
  const [dashboardStats, setDashboardStats] = useState(null);
  const [recentSessions, setRecentSessions] = useState(HISTORICAL_SESSIONS);
  const [historyList, setHistoryList] = useState(HISTORICAL_SESSIONS);
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatusFilter, setHistoryStatusFilter] = useState('All Statuses');
  const [historyChannelFilter, setHistoryChannelFilter] = useState('All Channels');
  const [analyticsData, setAnalyticsData] = useState(null);

  // Real-time dialogue log (starts empty, only displays real speech / typed input)
  const [dialogue, setDialogue] = useState([]);

  // Load live data from Backend API on mount & tab changes
  useEffect(() => {
    loadDashboardData();
    loadAnalyticsData();
    loadSessionsList();
    loadVoiceStatus();
  }, []);

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
        if (data.recent_sessions && data.recent_sessions.length > 0) {
          const mapped = data.recent_sessions.map(s => ({
            id: s.id,
            customer: s.customer || s.customer_name || 'Rahul Sharma',
            customerId: s.customerId || s.customer_id || 'CUST-8021',
            appNo: s.app_no,
            entityCount: s.entity_count || 6,
            initialConf: Math.round(s.initial_conf || 80),
            finalConf: Math.round(s.final_conf || 95),
            corrections: s.corrections || 0,
            status: s.status || 'Verified',
            time: 'Today, ' + new Date(s.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            channel: s.channel || 'Inbound IVR'
          }));
          setRecentSessions(mapped);
        }
      }
    } catch (err) {
      console.warn('Dashboard API fallback to local state:', err);
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
          customer: s.customer_name || s.customer || 'Rahul Sharma',
          customerId: s.customer_code || s.customer_id || 'CUST-8021',
          appNo: s.app_no,
          entityCount: s.entity_count || 6,
          initialConf: Math.round(s.initial_conf || 80),
          finalConf: Math.round(s.final_conf || 95),
          corrections: s.corrections || 0,
          status: s.status || 'Verified',
          time: new Date(s.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          channel: s.channel || 'Inbound IVR'
        }));
        setHistoryList(mapped);
      }
    } catch (err) {
      console.warn('Sessions list API fallback to local state:', err);
    }
  };

  const loadAnalyticsData = async () => {
    try {
      const data = await fetchDetailedAnalytics();
      if (data) {
        setAnalyticsData(data);
      }
    } catch (err) {
      console.warn('Analytics API fallback:', err);
    }
  };

  // Switch session into Live Verification
  const inspectSession = async (sess) => {
    try {
      setCurrentSessionId(sess.id);
      setCustomerName(sess.customer);
      setCustomerId(sess.customerId);
      setAppNo(sess.appNo);
      setActiveTab('live');

      const details = await fetchSessionDetails(sess.id);
      if (details && details.session && details.session.entities && details.session.entities.length > 0) {
        const mappedEntities = details.session.entities.map(e => ({
          id: e.entity_type,
          label: e.label,
          value: e.value,
          type: e.entity_type,
          confidence: Math.round(e.confidence),
          status: e.status,
          history: e.history || [e.value],
          phoneticSummary: e.phonetic_summary || '',
          icon: ENTITY_ICONS[e.entity_type] || User,
          verifiedAt: e.verified_at
        }));
        setEntities(mappedEntities);
      }
    } catch (err) {
      console.warn('Could not load session details from API:', err);
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

  const ensureSessionActive = () => {
    if (currentSessionId) return currentSessionId;
    const randomNum = Math.floor(10000 + Math.random() * 90000);
    const newSessId = `SES-${randomNum}`;
    setCurrentSessionId(newSessId);
    setCustomerId(`CUST-${Math.floor(1000 + Math.random() * 9000)}`);
    setAppNo(`LOAN-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    return newSessId;
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

  const interruptAudioPlayback = () => {
    // Invalidate any in-flight or ongoing TTS playback requests immediately
    currentPlaybackIdRef.current += 1;
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

  // Text-to-Speech Readback implementation using Official Gnani Timbre v3.0 (Shivani female voice matching reference audio)
  const speakReadBack = async (text, customSpelling = null) => {
    let speechContent = customSpelling || text;
    if (!speechContent || !speechContent.trim()) return;

    // Interrupt any ongoing audio and capture unique sequence token for this request
    interruptAudioPlayback();
    const myPlaybackId = currentPlaybackIdRef.current;

    setIsPlayingAudio(true);
    setAudioFeedbackNotice(`Gnani Timbre v3.0 (${selectedTtsVoice}): Synthesizing...`);

    // Helper to animate visualizer bars during audio playback
    const startWaveformAnimation = () => {
      if (audioAnimationIntervalRef.current) clearInterval(audioAnimationIntervalRef.current);
      audioAnimationIntervalRef.current = setInterval(() => {
        setAudioWaveformHeights(prev =>
          prev.map(() => Math.floor(Math.random() * 75) + 25)
        );
      }, 90);
    };

    const stopWaveformAnimation = () => {
      if (audioAnimationIntervalRef.current) {
        clearInterval(audioAnimationIntervalRef.current);
        audioAnimationIntervalRef.current = null;
      }
      setAudioWaveformHeights([35, 60, 20, 85, 95, 45, 100, 70, 40, 90, 65, 30, 80, 50, 25, 90, 40, 75, 30, 60, 85, 20]);
      setIsPlayingAudio(false);
      setAudioFeedbackNotice('');
    };

    try {
      // Synthesize using official Gnani Timbre v3.0 API with selected Indian voice (default Shivani female tone)
      const audioUrl = await synthesizeSpeechAPI(speechContent, {
        voice: selectedTtsVoice,
        model: selectedTtsModel || 'timbre-v3.0',
        speed: 1.0
      });

      // Strict single-audio check: if interrupted or superseded during network fetch, discard immediately
      if (myPlaybackId !== currentPlaybackIdRef.current) {
        if (audioUrl) {
          try { URL.revokeObjectURL(audioUrl); } catch (e) {}
        }
        return;
      }

      // Ensure any previously active audio element is paused
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
          try {
            audio.pause();
            audio.src = "";
          } catch (e) {}
          return;
        }
        setIsPlayingAudio(true);
        startWaveformAnimation();
        setAudioFeedbackNotice(`Gnani Timbre v3.0 (${selectedTtsVoice} - Indian Female Tone): "${speechContent.slice(0, 50)}..."`);
      };

      audio.onended = () => {
        if (myPlaybackId === currentPlaybackIdRef.current) {
          stopWaveformAnimation();
          activeAudioRef.current = null;
          // Full Automation: Hands-free listening for customer's response
          if (isAutonomousModeRef.current) {
            setAudioFeedbackNotice('EchoTrust AI is listening... Speak into microphone.');
            setTimeout(() => {
              if (isAutonomousModeRef.current && !isRecordingRef.current && !isProcessingAudioRef.current && !activeAudioRef.current) {
                startMicrophoneCapture();
              }
            }, 500);
          }
        }
        try { URL.revokeObjectURL(audioUrl); } catch (e) {}
      };

      audio.onerror = (e) => {
        console.warn('Gnani TTS playback error:', e);
        if (myPlaybackId === currentPlaybackIdRef.current) {
          stopWaveformAnimation();
          activeAudioRef.current = null;
        }
        try { URL.revokeObjectURL(audioUrl); } catch (err) {}
      };

      await audio.play();
    } catch (apiErr) {
      if (apiErr && (apiErr.name === 'AbortError' || apiErr.message?.includes('interrupted') || apiErr.message?.includes('abort'))) {
        return; // Normal interruption, ignore cleanly
      }
      console.warn('Gnani TTS API call error:', apiErr);
      if (myPlaybackId === currentPlaybackIdRef.current) {
        stopWaveformAnimation();
        setAudioFeedbackNotice('Gnani TTS audio synthesis unavailable.');
      }
    }
  };

  // Full Automation: Start KYC call with opening reference audio (Shivani tone) and auto-listen loop
  const handleStartAutomatedSession = async () => {
    const activeSess = ensureSessionActive();
    setIsAutonomousMode(true);
    isAutonomousModeRef.current = true;
    hasSpokenInTurnRef.current = false;
    lastSpokenTimeRef.current = null;

    // Interrupt any ongoing audio
    interruptAudioPlayback();
    const myPlaybackId = currentPlaybackIdRef.current;

    const openingGreeting = "नमस्ते, कैसे हैं आप? मैं EchoTrust AI assistant हूँ, मैं आपकी details verify करने में help करूँगी। सबसे पहले, क्या मैं आपका नाम confirm कर सकती हूँ?";

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

    setIsPlayingAudio(true);
    setAudioFeedbackNotice('EchoTrust AI (Shivani): Initiating verification call...');

    // Animate visualizer bars
    if (audioAnimationIntervalRef.current) clearInterval(audioAnimationIntervalRef.current);
    audioAnimationIntervalRef.current = setInterval(() => {
      setAudioWaveformHeights(prev =>
        prev.map(() => Math.floor(Math.random() * 75) + 25)
      );
    }, 90);

    try {
      const audio = new Audio('/generated-audio.wav');
      activeAudioRef.current = audio;

      audio.onplay = () => {
        if (myPlaybackId !== currentPlaybackIdRef.current) {
          try { audio.pause(); audio.src = ""; } catch (e) {}
          return;
        }
        setIsPlayingAudio(true);
      };

      audio.onended = () => {
        if (myPlaybackId === currentPlaybackIdRef.current) {
          if (audioAnimationIntervalRef.current) {
            clearInterval(audioAnimationIntervalRef.current);
            audioAnimationIntervalRef.current = null;
          }
          setIsPlayingAudio(false);
          activeAudioRef.current = null;
          setAudioFeedbackNotice('EchoTrust AI is listening... Speak your full name.');

          // Full Automation: Automatically start microphone to capture customer's answer!
          if (isAutonomousModeRef.current) {
            setTimeout(() => {
              if (isAutonomousModeRef.current && !isRecordingRef.current && !isProcessingAudioRef.current && !activeAudioRef.current) {
                startMicrophoneCapture();
              }
            }, 400);
          }
        }
      };

      audio.onerror = () => {
        if (myPlaybackId === currentPlaybackIdRef.current) {
          if (audioAnimationIntervalRef.current) {
            clearInterval(audioAnimationIntervalRef.current);
            audioAnimationIntervalRef.current = null;
          }
          setIsPlayingAudio(false);
          activeAudioRef.current = null;
          if (isAutonomousModeRef.current) {
            setTimeout(() => {
              startMicrophoneCapture();
            }, 400);
          }
        }
      };

      await audio.play();
    } catch (e) {
      console.warn('Autoplay notice:', e);
      setIsPlayingAudio(false);
      setAudioFeedbackNotice('EchoTrust AI ready. Click "Start Voice Capture" or speak into microphone.');
    }
  };

  // Play and Transcribe generated-audio.wav with Gnani STT
  const handleProcessSampleAudio = async () => {
    if (isProcessingAudio) {
      setAudioFeedbackNotice('Please wait for current speech processing to complete...');
      return;
    }
    const activeSess = ensureSessionActive();
    setIsProcessingAudio(true);
    setAudioFeedbackNotice(`Transcribing generated-audio.wav with Official Gnani STT (${selectedSttLanguage})...`);

    // Interrupt any previous playback and get token for sample audio
    interruptAudioPlayback();
    const myPlaybackId = currentPlaybackIdRef.current;

    try {
      const audio = new Audio('/generated-audio.wav');
      activeAudioRef.current = audio;
      audio.onplay = () => {
        if (myPlaybackId !== currentPlaybackIdRef.current) {
          try { audio.pause(); audio.src = ""; } catch (e) {}
          return;
        }
        setIsPlayingAudio(true);
      };
      audio.onended = () => {
        if (myPlaybackId === currentPlaybackIdRef.current) {
          setIsPlayingAudio(false);
          activeAudioRef.current = null;
        }
      };
      audio.onerror = () => {
        if (myPlaybackId === currentPlaybackIdRef.current) {
          setIsPlayingAudio(false);
          activeAudioRef.current = null;
        }
      };
      audio.play().catch(e => {
        if (e.name !== 'AbortError') console.warn('Audio play notice:', e);
      });
    } catch (e) {
      console.warn('Audio play notice:', e);
    }

    try {
      const targetId = isCorrecting && correctionTarget ? correctionTarget.id : null;
      const res = await transcribeSampleAudioAPI(activeSess, targetId);

      if (res && res.transcript) {
        const transcript = res.transcript;
        const conf = res.confidence || 94.5;
        setSttEngineStatus(res.stt_engine || 'Gnani Prisma-v3.0 (indic-auto)');

        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setDialogue(prev => [
          ...prev,
          {
            id: Date.now(),
            sender: 'user',
            text: `[Reference Audio: generated-audio.wav] ${transcript}`,
            time: timeNow
          },
          {
            id: Date.now() + 1,
            sender: 'ai',
            text: res.ai_response_text || `Acoustic stream successfully verified via Official Gnani STT (${res.stt_engine || 'prisma-v3.0'} - ${conf}% confidence). Active voice calibrated to Shivani (Timbre v3.0 Female Tone).`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }
        ]);

        if (res.extracted_entities && res.extracted_entities.length > 0) {
          applyExtractedEntities(res.extracted_entities, transcript, conf, false);
        }

        setAudioFeedbackNotice(`Transcribed successfully via Official Gnani STT (${conf}% confidence)`);
      }
    } catch (err) {
      console.error('Sample audio processing error:', err);
      setAudioFeedbackNotice('Failed to process generated-audio.wav with Gnani STT API.');
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

  // Real-time microphone audio capture with Web Audio API & Analyser
  const startMicrophoneCapture = async () => {
    try {
      ensureSessionActive();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setAudioFeedbackNotice('Microphone access is not supported by your browser.');
        return;
      }

      setAudioFeedbackNotice('Requesting high-fidelity microphone with active noise suppression...');
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

          // Full Automation VAD: Compute average volume level
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
      setAudioFeedbackNotice('Listening in real time... Speak into your microphone (e.g. name, phone, PAN, address)');
    } catch (err) {
      console.error('Microphone access denied:', err);
      setIsRecording(false);
      isRecordingRef.current = false;
      setAudioFeedbackNotice(`Microphone access error: ${err.message || 'Permission denied'}. You can also type speech input below.`);
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
    if (!audioBlob || audioBlob.size < 200) {
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

    const activeSess = ensureSessionActive();
    setIsProcessingAudio(true);
    isProcessingAudioRef.current = true;
    setAudioFeedbackNotice(`Transcribing with Official Gnani STT (Prisma-v3.0 ${selectedSttLanguage})...`);

    try {
      const targetId = isCorrecting && correctionTarget ? correctionTarget.id : null;
      const res = await transcribeAudioBlob(audioBlob, activeSess, targetId, selectedSttLanguage);
      
      if (res && res.status === 'error') {
        setAudioFeedbackNotice(res.error || 'Gnani STT busy. Please wait a moment and try speaking again.');
        return;
      }

      if (res && res.transcript) {
        const transcript = res.transcript;
        const conf = res.confidence || 94.5;
        setSttEngineStatus(res.stt_engine || `Gnani Prisma-v3.0 (${selectedSttLanguage})`);

        const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setDialogue(prev => [
          ...prev,
          {
            id: Date.now(),
            sender: 'user',
            text: transcript,
            time: timeNow
          }
        ]);

        if (res.extracted_entities && res.extracted_entities.length > 0) {
          applyExtractedEntities(res.extracted_entities, transcript, conf, false);
        }

        if (res.ai_response_text) {
          setDialogue(prev => [
            ...prev,
            {
              id: Date.now() + 1,
              sender: 'ai',
              text: res.ai_response_text,
              phonetic: res.action === 'entity_captured',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            }
          ]);
          speakReadBack(res.ai_response_text);
        }

        setAudioFeedbackNotice(`Transcribed via Gnani STT (${conf}% confidence)`);
      } else if (res && res.error) {
        setAudioFeedbackNotice(`Gnani STT error: ${res.error}`);
      }
    } catch (err) {
      console.error('Audio processing error:', err);
      setAudioFeedbackNotice(`Audio processing error: ${err.message || 'Check microphone or API'}`);
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

    // Interrupt any playing audio before submitting
    interruptAudioPlayback();
    const activeSess = ensureSessionActive();

    const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDialogue(prev => [
      ...prev,
      {
        id: Date.now(),
        sender: 'user',
        text: inputText,
        time: timeNow
      }
    ]);

    setIsProcessingAudio(true);
    setAudioFeedbackNotice('Processing speech with Gnani AI Conversational Engine...');

    try {
      const targetId = isCorrecting && correctionTarget ? correctionTarget.id : null;
      const res = await processDialogueAPI(inputText, activeSess, targetId);

      if (res && res.extracted_entities && res.extracted_entities.length > 0) {
        applyExtractedEntities(res.extracted_entities, inputText, 95.0, false);
      }

      if (res && res.ai_response_text) {
        setDialogue(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'ai',
            text: res.ai_response_text,
            phonetic: res.action === 'entity_captured',
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }
        ]);
        speakReadBack(res.ai_response_text);
      }
    } catch (err) {
      console.error('Dialogue processing error:', err);
      setAudioFeedbackNotice('Dialogue processing notice: Check backend connection.');
    } finally {
      setIsProcessingAudio(false);
      isProcessingAudioRef.current = false;
    }
  };

  const handleConfirmEntity = async (entityId) => {
    const ent = entities.find(e => e.id === entityId);
    if (!ent) return;

    try {
      await confirmEntityAPI(
        currentSessionId,
        entityId,
        ent.type,
        ent.value,
        Math.max(ent.confidence, 96)
      );

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setEntities(prev => prev.map(item => {
        if (item.id === entityId) {
          return {
            ...item,
            status: 'verified',
            confidence: Math.max(item.confidence, 96),
            verifiedAt: timeStr
          };
        }
        return item;
      }));

      const timeSecs = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setDialogue(prev => [
        ...prev,
        {
          id: Date.now(),
          sender: 'user',
          text: `Yes, ${ent.label} is correct.`,
          time: timeSecs
        },
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: `Acknowledged. ${ent.label} (${ent.value}) has been marked verified with high confidence.`,
          time: timeSecs
        }
      ]);

      const nextPendingIndex = entities.findIndex((e, i) => i !== activeEntityIndex && e.status !== 'verified');
      if (nextPendingIndex !== -1) {
        setActiveEntityIndex(nextPendingIndex);
        const nextEnt = entities[nextPendingIndex];
        const nextPhonetics = getPhoneticSpelling(nextEnt.value).map(p => `${p.char} as in ${p.code}`).join(', ');
        speakReadBack(`Now proceeding to ${nextEnt.label}: ${nextEnt.value}. Phonetic confirmation: ${nextPhonetics}. Is this correct?`);
      } else {
        speakReadBack(`All 6 customer identity entities successfully confirmed and verified for ${customerName}. Session ready for final approval.`);
      }

      loadDashboardData();
    } catch (err) {
      console.error('Confirmation error:', err);
    }
  };

  const initiateCorrection = (entity) => {
    setCorrectionTarget(entity);
    setCorrectionInput(entity.value);
    setIsCorrecting(true);
  };

  const submitCorrection = async () => {
    if (!correctionTarget || !correctionInput.trim()) return;

    try {
      const res = await correctEntityAPI(
        currentSessionId,
        correctionTarget.id,
        correctionTarget.type,
        correctionTarget.value,
        correctionInput,
        correctionTarget.confidence
      );

      const correctedData = res?.corrected_entity;
      const updatedPhonetics = getPhoneticSpelling(correctionInput)
        .map(p => `${p.char} as in ${p.code}`)
        .join(', ');

      setEntities(prev => prev.map(ent => {
        if (ent.id === correctionTarget.id) {
          return {
            ...ent,
            value: correctedData?.value || correctionInput,
            confidence: correctedData?.confidence || 94,
            status: 'corrected',
            history: [...ent.history, correctionInput],
            phoneticSummary: updatedPhonetics.slice(0, 48) + '...'
          };
        }
        return ent;
      }));

      const timeNow = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const newDialogue = [
        ...dialogue,
        {
          id: Date.now(),
          sender: 'user',
          text: `No, that was incorrect. The correct ${correctionTarget.label} is: ${correctionInput}.`,
          time: timeNow
        },
        {
          id: Date.now() + 1,
          sender: 'ai',
          text: `Updating ${correctionTarget.label} to "${correctionInput}". Re-verifying phonetically: ${updatedPhonetics.slice(0, 80)}. Is this accurate?`,
          phonetic: true,
          time: timeNow
        }
      ];
      setDialogue(newDialogue);
      setIsCorrecting(false);
      
      speakReadBack(`Captured update: ${correctionInput}. Phonetic breakdown: ${updatedPhonetics}. Is this correct?`);
      loadDashboardData();
    } catch (err) {
      console.error('Correction submission error:', err);
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
                className="text-indigo-700 hover:underline font-semibold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* =========================================================
              TAB: ANALYTICS (THE REDESIGNED SHOWCASE)
             ========================================================= */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* --- SECTION 4: ANALYTICS KPI CARDS (4 in a single responsive row) --- */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* Card 1: First Attempt Confirmation (Emerald Theme) */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all border-l-4 border-l-emerald-600 relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">First Attempt Confirmation</p>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">89.4%</span>
                    <span className="inline-flex items-center space-x-0.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>+2.3%</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 font-medium">Direct verbal match rate with NATO prompts</p>
                </div>

                {/* Card 2: Correction Recovery Rate (Green Theme) */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all border-l-4 border-l-emerald-500 relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Correction Recovery Rate</p>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">97.8%</span>
                    <span className="inline-flex items-center space-x-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Resolved in 1 loop</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 font-medium">Automatic character disambiguation loop</p>
                </div>

                {/* Card 3: Average Verification Time (Purple Theme) */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all border-l-4 border-l-purple-600 relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Average Verification Time</p>
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 group-hover:scale-105 transition-transform">
                      <Timer className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">42.6 sec</span>
                    <span className="inline-flex items-center space-x-0.5 text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-200">
                      <Zap className="w-3 h-3 text-purple-600 mr-0.5" />
                      <span>-0.8 sec</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 font-medium">Across 6 standard BFSI extracted entities</p>
                </div>

                {/* Card 4: Fraud / Mismatch Prevention (Pink Theme) */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all border-l-4 border-l-pink-500 relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Fraud / Mismatch Prevention</p>
                    <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center border border-pink-100 group-hover:scale-105 transition-transform">
                      <ShieldAlert className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-3xl font-extrabold text-slate-900 tracking-tight">323 cases</span>
                    <span className="inline-flex items-center space-x-0.5 text-xs font-bold text-pink-700 bg-pink-50 px-2 py-0.5 rounded-lg border border-pink-200">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      <span>+12%</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5 font-medium">Prevented wrong policy or loan dispatches</p>
                </div>
              </div>

              {/* --- SECTION 5: TWO LARGE CHARTS --- */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Chart: Most Frequently Corrected Entity Types */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs hover:shadow-md transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Most Frequently Corrected Entity Types</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Frequency of first-pass confirmations vs correction triggers</p>
                    </div>
                    {/* Visual Legend */}
                    <div className="flex items-center space-x-3 text-xs font-semibold">
                      <span className="flex items-center text-slate-700">
                        <span className="w-3 h-3 rounded-md bg-[#10B981] mr-1.5 shadow-2xs"></span>
                        First-Pass Confirmed
                      </span>
                      <span className="flex items-center text-slate-700">
                        <span className="w-3 h-3 rounded-md bg-[#F59E0B] mr-1.5 shadow-2xs"></span>
                        Correction Loop
                      </span>
                    </div>
                  </div>

                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analyticsData?.corrections_by_entity_chart || [
                          { entity: 'Full Name', autoConfirmed: 2400, corrections: 340 },
                          { entity: 'Address', autoConfirmed: 1800, corrections: 520 },
                          { entity: 'Bank Account', autoConfirmed: 2900, corrections: 210 },
                          { entity: 'Phone Number', autoConfirmed: 3200, corrections: 95 },
                          { entity: 'PAN / Tax', autoConfirmed: 2100, corrections: 290 },
                          { entity: 'DOB', autoConfirmed: 3500, corrections: 40 },
                        ]}
                        margin={{ top: 15, right: 10, left: -10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="entity" stroke="#64748B" fontSize={11} fontWeight={600} tickLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                          itemStyle={{ color: '#E2E8F0' }}
                        />
                        <Bar dataKey="autoConfirmed" fill="#10B981" name="First-Pass Confirmed" radius={[5, 5, 0, 0]} />
                        <Bar dataKey="corrections" fill="#F59E0B" name="Required Correction Loop" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Right Chart: Confidence Score Distribution (Purple line + light purple gradient area) */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs hover:shadow-md transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">Confidence Score Distribution</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Acoustic confidence distribution across verified voice streams</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 border border-purple-200 self-start sm:self-auto">
                      Acoustic Calibration
                    </span>
                  </div>

                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={analyticsData?.confidence_distribution_chart || [
                          { bracket: 'Below 60%', count: 45 },
                          { bracket: '60–70%', count: 120 },
                          { bracket: '70–80%', count: 340 },
                          { bracket: '80–95%', count: 1420 },
                          { bracket: '90–95%', count: 2450 },
                          { bracket: '95–100%', count: 4120 },
                        ]}
                        margin={{ top: 15, right: 10, left: -10, bottom: 5 }}
                      >
                        <defs>
                          <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="bracket" stroke="#64748B" fontSize={11} fontWeight={600} tickLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={11} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#0F172A', borderColor: '#334155', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                          itemStyle={{ color: '#E2E8F0' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#8B5CF6"
                          strokeWidth={3}
                          fill="url(#purpleGradient)"
                          name="Sessions in Bracket"
                          dot={{ r: 4, stroke: '#8B5CF6', strokeWidth: 2, fill: '#FFFFFF' }}
                          activeDot={{ r: 6, fill: '#8B5CF6' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* --- SECTION 6: KEY INSIGHTS SECTION (Full-Width Card Below Charts) --- */}
              <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
                <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100">
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Key Operational Insights</h3>
                    <p className="text-xs text-slate-500">Automated performance summary based on 14,800+ customer confirmation interactions</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
                  {/* Insight 1: First Attempt Success */}
                  <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-900">First Attempt Success</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-white px-2 py-0.5 rounded border border-emerald-200">
                        +2.3%
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-extrabold text-emerald-900">89.4%</div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        First Attempt Success reached <strong>89.4%</strong>, improved by <strong>2.3%</strong> with phonetic NATO prompts preventing homophone confusion.
                      </p>
                    </div>
                  </div>

                  {/* Insight 2: Average Verification Time */}
                  <div className="bg-purple-50/40 rounded-xl p-4 border border-purple-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Timer className="w-4 h-4 text-purple-600" />
                        <span className="text-xs font-bold text-slate-900">Average Verification Time</span>
                      </div>
                      <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        -0.8 sec
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-extrabold text-purple-900">42.6 seconds</div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Average Verification Time dropped to <strong>42.6 seconds</strong>, reduced by <strong>0.8 seconds</strong> across 6 BFSI identity fields.
                      </p>
                    </div>
                  </div>

                  {/* Insight 3: Fraud Checks & Mismatch Prevention */}
                  <div className="bg-pink-50/40 rounded-xl p-4 border border-pink-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <ShieldAlert className="w-4 h-4 text-pink-600" />
                        <span className="text-xs font-bold text-slate-900">Fraud & Mismatch Prevention</span>
                      </div>
                      <span className="text-xs font-bold text-pink-700 bg-pink-50 px-2 py-0.5 rounded border border-pink-200">
                        +12% gain
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-extrabold text-pink-900">323 cases</div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Fraud checks identified <strong>323 mismatch cases</strong>, reflecting a <strong>12% improvement</strong> in preventing misattributed accounts.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Machine Learning Correction Model Insights Card */}
              {analyticsData?.ml_model_insights && (
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-bold text-slate-900 text-sm">Correction Machine Learning Engine</h4>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {analyticsData.ml_model_insights.status === 'trained' ? 'Model Trained & Active' : 'Accumulating Samples'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {analyticsData.ml_model_insights.message || 'Analyzed phonetic substitutions from verified audit logs.'}
                      </p>
                    </div>
                  </div>

                  {analyticsData.ml_model_insights.top_acoustic_confusions && analyticsData.ml_model_insights.top_acoustic_confusions.length > 0 && (
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-slate-400 font-semibold">Learned Confusions:</span>
                      {analyticsData.ml_model_insights.top_acoustic_confusions.slice(0, 3).map((item, idx) => (
                        <span key={idx} className="bg-slate-100 text-slate-700 px-2 py-1 rounded-md font-mono text-[11px] font-bold border border-slate-200">
                          {item.substitution}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              TAB: DASHBOARD
             ========================================================= */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Executive Verification Dashboard</h2>
                  <p className="text-xs text-slate-500">Real-time phonetic read-back confirmation and speech accuracy monitoring</p>
                </div>
                <button
                  onClick={() => setActiveTab('live')}
                  className="flex items-center space-x-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  <Mic className="w-4 h-4" />
                  <span>Open Live Session</span>
                </button>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { title: 'Total Sessions', value: dashboardStats ? dashboardStats.total_sessions.toLocaleString() : '14,892', change: '+12.4%', isUp: true, desc: 'Past 30 days', color: 'border-l-emerald-600' },
                  { title: 'Successfully Verified', value: dashboardStats ? dashboardStats.verified_sessions.toLocaleString() : '13,954', change: '+8.1%', isUp: true, desc: '93.7% First-pass', color: 'border-l-teal-500' },
                  { title: 'Pending Confirmation', value: dashboardStats ? dashboardStats.pending_sessions.toLocaleString() : '342', change: '-4.2%', isUp: false, desc: 'Awaiting customer OK', color: 'border-l-amber-500' },
                  { title: 'Correction Loop Run', value: dashboardStats ? dashboardStats.corrections_run.toLocaleString() : '596', change: '-18.5%', isUp: true, desc: 'Errors caught & fixed', color: 'border-l-indigo-500' },
                  { title: 'Overall Accuracy Rate', value: dashboardStats ? `${dashboardStats.accuracy_rate}%` : '98.6%', change: '+0.8%', isUp: true, desc: 'Post read-back confirm', color: 'border-l-emerald-500' },
                ].map((stat, idx) => (
                  <div key={idx} className={`bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs border-l-4 ${stat.color}`}>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.title}</p>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-extrabold text-slate-900">{stat.value}</span>
                      <span className={`text-xs font-semibold flex items-center ${stat.isUp ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {stat.isUp ? <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> : <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" />}
                        {stat.change}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{stat.desc}</p>
                  </div>
                ))}
              </div>

              {/* Recent Verification Activity Table */}
              <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Recent Verification Sessions</h3>
                    <p className="text-xs text-slate-500">Live feed of voice capture and phonetic confirmations</p>
                  </div>
                  <button onClick={() => setActiveTab('history')} className="text-emerald-700 hover:text-emerald-900 text-xs font-semibold flex items-center cursor-pointer">
                    <span>View All in History</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Session & Customer</th>
                        <th className="py-3 px-4">Application No.</th>
                        <th className="py-3 px-4">Confidence Score</th>
                        <th className="py-3 px-4">Corrections</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {recentSessions.map((sess) => (
                        <tr key={sess.id} className="hover:bg-emerald-50/30 transition">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900">{sess.customer}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{sess.id} • {sess.customerId}</div>
                          </td>
                          <td className="py-3 px-4 font-mono font-medium text-slate-600">{sess.appNo}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-900">{sess.finalConf}%</span>
                              <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div className={`h-full ${sess.finalConf > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${sess.finalConf}%` }}></div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {sess.corrections > 0 ? (
                              <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">
                                {sess.corrections} Loop{sess.corrections > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="text-slate-400">0 (Direct)</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full font-medium inline-flex items-center space-x-1 ${
                              sess.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-teal-50 text-teal-800 border border-teal-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${sess.status === 'Verified' ? 'bg-emerald-500' : 'bg-teal-500'}`}></span>
                              {sess.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => inspectSession(sess)} className="text-emerald-700 hover:text-emerald-900 font-semibold hover:underline inline-flex items-center cursor-pointer">
                              Inspect <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

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
                            STT: Prisma-v3.0 ({selectedSttLanguage === 'hi-IN' ? 'Hindi / Hinglish' : 'English / Hinglish'}) | TTS: Timbre-v3.0 ({selectedTtsVoice})
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
                            title="STT Language (Hindi / English / Hinglish only - No Telugu)"
                          >
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
                            title="Select Gnani TTS Voice Tone"
                          >
                            <option value="Shivani">Shivani (Indian Female - Ref Audio Tone)</option>
                            <option value="Shubham">Shubham (Indian Male - Conversational)</option>
                            <option value="Devansh">Devansh (Indian Male - Warm)</option>
                            <option value="Prakash">Prakash (Indian Male - BFSI)</option>
                            <option value="Kaveri">Kaveri (Indian Female - Professional)</option>
                            <option value="Nalini">Nalini (Indian Female - Hindi)</option>
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
                  Showing 6 Extracted Entities for <strong>{currentSessionId || 'No Active Session'}</strong>
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
                <a
                  href={downloadComplianceCSVUrl(historySearch, historyStatusFilter)}
                  download="echotrust_compliance_audit.csv"
                  className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Export Compliance CSV</span>
                </a>
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

  // Verify and refresh session on load if token is stored
  useEffect(() => {
    if (token) {
      fetchCurrentUser(token)
        .then(res => {
          if (res && res.user) {
            setUser(res.user);
          }
        })
        .catch(() => {
          // Token invalid or expired
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
