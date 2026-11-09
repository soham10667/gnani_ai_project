import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, MicOff, Volume2, CheckCircle2, AlertTriangle, XCircle, RefreshCw,
  Search, Filter, ChevronRight, ArrowUpRight, ArrowDownRight, ShieldCheck,
  User, Phone, MapPin, CreditCard, Calendar, FileText, Settings, BarChart3,
  History, LayoutDashboard, Radio, Play, Pause, RotateCcw, Check, X,
  Sliders, Bell, Download, ExternalLink, HelpCircle, Sparkles, Building,
  Layers, Lock, Eye, AlertCircle, Info, ChevronDown, Clock, Timer, ShieldAlert,
  Menu, ChevronUp, Zap, CheckCircle
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
  extractEntitiesFromText,
  confirmEntityAPI,
  correctEntityAPI,
  downloadComplianceCSVUrl
} from './api';

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
    value: 'Rahul Sharma',
    type: 'alpha',
    confidence: 98,
    status: 'verified',
    history: ['Rahul Sharma'],
    phoneticSummary: 'R-Romeo, A-Alpha, H-Hotel, U-Uniform, L-Lima ...',
    icon: User,
    verifiedAt: '10:42 AM'
  },
  {
    id: 'phone',
    label: 'Phone Number',
    value: '9876543210',
    type: 'numeric',
    confidence: 92,
    status: 'verified',
    history: ['9876543210'],
    phoneticSummary: '9-8-7-6-5-4-3-2-1-0 (Individual Digits)',
    icon: Phone,
    verifiedAt: '10:43 AM'
  },
  {
    id: 'address',
    label: 'Residential Address',
    value: '24 MG Road, Pune, 411001',
    type: 'address',
    confidence: 76,
    status: 'pending',
    history: ['24 MG Road, Pune, 411001'],
    phoneticSummary: 'Flat 24, M-G Road, Pune, Pin 4-1-1-0-0-1',
    icon: MapPin,
    verifiedAt: null
  },
  {
    id: 'account',
    label: 'Account Number',
    value: '123456789012',
    type: 'numeric',
    confidence: 65,
    status: 'flagged',
    history: ['123456789012'],
    phoneticSummary: '1-2-3-4-5-6-7-8-9-0-1-2',
    icon: CreditCard,
    verifiedAt: null
  },
  {
    id: 'dob',
    label: 'Date of Birth',
    value: '15/08/2002',
    type: 'date',
    confidence: 99,
    status: 'verified',
    history: ['15/08/2002'],
    phoneticSummary: '15th August, Year Two Thousand Two',
    icon: Calendar,
    verifiedAt: '10:41 AM'
  },
  {
    id: 'id_doc',
    label: 'National ID / PAN',
    value: 'ABCDE1234F',
    type: 'alphanumeric',
    confidence: 84,
    status: 'pending',
    history: ['ABCDE1234F'],
    phoneticSummary: 'A-Alpha, B-Bravo, C-Charlie, D-Delta, E-Echo ...',
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

// Modern EchoTrust Brand Logo Component (Resonant Sound-Wave & Trust Shield)
function EchoTrustLogo({ className = "w-6 h-6" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="echoTrustGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset="0.5" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#6366F1" />
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
        fillOpacity="0.14" 
      />
      {/* Resonant Acoustic Waveform Bars */}
      <rect x="7" y="10.5" width="1.5" height="3" rx="0.75" fill="#38BDF8" />
      <rect x="9.5" y="8" width="1.5" height="8" rx="0.75" fill="#60A5FA" />
      <rect x="12" y="6" width="1.5" height="12" rx="0.75" fill="#FFFFFF" />
      <rect x="14.5" y="8" width="1.5" height="8" rx="0.75" fill="#818CF8" />
      <rect x="17" y="10.5" width="1.5" height="3" rx="0.75" fill="#A78BFA" />
    </svg>
  );
}

export default function EchoTrustApp() {
  // Navigation State - Defaults to Analytics as requested in the redesign prompt!
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics', 'dashboard', 'live', 'entities', 'history', 'settings', 'audit_logs'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState('Last 30 Days');
  
  // Live Verification Session State
  const [currentSessionId, setCurrentSessionId] = useState('SES-94812');
  const [customerName, setCustomerName] = useState('Rahul Sharma');
  const [customerId, setCustomerId] = useState('CUST-8021');
  const [appNo, setAppNo] = useState('LOAN-2025-881');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [callDuration, setCallDuration] = useState(132); // seconds
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activeEntityIndex, setActiveEntityIndex] = useState(0);
  const [entities, setEntities] = useState(INITIAL_ENTITIES);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState(null);
  const [correctionInput, setCorrectionInput] = useState('');
  const [audioFeedbackNotice, setAudioFeedbackNotice] = useState('');
  const [sttEngineStatus, setSttEngineStatus] = useState('EchoTrust-BFSI-v4.2');

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

  // Real-time dialogue log
  const [dialogue, setDialogue] = useState([
    {
      id: 1,
      sender: 'ai',
      text: 'Hello, welcome to Apex Bank secure verification powered by EchoTrust. Please state your full name to get started.',
      time: '10:40:12'
    },
    {
      id: 2,
      sender: 'user',
      text: 'My name is Rahul Sharma.',
      time: '10:40:19'
    },
    {
      id: 3,
      sender: 'ai',
      text: 'I captured your name as Rahul Sharma. Let me confirm the spelling: R as in Romeo, A as in Alpha, H as in Hotel, U as in Uniform, L as in Lima. Is this correct?',
      phonetic: true,
      time: '10:40:27'
    },
    {
      id: 4,
      sender: 'user',
      text: 'Yes, that is correct.',
      time: '10:40:33'
    },
    {
      id: 5,
      sender: 'ai',
      text: 'Great. Now please provide your residential address for policy dispatch.',
      time: '10:40:39'
    },
    {
      id: 6,
      sender: 'user',
      text: 'It is 24 MG Road, Pune, 411001.',
      time: '10:40:48'
    },
    {
      id: 7,
      sender: 'ai',
      text: 'I parsed: House 2-4, Street M-G Road, City Pune, PIN 4-1-1-0-0-1. Is this exact?',
      phonetic: true,
      time: '10:40:55'
    }
  ]);

  // Load live data from Backend API on mount & tab changes
  useEffect(() => {
    loadDashboardData();
    loadAnalyticsData();
    loadSessionsList();
  }, []);

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

  // Audio timer ticker
  useEffect(() => {
    let interval;
    if (isRecording) {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const formatDuration = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
  };

  // Text-to-Speech Readback implementation
  const speakReadBack = (text, customSpelling = null) => {
    if (!('speechSynthesis' in window)) {
      setAudioFeedbackNotice('Text-to-Speech not supported on this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    
    let speechContent = text;
    if (customSpelling) {
      speechContent = customSpelling;
    }
    
    const utterance = new SpeechSynthesisUtterance(speechContent);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.onstart = () => {
      setIsPlayingAudio(true);
      setAudioFeedbackNotice(`AI Synthesizing: "${speechContent.slice(0, 55)}..."`);
    };
    utterance.onend = () => {
      setIsPlayingAudio(false);
      setAudioFeedbackNotice('');
    };
    utterance.onerror = () => {
      setIsPlayingAudio(false);
      setAudioFeedbackNotice('');
    };

    window.speechSynthesis.speak(utterance);
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
        const s = Math.max(-1, Math.min(1, channelData[i]));
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
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setAudioFeedbackNotice('Microphone access is not supported by your browser.');
        return;
      }

      setAudioFeedbackNotice('Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
          const newHeights = [];
          for (let i = 0; i < 22; i++) {
            const index = Math.floor((i / 22) * bufferLength);
            const val = dataArray[index] || 15;
            const percentage = Math.max(15, Math.min(100, Math.round((val / 255) * 100)));
            newHeights.push(percentage);
          }
          setAudioWaveformHeights(newHeights);
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
      setAudioFeedbackNotice('Listening in real time... Speak into your microphone (e.g. name, phone, PAN, address)');
    } catch (err) {
      console.error('Microphone access denied:', err);
      setIsRecording(false);
      setAudioFeedbackNotice(`Microphone access error: ${err.message || 'Permission denied'}. You can also type speech input below.`);
    }
  };

  const stopMicrophoneCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
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
    if (isRecording) {
      stopMicrophoneCapture();
    } else {
      startMicrophoneCapture();
    }
  };

  const handleAudioCaptured = async (audioBlob) => {
    setIsProcessingAudio(true);
    setAudioFeedbackNotice('Transcribing audio stream with EchoTrust STT engine...');

    try {
      const targetId = isCorrecting && correctionTarget ? correctionTarget.id : null;
      const res = await transcribeAudioBlob(audioBlob, currentSessionId, targetId);
      
      if (res && res.transcript) {
        const transcript = res.transcript;
        const conf = res.confidence || 92;
        setSttEngineStatus(res.stt_engine || 'EchoTrust-BFSI-v4.2');

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
          applyExtractedEntities(res.extracted_entities, transcript, conf);
        } else {
          const extractRes = await extractEntitiesFromText(transcript, currentSessionId, conf, targetId);
          if (extractRes && extractRes.entities && extractRes.entities.length > 0) {
            applyExtractedEntities(extractRes.entities, transcript, conf);
          } else {
            setAudioFeedbackNotice(`Transcribed: "${transcript.slice(0, 50)}..."`);
          }
        }
      }
    } catch (err) {
      console.error('Audio processing error:', err);
      setAudioFeedbackNotice('Speech-to-Text completed. You can verify the prompt in the dialogue.');
    } finally {
      setIsProcessingAudio(false);
    }
  };

  const applyExtractedEntities = (extractedList, rawTranscript, acousticConf) => {
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
          targetEntity = updated[idx];
          setActiveEntityIndex(idx);
        }
      });
      return updated;
    });

    if (targetEntity) {
      const phonetics = getPhoneticSpelling(targetEntity.value);
      const spelledOut = phonetics.map(p => `${p.char} as in ${p.code}`).join(', ');
      const aiPromptText = `I captured your ${targetEntity.label} as "${targetEntity.value}". Let me confirm the spelling: ${spelledOut}. Is this correct?`;

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
    setAudioFeedbackNotice('Parsing customer voice input with BFSI AI Entity Extractor...');

    try {
      const targetId = isCorrecting && correctionTarget ? correctionTarget.id : null;
      const res = await extractEntitiesFromText(inputText, currentSessionId, 92.0, targetId);
      if (res && res.entities && res.entities.length > 0) {
        applyExtractedEntities(res.entities, inputText, 92.0);
      } else {
        setDialogue(prev => [
          ...prev,
          {
            id: Date.now() + 1,
            sender: 'ai',
            text: `Captured: "${inputText}". Let me verify that against your application records.`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      console.error('Extraction error:', err);
    } finally {
      setIsProcessingAudio(false);
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

  const currentFocusedEntity = entities[activeEntityIndex] || entities[0];

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
    <div className="min-h-screen bg-[#F0F4F8] text-slate-800 flex font-sans antialiased">
      {/* =========================================================
          SECTION 1: FIXED DARK NAVY-BLUE SIDEBAR ON THE LEFT
         ========================================================= */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0A192F] text-white flex flex-col justify-between border-r border-slate-800 shadow-xl transition-transform duration-300 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div>
          {/* EchoTrust Logo and Branding */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setActiveTab('analytics'); setMobileMenuOpen(false); }}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25 ring-1 ring-white/10">
                <EchoTrustLogo className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-lg tracking-tight text-white">EchoTrust</span>
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/25 text-blue-300 border border-blue-400/30">
                    AI Voice
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">Every Voice. Verified with Trust.</p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg"
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
                        ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/30'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="flex items-center space-x-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>{item.badge}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* System Online Status Indicator at Bottom */}
        <div className="p-4 border-t border-slate-800/80 bg-[#071324]/80">
          <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-slate-800/70 border border-slate-700/80">
            <div className="relative flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
              <span className="absolute w-3 h-3 rounded-full bg-emerald-400 animate-ping opacity-75"></span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white">System Online</span>
                <span className="text-[10px] text-emerald-400 font-semibold">99.8%</span>
              </div>
              <p className="text-[10px] text-slate-400 truncate mt-0.5">{sttEngineStatus} Active</p>
            </div>
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

            {/* Right Controls: Date Filter Dropdown, Notification Icon, User Profile */}
            <div className="flex items-center space-x-3 sm:space-x-4 shrink-0">
              {/* Date Filter Dropdown */}
              <div className="relative">
                <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl transition shadow-2xs cursor-pointer">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
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
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition border border-slate-200 shadow-2xs"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white"></span>
              </button>

              {/* User Profile */}
              <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-blue-500/20 shadow-xs">
                  AK
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold text-slate-900 leading-tight">Ananya Kapoor</div>
                  <div className="text-[10px] text-slate-400 font-medium">Senior Verification Officer</div>
                </div>
              </div>
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
                  window.speechSynthesis.cancel();
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
                {/* Card 1: First Attempt Confirmation (Blue Theme) */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition-all border-l-4 border-l-blue-600 relative overflow-hidden group">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">First Attempt Confirmation</p>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition-transform">
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
                        <span className="w-3 h-3 rounded-md bg-[#3B82F6] mr-1.5 shadow-2xs"></span>
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
                        <Bar dataKey="autoConfirmed" fill="#3B82F6" name="First-Pass Confirmed" radius={[5, 5, 0, 0]} />
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
                  <div className="bg-blue-50/40 rounded-xl p-4 border border-blue-100 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        <span className="text-xs font-bold text-slate-900">First Attempt Success</span>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        +2.3%
                      </span>
                    </div>
                    <div className="mt-3">
                      <div className="text-2xl font-extrabold text-blue-900">89.4%</div>
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
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-semibold text-xs shadow-sm transition"
                >
                  <Mic className="w-4 h-4" />
                  <span>Open Live Session</span>
                </button>
              </div>

              {/* Statistics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                  { title: 'Total Sessions', value: dashboardStats ? dashboardStats.total_sessions.toLocaleString() : '14,892', change: '+12.4%', isUp: true, desc: 'Past 30 days', color: 'border-l-blue-500' },
                  { title: 'Successfully Verified', value: dashboardStats ? dashboardStats.verified_sessions.toLocaleString() : '13,954', change: '+8.1%', isUp: true, desc: '93.7% First-pass', color: 'border-l-emerald-500' },
                  { title: 'Pending Confirmation', value: dashboardStats ? dashboardStats.pending_sessions.toLocaleString() : '342', change: '-4.2%', isUp: false, desc: 'Awaiting customer OK', color: 'border-l-amber-500' },
                  { title: 'Correction Loop Run', value: dashboardStats ? dashboardStats.corrections_run.toLocaleString() : '596', change: '-18.5%', isUp: true, desc: 'Errors caught & fixed', color: 'border-l-indigo-500' },
                  { title: 'Overall Accuracy Rate', value: dashboardStats ? `${dashboardStats.accuracy_rate}%` : '98.6%', change: '+0.8%', isUp: true, desc: 'Post read-back confirm', color: 'border-l-purple-500' },
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
                  <button onClick={() => setActiveTab('history')} className="text-blue-600 hover:text-blue-800 text-xs font-semibold flex items-center">
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
                        <tr key={sess.id} className="hover:bg-blue-50/40 transition">
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
                              sess.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${sess.status === 'Verified' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                              {sess.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => inspectSession(sess)} className="text-blue-600 hover:text-blue-800 font-semibold hover:underline inline-flex items-center">
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
                  <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg shadow-xs border border-blue-200">
                    {customerName ? customerName.split(' ').map(n => n[0]).join('').slice(0, 2) : 'RS'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-lg font-bold text-slate-900">{customerName}</h2>
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md text-xs font-semibold">
                        Account Opening KYC
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 text-xs text-slate-500 mt-0.5">
                      <span>Customer ID: <strong className="text-slate-700 font-mono">{customerId}</strong></span>
                      <span>App No: <strong className="text-slate-700 font-mono">{appNo}</strong></span>
                      <span>Session: <strong className="text-slate-700 font-mono">{currentSessionId}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Call Controls */}
                <div className="flex items-center space-x-3 w-full md:w-auto justify-end">
                  <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                    <span className={`w-2.5 h-2.5 rounded-full ${isRecording ? 'bg-rose-500 animate-ping' : 'bg-slate-400'}`}></span>
                    <span className="text-xs font-mono font-bold text-slate-800">{formatDuration(callDuration)}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">
                      {isRecording ? 'Live Streaming' : 'Live Call'}
                    </span>
                  </div>

                  <button
                    onClick={handleToggleRecording}
                    disabled={isProcessingAudio}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold text-xs sm:text-sm shadow-sm transition ${
                      isRecording
                        ? 'bg-rose-600 hover:bg-rose-700 text-white'
                        : isProcessingAudio
                        ? 'bg-indigo-600 text-white cursor-wait'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    }`}
                  >
                    {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    <span>{isRecording ? 'Stop & Process Voice' : isProcessingAudio ? 'Processing Audio...' : 'Start Voice Capture'}</span>
                  </button>
                </div>
              </div>

              {/* Main Interactive Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Voice Interaction & Dialogue Panel (7 Cols) */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Waveform Card */}
                  <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
                    <div className="p-4 bg-[#0F172A] text-white flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                          <Radio className="w-4 h-4 animate-pulse" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-white">Live Voice Entity Capture & Synthesizer</h3>
                          <p className="text-[11px] text-slate-400">Streaming bidirectional channel with acoustic phonetic filter</p>
                        </div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                        Noise Cancellation Active
                      </span>
                    </div>

                    {/* Real-time Dynamic Audio Waveform */}
                    <div className="bg-gradient-to-b from-[#0F172A] to-[#1E293B] px-6 py-4 flex items-center justify-center border-t border-slate-800">
                      <div className="flex items-center space-x-1.5 h-12 w-full max-w-md justify-center">
                        {audioWaveformHeights.map((h, i) => (
                          <div
                            key={i}
                            className={`w-1.5 rounded-full transition-all duration-150 ${
                              isRecording || isPlayingAudio
                                ? 'bg-gradient-to-t from-blue-500 to-indigo-300'
                                : 'bg-slate-700'
                            }`}
                            style={{ height: isRecording || isPlayingAudio ? `${h}%` : '20%' }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Conversation Stream */}
                    <div className="p-4 bg-slate-50 border-t border-slate-200 flex-1 max-h-[380px] overflow-y-auto space-y-3">
                      <div className="text-center">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                          Session Initiated – 10:40 AM
                        </span>
                      </div>

                      {dialogue.map((msg) => (
                        <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                          <div className="flex items-center space-x-1.5 mb-1 px-1">
                            <span className="text-[10px] font-bold text-slate-500 capitalize">
                              {msg.sender === 'ai' ? '🤖 EchoTrust AI' : `👤 Customer (${customerName.split(' ')[0]})`}
                            </span>
                            <span className="text-[9px] text-slate-400">{msg.time}</span>
                          </div>
                          <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-xs leading-relaxed ${
                            msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-xs' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs'
                          }`}>
                            <p>{msg.text}</p>
                            {msg.phonetic && (
                              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                                <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                                  Phonetic Read-Back Enabled
                                </span>
                                <button onClick={() => speakReadBack(msg.text)} className="text-[10px] font-semibold text-slate-600 hover:text-blue-600 flex items-center space-x-1">
                                  <Volume2 className="w-3 h-3" />
                                  <span>Re-hear</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Quick Simulated Input */}
                    <div className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Simulate customer speech input (e.g. My name is Rahul Sharma or PAN ABCDE1234F)..."
                        className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 focus:ring-1 focus:ring-blue-500 outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && e.target.value.trim()) {
                            handleSimulatedSpeechInput(e.target.value);
                            e.target.value = '';
                          }
                        }}
                      />
                      <button
                        onClick={() => {
                          const ent = currentFocusedEntity;
                          const phonetics = getPhoneticSpelling(ent.value).map(p => `${p.char} as in ${p.code}`).join(', ');
                          speakReadBack(`Please confirm your captured ${ent.label}: ${ent.value}. Phonetic confirmation: ${phonetics}. Is this accurate?`);
                        }}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center space-x-1"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                        <span>Speak AI Prompt</span>
                      </button>
                    </div>
                  </div>

                  {/* Phonetic Disambiguation Engine Panel */}
                  <div className="bg-gradient-to-br from-blue-900 to-[#0A192F] text-white rounded-2xl p-5 shadow-lg relative overflow-hidden">
                    <div className="flex items-center justify-between mb-3 relative z-10">
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                        <h3 className="font-bold text-sm tracking-wide uppercase text-blue-200">
                          Phonetic Disambiguation Engine
                        </h3>
                      </div>
                      <span className="text-xs bg-blue-500/30 text-blue-200 px-2.5 py-0.5 rounded-full border border-blue-400/30">
                        Active Target: {currentFocusedEntity.label}
                      </span>
                    </div>

                    {/* NATO Decomposed Chips */}
                    <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 relative z-10 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-blue-200">Captured Value:</span>
                        <span className="font-mono text-sm font-bold text-white tracking-wider bg-black/30 px-2.5 py-0.5 rounded">
                          {currentFocusedEntity.value}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                        {getPhoneticSpelling(currentFocusedEntity.value).map((item, idx) => (
                          <div key={idx} className="flex items-center space-x-1 bg-white/20 px-2 py-1 rounded-md text-xs border border-white/20">
                            <span className="font-bold text-amber-300 font-mono">{item.char}</span>
                            <span className="text-slate-300 text-[10px]">→</span>
                            <span className="text-white font-medium">{item.code}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="bg-blue-950/70 rounded-xl p-4 border border-blue-800/80 relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold text-white">"Did we capture your information correctly?"</div>
                        <div className="text-[11px] text-blue-300">Awaiting customer vocal confirmation or agent override</div>
                      </div>
                      <div className="flex items-center space-x-2 w-full sm:w-auto">
                        <button
                          onClick={() => {
                            speakReadBack(`Spelling confirmation for ${currentFocusedEntity.label}: ${getPhoneticSpelling(currentFocusedEntity.value).map(p => `${p.char} as in ${p.code}`).join('. ')}. Is this correct?`);
                          }}
                          className="px-3 py-2 bg-blue-700 hover:bg-blue-600 text-white rounded-xl text-xs font-semibold flex items-center space-x-1 transition"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play Audio</span>
                        </button>
                        <button
                          onClick={() => handleConfirmEntity(currentFocusedEntity.id)}
                          className="flex-1 sm:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-emerald-900/30 transition"
                        >
                          <Check className="w-4 h-4" />
                          <span>Yes, Confirm</span>
                        </button>
                        <button
                          onClick={() => initiateCorrection(currentFocusedEntity)}
                          className="flex-1 sm:flex-none px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md shadow-rose-900/30 transition"
                        >
                          <X className="w-4 h-4" />
                          <span>No, Correct It</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Captured Entity Cards & Confidence (5 Cols) */}
                <div className="lg:col-span-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-slate-800 text-sm tracking-tight flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-blue-600" />
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

                    return (
                      <div
                        key={entity.id}
                        onClick={() => setActiveEntityIndex(idx)}
                        className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer shadow-xs relative ${
                          isSelected
                            ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-2.5">
                            <div className={`p-2 rounded-xl ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">{entity.label}</div>
                              <div className="font-mono text-sm font-semibold text-slate-800 tracking-tight mt-0.5">
                                {entity.value}
                              </div>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${confStyle.bg}`}>
                            {entity.confidence}% Conf.
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${confStyle.bar}`} style={{ width: `${entity.confidence}%` }} />
                          </div>
                        </div>

                        {/* Phonetics Preview */}
                        <div className="mt-2 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                          <span className="truncate pr-2"><strong>Phonetics:</strong> {entity.phoneticSummary}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              speakReadBack(`Entity ${entity.label}: ${entity.value}`);
                            }}
                            className="text-blue-600 hover:text-blue-800 p-1"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Action buttons */}
                        <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              initiateCorrection(entity);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                          >
                            Manual Edit
                          </button>
                          {entity.status !== 'verified' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmEntity(entity.id);
                              }}
                              className="px-3 py-1 text-[11px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition shadow-xs flex items-center space-x-1"
                            >
                              <Check className="w-3 h-3" />
                              <span>Confirm Match</span>
                            </button>
                          )}
                        </div>
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
                  Showing 6 Extracted Entities for <strong>{currentSessionId}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {entities.map((entity) => {
                  const Icon = entity.icon || ENTITY_ICONS[entity.id] || User;
                  const conf = getConfidenceBadge(entity.confidence);
                  const phonetics = getPhoneticSpelling(entity.value);

                  return (
                    <div key={entity.id} className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
                              <Icon className="w-5 h-5" />
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{entity.type}</span>
                              <h3 className="font-bold text-slate-900 text-sm">{entity.label}</h3>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${conf.bg}`}>
                            {entity.confidence}%
                          </span>
                        </div>

                        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                          <div className="text-[10px] text-slate-400 font-semibold uppercase">Extracted Text</div>
                          <div className="font-mono font-bold text-slate-800 text-base mt-0.5">{entity.value}</div>
                        </div>

                        <div className="mt-3">
                          <div className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                            <span>NATO Breakdown:</span>
                            <button
                              onClick={() => speakReadBack(`${entity.label}: ${phonetics.map(p => p.code).join(' ')}`)}
                              className="text-[11px] text-blue-600 hover:underline flex items-center space-x-0.5"
                            >
                              <Volume2 className="w-3 h-3" />
                              <span>Audio</span>
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                            {phonetics.slice(0, 8).map((p, i) => (
                              <span key={i} className="text-[11px] px-1.5 py-0.5 bg-slate-100 rounded text-slate-700 font-mono">
                                <strong>{p.char}</strong>:{p.code}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-[11px] text-slate-400">Status: <strong className="text-slate-700 capitalize">{entity.status}</strong></div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => initiateCorrection(entity)} className="px-2.5 py-1 text-xs font-semibold text-slate-600 hover:text-slate-900 border rounded-lg">Correct</button>
                          <button onClick={() => handleConfirmEntity(entity.id)} className="px-3 py-1 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Confirm</button>
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
                  className="px-3.5 py-2 text-xs font-semibold bg-white border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 flex items-center space-x-1.5 shadow-2xs"
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
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
                    className="w-full border rounded-xl p-2 bg-slate-50 border-slate-200 focus:bg-white focus:ring-1 focus:ring-blue-500 outline-none"
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
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="p-3.5 font-mono font-bold text-blue-600">{item.id}</td>
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
                            item.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-500 whitespace-nowrap">{item.time}</td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => inspectSession(item)}
                            className="text-blue-600 hover:text-blue-800 font-semibold p-1 hover:bg-blue-50 rounded"
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
                    <Sliders className="w-4 h-4 text-blue-600" />
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
                          className="w-16 p-1.5 text-xs border rounded-lg bg-white font-bold"
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
                          className="w-16 p-1.5 text-xs border rounded-lg bg-white font-bold"
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
                          className="w-16 p-1.5 text-xs border rounded-lg bg-white font-bold"
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
                    <Radio className="w-4 h-4 text-indigo-600" />
                    <span>Read-Back Phonetic Standardization</span>
                  </h3>
                  <div className="space-y-2">
                    <label onClick={() => setPhoneticStandard('nato')} className="flex items-center space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input type="radio" name="phoneticStd" checked={phoneticStandard === 'nato'} onChange={() => setPhoneticStandard('nato')} className="text-blue-600" />
                      <div>
                        <div className="text-xs font-bold text-slate-800">ICAO / NATO Phonetic Standard (Recommended)</div>
                        <div className="text-[11px] text-slate-500">Alpha, Bravo, Charlie, Delta, Romeo, Uniform... Global BFSI benchmark</div>
                      </div>
                    </label>
                    <label onClick={() => setPhoneticStandard('indian')} className="flex items-center space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input type="radio" name="phoneticStd" checked={phoneticStandard === 'indian'} onChange={() => setPhoneticStandard('indian')} className="text-blue-600" />
                      <div>
                        <div className="text-xs font-bold text-slate-800">Indian Banking Colloquial Standard</div>
                        <div className="text-[11px] text-slate-500">A for Apple, B for Bombay, C for Chennai, D for Delhi...</div>
                      </div>
                    </label>
                    <label onClick={() => setPhoneticStandard('numeric')} className="flex items-center space-x-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                      <input type="radio" name="phoneticStd" checked={phoneticStandard === 'numeric'} onChange={() => setPhoneticStandard('numeric')} className="text-blue-600" />
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
                    className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Reset Defaults
                  </button>
                  <button
                    onClick={() => {
                      setAudioFeedbackNotice('Configuration successfully saved to active verification cluster.');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm"
                  >
                    Save Configuration
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* EchoTrust Enterprise Footer */}
        <footer className="mt-auto border-t border-slate-200/80 bg-white/80 backdrop-blur-sm py-4 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-800">EchoTrust™</span>
              <span className="text-slate-300">•</span>
              <span className="font-medium text-slate-600">Every Voice. Verified with Trust.</span>
            </div>
            <div className="flex items-center space-x-4 text-[11px]">
              <span className="text-slate-400">Enterprise BFSI Voice Platform</span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center space-x-1.5 text-emerald-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active Trust Protection</span>
              </span>
            </div>
          </div>
        </footer>
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
                className="text-slate-400 hover:text-slate-600 p-1"
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
                  className="mt-1 w-full border border-slate-300 rounded-xl p-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              {/* Dynamic Live Phonetic Preview */}
              {correctionInput && (
                <div className="bg-blue-50/70 p-3 rounded-xl border border-blue-100">
                  <div className="text-[11px] font-semibold text-blue-900 mb-1">
                    Live Phonetic Read-Back Preview:
                  </div>
                  <div className="flex flex-wrap gap-1 text-[11px] text-blue-800 font-mono">
                    {getPhoneticSpelling(correctionInput).map((item, idx) => (
                      <span key={idx} className="bg-white px-1.5 py-0.5 rounded-md shadow-2xs border border-blue-200">
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
                className="px-4 py-2 border rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitCorrection}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 flex items-center space-x-1.5"
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
