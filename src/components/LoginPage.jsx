import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  ShieldCheck
} from 'lucide-react';
import { loginAPI } from '../api';
import { EchoTrustLogo } from './LandingPage';

export default function LoginPage({ onNavigate, onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [forgotNotice, setForgotNotice] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setForgotNotice(false);

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid official email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Please enter your account password.');
      return;
    }

    setLoading(true);
    try {
      const res = await loginAPI(email, password);
      if (res && res.token && res.user) {
        onLoginSuccess(res.token, res.user, rememberMe);
      } else {
        setErrorMessage('Unexpected server response. Please try again.');
      }
    } catch (err) {
      setErrorMessage(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('ananya.k@apexbank.in');
    setPassword('Password@123');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-800 flex flex-col justify-between relative overflow-hidden font-sans selection:bg-emerald-500 selection:text-white bg-grid-emerald">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-emerald-400/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-teal-400/12 rounded-full blur-[140px] pointer-events-none" />

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
          <span>Need an account?</span>
          <button
            onClick={() => onNavigate('register')}
            className="text-emerald-700 font-bold hover:underline cursor-pointer"
          >
            Create Account
          </button>
        </div>
      </header>

      {/* Main Login Card Container */}
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
              Welcome Back
            </h1>
            <p className="text-xs text-slate-500">
              Sign in to access the EchoTrust Verification Suite
            </p>
          </div>

          {/* Quick Demo Credentials Assistant */}
          <div className="mb-6 p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <div className="font-bold text-slate-900">Demo Credentials Ready</div>
                <div className="text-[11px] text-emerald-700">Officer: Ananya Kapoor</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleFillDemo}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition cursor-pointer"
            >
              Autofill
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="mb-6 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-xs text-rose-800 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Forgot Password Demo Notice */}
          {forgotNotice && (
            <div className="mb-6 p-3.5 rounded-2xl bg-teal-50 border border-teal-200 flex items-start space-x-3 text-xs text-teal-800 animate-fadeIn">
              <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                Password reset link dispatched to your organization admin. Or click <strong>Autofill</strong> above to test with the verified demo officer account.
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Email Address</label>
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
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={() => setForgotNotice(true)}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Toggle */}
            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-0 focus:ring-offset-0 bg-white cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-xs text-slate-600 select-none cursor-pointer font-medium">
                Keep me signed in on this device
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>

          {/* Switch to Registration */}
          <div className="mt-8 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
            <span>Don't have an enterprise account? </span>
            <button
              onClick={() => onNavigate('register')}
              className="text-emerald-700 font-bold hover:underline cursor-pointer ml-1"
            >
              Create Account
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
