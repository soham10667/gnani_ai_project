import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  User, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck,
  Check
} from 'lucide-react';
import { registerAPI } from '../api';
import { EchoTrustLogo } from './LandingPage';

export default function RegisterPage({ onNavigate, onLoginSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Password strength calculator
  const calculateStrength = (pwd) => {
    let score = 0;
    if (pwd.length >= 6) score += 1;
    if (pwd.length >= 10) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) score += 1;
    return score;
  };

  const strength = calculateStrength(password);
  const getStrengthLabel = () => {
    if (!password) return { text: 'Empty', color: 'bg-slate-200', width: '0%' };
    if (strength <= 2) return { text: 'Weak', color: 'bg-rose-500', width: '33%' };
    if (strength <= 3) return { text: 'Medium', color: 'bg-amber-500', width: '66%' };
    return { text: 'Strong', color: 'bg-emerald-500', width: '100%' };
  };

  const strengthData = getStrengthLabel();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name || name.trim().length < 2) {
      setErrorMessage('Please enter your full legal or officer name.');
      return;
    }
    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid official email address.');
      return;
    }
    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please verify.');
      return;
    }
    if (!agreeTerms) {
      setErrorMessage('Please accept the Terms & Conditions and BFSI Compliance policies.');
      return;
    }

    setLoading(true);
    try {
      const res = await registerAPI(name, email, password);
      if (res && res.token && res.user) {
        // Automatically authenticate user and redirect to dashboard
        onLoginSuccess(res.token, res.user, true);
      } else {
        setErrorMessage('Registration succeeded but session token was missing. Please log in.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Registration failed. Please try a different email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white bg-grid-emerald">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-emerald-400/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-teal-400/12 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Bar with Back to Home button */}
      <header className="px-6 py-6 max-w-7xl w-full mx-auto flex items-center justify-between z-10">
        <button
          onClick={() => onNavigate('landing')}
          className="flex items-center space-x-2 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition group py-1.5 px-3 rounded-xl hover:bg-white border border-slate-200/80 shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center space-x-2 text-xs text-slate-600">
          <span>Already registered?</span>
          <button
            onClick={() => onNavigate('login')}
            className="text-emerald-700 font-bold hover:underline cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main Registration Card Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-md bg-white/95 p-8 sm:p-10 rounded-3xl border border-slate-200 shadow-2xl shadow-emerald-950/5 backdrop-blur-xl relative">
          
          {/* Logo & Heading */}
          <div className="text-center space-y-3 mb-8">
            <div 
              onClick={() => onNavigate('landing')}
              className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 via-teal-600 to-green-600 items-center justify-center shadow-lg shadow-emerald-500/25 ring-1 ring-emerald-500/20 cursor-pointer hover:scale-105 transition"
            >
              <EchoTrustLogo className="w-8 h-8 text-white" />
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Get Started with EchoTrust
            </h1>
            <p className="text-xs text-slate-500">
              Create your enterprise officer account in seconds
            </p>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-xs text-rose-800 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Registration Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Full Name</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Official Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@organization.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {password && (
                <div className="pt-1.5 space-y-1">
                  <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full ${strengthData.color} transition-all duration-300`}
                      style={{ width: strengthData.width }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                    <span>Password Strength:</span>
                    <span className="font-bold text-slate-700">{strengthData.text}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Confirm Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50/80 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>
              {confirmPassword && password !== confirmPassword && (
                <div className="text-[11px] text-rose-600 flex items-center space-x-1 pt-0.5">
                  <AlertCircle className="w-3 h-3" />
                  <span>Passwords do not match</span>
                </div>
              )}
            </div>

            {/* Terms and Conditions Checkbox */}
            <div className="flex items-start space-x-2.5 pt-2">
              <input
                type="checkbox"
                id="agreeTerms"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 bg-white mt-0.5 cursor-pointer"
              />
              <label htmlFor="agreeTerms" className="text-xs text-slate-600 select-none leading-relaxed cursor-pointer">
                I agree to the <span className="text-emerald-700 font-semibold hover:underline">Terms of Service</span> and <span className="text-emerald-700 font-semibold hover:underline">BFSI Compliance Policy</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Create Account & Open Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>

          {/* Switch to Login */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
            <span>Already have an account? </span>
            <button
              onClick={() => onNavigate('login')}
              className="text-emerald-700 font-bold hover:underline cursor-pointer ml-1"
            >
              Sign In
            </button>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-[11px] text-slate-400 z-10">
        &copy; {new Date().getFullYear()} EchoTrust Enterprise BFSI. All rights reserved.
      </footer>

    </div>
  );
}
