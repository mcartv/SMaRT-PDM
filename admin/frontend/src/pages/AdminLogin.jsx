import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import {
  Eye,
  EyeOff,
  ShieldCheck,
  GraduationCap,
  BookOpen,
  Award,
} from 'lucide-react';
import pdmLogo from '../assets/pdm-logo.png';
import { buildApiUrl } from '@/api';

const SB_BASE = '#7c4a2e';
const SB_TEXT = '#f0d9c8';
const SB_SUB = '#d4a98a';
const ALLOWED_ADMIN_EMAIL = 'admin@pdm.edu.ph';
const LOGIN_URL = buildApiUrl('/api/auth/login');

const FEATURES = [
  { icon: GraduationCap, label: 'Scholarship Management' },
  { icon: BookOpen, label: 'Application Review' },
  { icon: Award, label: 'Financial Assistance' },
];

export default function AdminLogin() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail !== ALLOWED_ADMIN_EMAIL) {
      setError('Only admin@pdm.edu.ph can log in to the admin portal.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password, rememberMe }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      localStorage.setItem('adminToken', data.token);

      if (data.user) {
        localStorage.setItem('adminProfile', JSON.stringify(data.user));
      }

      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex bg-white"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between relative overflow-hidden"
        style={{ background: SB_BASE }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative z-10 p-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <img
              src={pdmLogo}
              alt="Logo"
              className="w-16 h-16 object-contain block mx-auto"
            />
          </div>

          <div>
            <p className="text-white text-xs font-bold tracking-wide uppercase">
              PDM · OSFA
            </p>
            <p className="text-[10px]" style={{ color: SB_SUB }}>
              Admin Portal
            </p>
          </div>
        </div>

        <div className="relative z-10 px-12">
          <h2
            className="text-4xl font-bold leading-tight mb-10 text-white"
            style={{ fontFamily: 'serif' }}
          >
            Scholarship <br />
            <span className="text-yellow-400">Monitoring System</span>
          </h2>

          <div className="space-y-3 max-w-xs">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl px-4 py-3 bg-white/5 border border-white/10"
              >
                <div className="w-8 h-8 rounded-lg bg-yellow-400/20 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-yellow-400" />
                </div>
                <p className="text-sm font-medium text-stone-200">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 p-10 text-[10px] text-white/30 uppercase tracking-widest">
          © 2026 Office for Scholarship and Financial Assistance
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2 text-orange-800">
              <ShieldCheck size={18} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Authorized Access Only
              </span>
            </div>

            <h1 className="text-3xl font-bold text-stone-900">Welcome back</h1>
            <p className="text-stone-500 text-sm mt-1">
              Sign in to manage PDM scholarship systems
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium animate-pulse">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 ml-1">
                Email Address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="admin@pdm.edu.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-800/20 focus:border-orange-800 transition-all"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-semibold text-stone-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/admin/forgot-password')}
                  className="text-[10px] font-bold text-orange-800 hover:underline"
                >
                  Forgot?
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 px-4 pr-12 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-800/20 focus:border-orange-800 transition-all"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setRememberMe((prev) => !prev)}
              className="flex items-center gap-2 cursor-pointer group w-max"
            >
              <div
                className={`w-4 h-4 rounded border transition-colors flex items-center justify-center ${rememberMe
                    ? 'bg-orange-800 border-orange-800'
                    : 'bg-white border-stone-300 group-hover:border-stone-400'
                  }`}
              >
                {rememberMe && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
              </div>
              <span className="text-xs text-stone-600 font-medium select-none">
                Remember for 30 days
              </span>
            </button>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl text-white font-bold text-sm shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
              style={{
                background: SB_BASE,
                boxShadow: isLoading ? 'none' : `0 8px 20px -6px ${SB_BASE}80`,
              }}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-stone-400 font-medium">
            Contact <span className="text-stone-600">OSFA IT Support</span> for account issues.
          </p>
        </div>
      </div>
    </div>
  );
}
