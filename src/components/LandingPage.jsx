import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  Volume2, 
  CheckCircle2, 
  AlertTriangle, 
  Sparkles, 
  ArrowRight, 
  Mic, 
  Lock, 
  Database, 
  FileCheck, 
  Activity, 
  Layers, 
  Headphones, 
  ChevronRight, 
  Play,
  RotateCcw,
  Check,
  ChevronDown,
  Zap,
  Radio,
  Cpu
} from 'lucide-react';

// Modern EchoTrust Brand Logo with Emerald & Mint Styling
export function EchoTrustLogo({ className = "w-8 h-8" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="landingEmeraldGrad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#10B981" />
          <stop offset="0.5" stopColor="#059669" />
          <stop offset="1" stopColor="#047857" />
        </linearGradient>
      </defs>
      {/* Outer Protective Trust Shield */}
      <path 
        d="M12 2.5L4 6.2V11.5C4 16.8 7.4 21.2 12 22.5C16.6 21.2 20 16.8 20 11.5V6.2L12 2.5Z" 
        stroke="url(#landingEmeraldGrad)" 
        strokeWidth="1.75" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        fill="url(#landingEmeraldGrad)" 
        fillOpacity="0.18" 
      />
      {/* Resonant Acoustic Waveform Bars */}
      <rect x="7" y="10.5" width="1.5" height="3" rx="0.75" fill="#34D399" />
      <rect x="9.5" y="8" width="1.5" height="8" rx="0.75" fill="#10B981" />
      <rect x="12" y="6" width="1.5" height="12" rx="0.75" fill="#059669" />
      <rect x="14.5" y="8" width="1.5" height="8" rx="0.75" fill="#10B981" />
      <rect x="17" y="10.5" width="1.5" height="3" rx="0.75" fill="#34D399" />
    </svg>
  );
}

// Interactive Animated Soundwave Canvas Component
function LivingWaveformCanvas({ isPlaying }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let step = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      step += isPlaying ? 0.08 : 0.035;

      // Draw multi-layered glowing sine waves
      const waves = [
        { amplitude: isPlaying ? 28 : 16, frequency: 0.022, speed: 1.2, color: 'rgba(52, 211, 153, 0.85)', lineWidth: 2 },
        { amplitude: isPlaying ? 22 : 12, frequency: 0.035, speed: 0.8, color: 'rgba(16, 185, 129, 0.95)', lineWidth: 2.5 },
        { amplitude: isPlaying ? 14 : 8, frequency: 0.015, speed: 1.5, color: 'rgba(110, 231, 183, 0.65)', lineWidth: 1.5 },
      ];

      waves.forEach(wave => {
        ctx.beginPath();
        ctx.lineWidth = wave.lineWidth;
        ctx.strokeStyle = wave.color;

        for (let x = 0; x < width; x++) {
          const y = centerY + Math.sin(x * wave.frequency + step * wave.speed) * wave.amplitude * Math.sin(x / width * Math.PI);
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      });

      // Render floating sound energy particles
      for (let i = 0; i < 6; i++) {
        const px = (width / 7) * (i + 1) + Math.sin(step + i) * 12;
        const py = centerY + Math.sin(px * 0.03 + step) * 20;
        ctx.fillStyle = i % 2 === 0 ? '#34D399' : '#10B981';
        ctx.shadowColor = '#10B981';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={85} 
      className="w-full h-20 rounded-xl bg-[#061810] border border-emerald-500/30 shadow-inner"
    />
  );
}

// Scenarios for the Hero Live Simulation
const SIMULATION_SCENARIOS = [
  {
    type: 'Customer Voice (generated-audio.wav)',
    value: 'generated-audio.wav',
    code: 'Hamare podcast ke ek aur zabardast episode mein aapka bahut bahut swagata hai...',
    speech: 'Hamare podcast ke ek aur zabardast episode mein aapka bahut bahut swagata hai. chahe aap subah-subah kaam par jaate hue sun rahe ho ya din bhar ki bhag-dhor ke baad relax kar rahe ho. Accha laga ki aap hamare saath jude hain. Aaj hum jaenge ki aakhir artificial intelligence hamari health, education aur daily life ko kaise badal raha hai?',
    confidence: '94.5%',
    tag: 'Gnani Prisma v3.0 Verified'
  },
  {
    type: 'Full Legal Name',
    value: 'Rahul Sharma',
    code: 'R-Romeo, A-Alpha, H-Hotel, U-Uniform, L-Lima  •  S-Sierra, H-Hotel, A-Alpha, R-Romeo, M-Mike, A-Alpha',
    speech: 'I heard your full name as Rahul Sharma. In phonetic spelling: Romeo, Alpha, Hotel, Uniform, Lima. Space. Sierra, Hotel, Alpha, Romeo, Mike, Alpha. Is that correct?',
    confidence: '99.4%',
    tag: 'KYC Verified'
  },
  {
    type: 'Indian Mobile No.',
    value: '+91 98765 43210',
    code: '9-Nine, 8-Eight, 7-Seven, 6-Six, 5-Five  •  4-Four, 3-Three, 2-Two, 1-One, 0-Zero',
    speech: 'I heard your mobile number as 9 8 7 6 5 4 3 2 1 0. Is this phone number correct?',
    confidence: '98.8%',
    tag: 'Telecom Verified'
  },
  {
    type: 'National Tax PAN',
    value: 'ABCDE1234F',
    code: 'A-Alpha, B-Bravo, C-Charlie, D-Delta, E-Echo  •  1-One, 2-Two, 3-Three, 4-Four, F-Foxtrot',
    speech: 'Your PAN card was captured as Alpha, Bravo, Charlie, Delta, Echo, One, Two, Three, Four, Foxtrot. Do you confirm?',
    confidence: '99.2%',
    tag: 'Income Tax Matched'
  }
];

export default function LandingPage({ onNavigate, user, onLogout }) {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [isPlayingDemo, setIsPlayingDemo] = useState(false);
  const audioDemoRef = useRef(null);

  const currentScenario = SIMULATION_SCENARIOS[scenarioIndex];

  // Auto-cycle scenarios every 8 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setScenarioIndex(prev => (prev + 1) % SIMULATION_SCENARIOS.length);
    }, 8000);
    return () => clearInterval(timer);
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handlePlayVoiceDemo = () => {
    // If audio is already playing, toggle pause
    if (audioDemoRef.current && isPlayingDemo) {
      audioDemoRef.current.pause();
      audioDemoRef.current.currentTime = 0;
      setIsPlayingDemo(false);
      return;
    }

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      const audio = new Audio('/generated-audio.wav');
      audioDemoRef.current = audio;
      setIsPlayingDemo(true);

      audio.onplay = () => setIsPlayingDemo(true);
      audio.onended = () => setIsPlayingDemo(false);
      audio.onerror = () => {
        setIsPlayingDemo(false);
      };

      audio.play().catch(e => {
        setIsPlayingDemo(false);
      });
    } catch (err) {
      setIsPlayingDemo(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 font-sans selection:bg-emerald-500 selection:text-white relative overflow-x-hidden bg-grid-emerald">
      
      {/* Soft Pastel Ambient Glow Orbs in Light Theme */}
      <div className="absolute top-0 left-1/4 w-[650px] h-[650px] bg-emerald-400/10 rounded-full blur-[150px] pointer-events-none -z-10 animate-pulse-slow" />
      <div className="absolute top-1/3 right-10 w-[550px] h-[550px] bg-teal-300/12 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse-slow" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-1/4 left-10 w-[600px] h-[600px] bg-green-400/10 rounded-full blur-[160px] pointer-events-none -z-10 animate-pulse-slow" style={{ animationDelay: '4s' }} />

      {/* =========================================================
          A. NAVIGATION BAR (Clean Crisp Light Styling)
         ========================================================= */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/80 transition-all shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          
          {/* Logo & Brand Identity */}
          <div 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center space-x-3 cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-600 to-green-600 flex items-center justify-center shadow-md shadow-emerald-500/20 ring-1 ring-emerald-500/20 group-hover:scale-105 transition-transform">
              <EchoTrustLogo className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black tracking-tight text-slate-900">EchoTrust</span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300/60 shadow-2xs">
                  BFSI AI
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 font-semibold">Every Voice. Every Detail. Verified.</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-600">
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="hover:text-emerald-600 transition-colors cursor-pointer">Home</button>
            <button onClick={() => scrollToSection('features')} className="hover:text-emerald-600 transition-colors cursor-pointer">Features</button>
            <button onClick={() => scrollToSection('how-it-works')} className="hover:text-emerald-600 transition-colors cursor-pointer">How It Works</button>
            <button onClick={() => scrollToSection('problems')} className="hover:text-emerald-600 transition-colors cursor-pointer">Why EchoTrust</button>
            <button onClick={() => scrollToSection('benefits')} className="hover:text-emerald-600 transition-colors cursor-pointer">Benefits</button>
          </nav>

          {/* Auth Action Buttons */}
          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => onNavigate('dashboard')}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/25 flex items-center space-x-1.5 transition-all cursor-pointer"
                >
                  <span>Open Dashboard</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onLogout}
                  className="px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onNavigate('login')}
                  className="px-4 py-2.5 text-xs font-semibold rounded-xl text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/80 transition cursor-pointer"
                >
                  Sign In
                </button>
                <button
                  onClick={() => onNavigate('register')}
                  className="px-5 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white shadow-md shadow-emerald-600/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* =========================================================
          B. HERO SECTION (Light Theme + Living Waveform + Floating Card)
         ========================================================= */}
      <section className="relative pt-14 pb-20 md:pt-20 md:pb-28 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-7 text-center lg:text-left">
            
            {/* Pill Badge */}
            <div className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span>Next-Gen BFSI Voice Verification & Accuracy AI</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.12] text-slate-900">
              Trust Every Word. <br />
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 bg-clip-text text-transparent">
                Verify Every Voice.
              </span>
            </h1>

            {/* Description */}
            <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed font-normal">
              EchoTrust makes voice-based banking and insurance interactions reliable with intelligent speech verification, acoustic entity extraction, and real-time NATO phonetic read-back confirmation.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <button
                onClick={() => onNavigate('register')}
                className="w-full sm:w-auto px-7 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/25 flex items-center justify-center space-x-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <span>Get Started with EchoTrust</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <button
                onClick={() => scrollToSection('features')}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold text-sm transition-all flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
              >
                <span>Explore Features</span>
                <ChevronDown className="w-4 h-4 text-emerald-600" />
              </button>
            </div>

            {/* Trust Proof Badges */}
            <div className="pt-6 border-t border-slate-200/80 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs text-slate-600 font-semibold">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>99.8% Phonetic Precision</span>
              </div>
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-teal-600" />
                <span>BFSI KYC & AML Compliant</span>
              </div>
              <div className="flex items-center space-x-2">
                <Volume2 className="w-4 h-4 text-emerald-600" />
                <span>ICAO/NATO Disambiguation</span>
              </div>
            </div>
          </div>

          {/* Right Hero: High-Contrast Crisp White Floating Live Acoustic Card */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md rounded-3xl bg-white/95 p-6 border border-emerald-200/70 shadow-2xl shadow-emerald-950/10 backdrop-blur-xl animate-float">
              
              {/* Header with Live Status & Mode */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center space-x-2.5">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">Acoustic Live Stream</span>
                </div>
                
                {/* Auto-cycling scenario tab pills */}
                <div className="flex space-x-1.5">
                  {SIMULATION_SCENARIOS.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setScenarioIndex(i)}
                      className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                        i === scenarioIndex ? 'bg-emerald-600 scale-125' : 'bg-slate-200 hover:bg-slate-300'
                      }`}
                      title={`Scenario ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              {/* LIVING ACOUSTIC CANVAS WAVEFORM (High-Tech Contrast Box) */}
              <div className="my-5 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="flex items-center space-x-1.5 text-emerald-700 font-bold">
                    <Mic className="w-3.5 h-3.5 animate-pulse text-emerald-600" />
                    <span>Real-Time Frequency Waveform</span>
                  </span>
                  <span className="text-emerald-700 font-mono text-[11px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                    16 kHz Mono
                  </span>
                </div>

                {/* Animated Canvas */}
                <LivingWaveformCanvas isPlaying={isPlayingDemo} />
              </div>

              {/* Captured Entity Details Box */}
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 flex items-center justify-between transition-all">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      {currentScenario.type}
                    </div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5 font-mono">
                      {currentScenario.value}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-md border border-emerald-200 shadow-2xs">
                      {currentScenario.confidence}
                    </span>
                    <div className="text-[9px] text-emerald-700 mt-0.5 font-bold">
                      {currentScenario.tag}
                    </div>
                  </div>
                </div>

                {/* ICAO / NATO Disambiguation Prompt Box with Sound Trigger */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center justify-between text-slate-800 font-bold mb-1.5">
                    <span className="flex items-center space-x-1.5 text-emerald-800">
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>ICAO / NATO Read-Back</span>
                    </span>
                    <button 
                      onClick={handlePlayVoiceDemo}
                      className="text-[11px] font-bold flex items-center space-x-1 bg-white hover:bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-2xs transition cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current text-emerald-600" />
                      <span>{isPlayingDemo ? 'Speaking...' : 'Hear Read-Back'}</span>
                    </button>
                  </div>
                  <p className="text-slate-600 font-mono text-[11px] leading-relaxed break-words">
                    "{currentScenario.code}"
                  </p>
                </div>
              </div>

              {/* Action Button to launch dashboard */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <button
                  onClick={() => onNavigate(user ? 'dashboard' : 'login')}
                  className="w-full py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold transition flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
                >
                  <span>{user ? 'Enter Active Dashboard' : 'Sign in to Test Live System'}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-emerald-700" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================
          C. PROBLEM SECTION (Clean Slate-100 Light Background)
         ========================================================= */}
      <section id="problems" className="py-20 bg-slate-100/70 border-y border-slate-200/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs uppercase font-extrabold tracking-widest text-emerald-700">The Problem</h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Acoustic Errors Cripple Critical Voice Interactions
            </p>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              Standard Speech-to-Text engines miss acoustic nuances, creating costly errors in banking, insurance, and compliance-driven voice transactions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-5 mt-14">
            
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-rose-300 shadow-sm hover:shadow-md transition group">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 mb-4 group-hover:scale-110 transition border border-rose-100">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Acoustic Confusion</h3>
              <p className="text-slate-600 text-xs mt-2 leading-relaxed">
                Letters like B vs D vs P or digits 0 vs 5 sound identical over phone codecs, resulting in misspelled legal names.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-amber-300 shadow-sm hover:shadow-md transition group">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-4 group-hover:scale-110 transition border border-amber-100">
                <Headphones className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Transposed Numbers</h3>
              <p className="text-slate-600 text-xs mt-2 leading-relaxed">
                Bank account numbers and 10-digit Indian mobile lines get reversed, triggering rejected transactions and customer anger.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-emerald-300 shadow-sm hover:shadow-md transition group">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4 group-hover:scale-110 transition border border-emerald-100">
                <Database className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Invalid PIN Codes</h3>
              <p className="text-slate-600 text-xs mt-2 leading-relaxed">
                Addresses with hallucinated 6-digit postal PINs cause delivery failures and non-compliant KYC documentation.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-teal-300 shadow-sm hover:shadow-md transition group">
              <div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 mb-4 group-hover:scale-110 transition border border-teal-100">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Uncertain ASR Scores</h3>
              <p className="text-slate-600 text-xs mt-2 leading-relaxed">
                Most platforms blindly accept weak transcripts without confidence tiers, exposing operations to fraud.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 hover:border-rose-300 shadow-sm hover:shadow-md transition group">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 mb-4 group-hover:scale-110 transition border border-rose-100">
                <Shield className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">KYC Regulatory Fines</h3>
              <p className="text-slate-600 text-xs mt-2 leading-relaxed">
                Inaccurate PAN cards and mismatched dates of birth violate central bank KYC regulations, triggering severe audits.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================
          D. FEATURES SECTION (Clean White Feature Cards)
         ========================================================= */}
      <section id="features" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <h2 className="text-xs uppercase font-extrabold tracking-widest text-emerald-700">Core Capabilities</h2>
          <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Engineered for Precision Voice Verification
          </p>
          <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
            Six advanced pillars working together to ensure flawless conversational accuracy in financial and insurance operations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-16">
          
          {/* Feature 1 */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200 hover:border-emerald-400 transition-all hover:shadow-xl hover:shadow-emerald-600/10 group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-6 shadow-2xs group-hover:scale-110 transition">
              <Mic className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">1. Intelligent Voice Verification</h3>
            <p className="text-slate-600 text-sm mt-3 leading-relaxed">
              Native integration with high-performance Gnani and Prisma ASR engines calibrated for Indian accents, regional dialects, and noisy call center environments.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200 hover:border-emerald-400 transition-all hover:shadow-xl hover:shadow-emerald-600/10 group">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mb-6 shadow-2xs group-hover:scale-110 transition">
              <FileCheck className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">2. Entity Extraction Engine</h3>
            <p className="text-slate-600 text-sm mt-3 leading-relaxed">
              Extracts and formats full names, Indian mobile numbers (6-9 prefix), residential addresses, postal PINs, PAN cards, and date of birth KYC compliance.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200 hover:border-emerald-400 transition-all hover:shadow-xl hover:shadow-emerald-600/10 group">
            <div className="w-12 h-12 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600 mb-6 shadow-2xs group-hover:scale-110 transition">
              <Volume2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">3. Read-Back Confirmation</h3>
            <p className="text-slate-600 text-sm mt-3 leading-relaxed">
              Automated Text-to-Speech synthesizes natural verbal confirmation prompts back to the customer, ensuring explicit affirmation before data commits.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200 hover:border-emerald-400 transition-all hover:shadow-xl hover:shadow-emerald-600/10 group">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-6 shadow-2xs group-hover:scale-110 transition">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">4. Phonetic Spelling Verification</h3>
            <p className="text-slate-600 text-sm mt-3 leading-relaxed">
              Converts ambiguous characters into ICAO / NATO standard radio alphabets (Alpha, Bravo, Charlie) to definitively prevent B/D/P/V acoustic confusion.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200 hover:border-emerald-400 transition-all hover:shadow-xl hover:shadow-emerald-600/10 group">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mb-6 shadow-2xs group-hover:scale-110 transition">
              <Activity className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">5. Tiered Confidence Scoring</h3>
            <p className="text-slate-600 text-sm mt-3 leading-relaxed">
              Intelligent multi-tier thresholds: Auto-Pass (&gt;90%), Mandatory Phonetic Read-Back (70-90%), and Auto-Reject/Human Review (&lt;60%).
            </p>
          </div>

          {/* Feature 6 */}
          <div className="p-7 rounded-3xl bg-white border border-slate-200 hover:border-emerald-400 transition-all hover:shadow-xl hover:shadow-emerald-600/10 group">
            <div className="w-12 h-12 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center text-green-600 mb-6 shadow-2xs group-hover:scale-110 transition">
              <RotateCcw className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">6. Real-Time Error Detection & ML</h3>
            <p className="text-slate-600 text-sm mt-3 leading-relaxed">
              Learns from human-in-the-loop corrections. Tracks Levenshtein distances and confusion matrices to proactively preempt acoustic mistakes.
            </p>
          </div>

        </div>

      </section>

      {/* =========================================================
          E. HOW IT WORKS
         ========================================================= */}
      <section id="how-it-works" className="py-24 bg-slate-100/70 border-t border-slate-200/80 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-xs uppercase font-extrabold tracking-widest text-emerald-700">Step-by-Step Flow</h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Three Steps to 100% Verified Accuracy
            </p>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              A seamless continuous verification loop bridging customer speech to hardened core banking records.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 relative">
            
            {/* Step 1 */}
            <div className="relative p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-black text-lg mb-6 shadow-2xs">
                01
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Capture</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                EchoTrust listens to real-time inbound IVR, agent voice streams, or WebRTC channels and extracts critical structured data using acoustic neural models.
              </p>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center space-x-2 text-xs text-emerald-700 font-bold">
                <Mic className="w-3.5 h-3.5" />
                <span>Streaming 16 kHz Audio Capture</span>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-black text-lg mb-6 shadow-2xs">
                02
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Verify</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                The platform runs deterministic BFSI validation rules across PAN regex, Indian PIN codes, and calculates acoustic confidence across every character.
              </p>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center space-x-2 text-xs text-teal-700 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Deterministic Format Rules</span>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative p-8 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 rounded-2xl bg-green-50 border border-green-200 text-green-700 flex items-center justify-center font-black text-lg mb-6 shadow-2xs">
                03
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">Confirm</h3>
              <p className="text-slate-600 text-sm leading-relaxed">
                EchoTrust generates a natural phonetic read-back. If the customer signals mismatch, an interactive correction loop re-captures and confirms the true value.
              </p>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center space-x-2 text-xs text-green-700 font-bold">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Interactive Disambiguation Loop</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* =========================================================
          F. BENEFITS SECTION (Light Aesthetic)
         ========================================================= */}
      <section id="benefits" className="py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <div className="lg:col-span-6 space-y-6">
            <h2 className="text-xs uppercase font-extrabold tracking-widest text-emerald-700">Enterprise Impact</h2>
            <p className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Tangible Benefits for Banking & Insurance
            </p>
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
              By replacing ambiguity with ICAO NATO read-back confirmation, EchoTrust transforms error-prone voice interactions into bulletproof operational records.
            </p>

            <div className="space-y-4 pt-4">
              <div className="flex items-start space-x-3.5">
                <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">99.8% Data Accuracy</h4>
                  <p className="text-xs text-slate-600 mt-1">Virtually eliminates customer onboarding and address re-work cycles.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3.5">
                <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Reduced Human Error in Contact Centers</h4>
                  <p className="text-xs text-slate-600 mt-1">Agents no longer guess difficult spellings or distorted mobile numbers.</p>
                </div>
              </div>

              <div className="flex items-start space-x-3.5">
                <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                  <Check className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Full Regulatory KYC & AML Compliance</h4>
                  <p className="text-xs text-slate-600 mt-1">Auditable timestamps and confirmation logs protect institutions from scrutiny.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="lg:col-span-6 grid grid-cols-2 gap-4">
            
            <div className="p-6 rounded-3xl bg-white border border-emerald-200/80 shadow-lg shadow-emerald-950/5 text-center space-y-2">
              <div className="text-4xl sm:text-5xl font-black text-emerald-600 tracking-tight">99.8%</div>
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">Verification Accuracy</div>
              <p className="text-[11px] text-slate-500">Over 500k+ customer audio sessions processed.</p>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-teal-200/80 shadow-lg shadow-emerald-950/5 text-center space-y-2">
              <div className="text-4xl sm:text-5xl font-black text-teal-600 tracking-tight">85%</div>
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">Call Wrap-up Reduction</div>
              <p className="text-[11px] text-slate-500">Faster onboarding with zero manual spelling loops.</p>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-green-200/80 shadow-lg shadow-emerald-950/5 text-center space-y-2">
              <div className="text-4xl sm:text-5xl font-black text-green-600 tracking-tight">0</div>
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">Compliance Penalties</div>
              <p className="text-[11px] text-slate-500">Rigorous audit logs with full NATO confirmation proofs.</p>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-emerald-200/80 shadow-lg shadow-emerald-950/5 text-center space-y-2">
              <div className="text-4xl sm:text-5xl font-black text-emerald-600 tracking-tight">&lt;350ms</div>
              <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">ASR Processing Latency</div>
              <p className="text-[11px] text-slate-500">Blazing fast sub-second inference via Prisma v3.0.</p>
            </div>

          </div>

        </div>

      </section>

      {/* =========================================================
          G. FINAL CTA (Rich Green Gradient Banner)
         ========================================================= */}
      <section className="py-20 relative">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 p-8 sm:p-14 text-center overflow-hidden shadow-2xl shadow-emerald-600/30">
            
            {/* Background decorative patterns */}
            <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-64 h-64 bg-emerald-400/20 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10 space-y-6">
              <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Make Every Conversation Count.
              </h2>
              <p className="text-emerald-100 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
                Empower your verification officers and automated voice systems with enterprise-grade acoustic precision.
              </p>
              
              <div className="pt-2">
                <button
                  onClick={() => onNavigate('register')}
                  className="px-8 py-4 rounded-2xl bg-white text-emerald-900 font-extrabold text-sm shadow-xl hover:bg-slate-100 transition-all transform hover:scale-105 active:scale-100 cursor-pointer inline-flex items-center space-x-2"
                >
                  <span>Get Started with EchoTrust</span>
                  <ArrowRight className="w-4 h-4 text-emerald-900" />
                </button>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* =========================================================
          H. FOOTER (Clean Crisp Light Slate Footer)
         ========================================================= */}
      <footer className="border-t border-slate-200 bg-white pt-14 pb-12 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 pb-12 border-b border-slate-100">
            
            {/* Brand column */}
            <div className="space-y-4 md:col-span-1">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center text-white">
                  <EchoTrustLogo className="w-5 h-5" />
                </div>
                <span className="text-lg font-black text-slate-900">EchoTrust</span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">
                Enterprise AI voice verification and intelligent conversation accuracy platform for banking and insurance.
              </p>
              <div className="text-[11px] text-emerald-700 font-semibold">
                Every Voice. Every Detail. Verified.
              </div>
            </div>

            {/* Links 1: Platform */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Platform</h4>
              <ul className="space-y-2 text-xs">
                <li><button onClick={() => scrollToSection('features')} className="hover:text-emerald-700 transition cursor-pointer">Voice STT Integration</button></li>
                <li><button onClick={() => scrollToSection('features')} className="hover:text-emerald-700 transition cursor-pointer">Entity Extraction</button></li>
                <li><button onClick={() => scrollToSection('features')} className="hover:text-emerald-700 transition cursor-pointer">Phonetic Read-Back</button></li>
                <li><button onClick={() => scrollToSection('features')} className="hover:text-emerald-700 transition cursor-pointer">Correction Learning</button></li>
              </ul>
            </div>

            {/* Links 2: Solutions */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Solutions</h4>
              <ul className="space-y-2 text-xs">
                <li><span className="hover:text-emerald-700 transition cursor-pointer">Retail Banking KYC</span></li>
                <li><span className="hover:text-emerald-700 transition cursor-pointer">Insurance Underwriting</span></li>
                <li><span className="hover:text-emerald-700 transition cursor-pointer">Credit Card Verification</span></li>
                <li><span className="hover:text-emerald-700 transition cursor-pointer">Mortgage Loan Validation</span></li>
              </ul>
            </div>

            {/* Links 3: Contact & Legal */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Compliance & Security</h4>
              <ul className="space-y-2 text-xs">
                <li><span className="hover:text-emerald-700 transition cursor-pointer">ISO 27001 Certified</span></li>
                <li><span className="hover:text-emerald-700 transition cursor-pointer">SOC 2 Type II Compliant</span></li>
                <li><span className="hover:text-emerald-700 transition cursor-pointer">Privacy Policy</span></li>
                <li><span className="hover:text-emerald-700 transition cursor-pointer">Terms and Conditions</span></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
            <div>
              &copy; {new Date().getFullYear()} EchoTrust Enterprise BFSI. All rights reserved.
            </div>
            <div className="flex items-center space-x-6">
              <span className="hover:text-slate-800 cursor-pointer">Privacy</span>
              <span>•</span>
              <span className="hover:text-slate-800 cursor-pointer">Terms</span>
              <span>•</span>
              <span className="hover:text-slate-800 cursor-pointer">Security</span>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
