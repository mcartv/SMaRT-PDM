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
import usePortalTheme from '@/hooks/usePortalTheme';
const LOGIN_URL = buildApiUrl('/api/auth/login');

const FEATURES = [
  { icon: GraduationCap, label: 'Scholarship Management' },
  { icon: BookOpen, label: 'Application Review' },
  { icon: Award, label: 'Financial Assistance' },
];

const ROLE_PORTALS = {
  pd: {
    tokenStorageKey: 'pdToken',
    profileStorageKey: 'pdProfile',
    redirectPath: '/pd/dashboard',
  },
  guidance: {
    tokenStorageKey: 'guidanceToken',
    profileStorageKey: 'guidanceProfile',
    redirectPath: '/guidance/dashboard',
  },
  sdo: {
    tokenStorageKey: 'sdoToken',
    profileStorageKey: 'sdoProfile',
    redirectPath: '/sdo/dashboard',
  },
};

const AUTH_STORAGE_KEYS = [
  'adminToken',
  'adminProfile',
  'pdToken',
  'pdProfile',
  'guidanceToken',
  'guidanceProfile',
  'sdoToken',
  'sdoProfile',
];

function clearAuthStorage() {
  AUTH_STORAGE_KEYS.forEach((key) => {
    sessionStorage.removeItem(key);

    // Cleanup old remembered-login leftovers.
    localStorage.removeItem(key);
  });
}

function saveAuthSession({ tokenKey, profileKey, token, user }) {
  sessionStorage.setItem(tokenKey, token);

  if (user) {
    sessionStorage.setItem(profileKey, JSON.stringify(user));
  }
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const { theme } = usePortalTheme('admin');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    try {
      const response = await fetch(LOGIN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      const nextRole = data?.user?.role;
      const rolePortal = ROLE_PORTALS[nextRole];

      clearAuthStorage();

      if (rolePortal) {
        saveAuthSession({
          tokenKey: rolePortal.tokenStorageKey,
          profileKey: rolePortal.profileStorageKey,
          token: data.token,
          user: data.user,
        });

        navigate(rolePortal.redirectPath);
        return;
      }

      saveAuthSession({
        tokenKey: 'adminToken',
        profileKey: 'adminProfile',
        token: data.token,
        user: data.user,
      });

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
        style={{ background: theme.base }}
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
            <p className="text-[10px]" style={{ color: theme.sub }}>
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
            <span style={{ color: theme.accent }}>Monitoring System</span>
          </h2>

          <div className="space-y-3 max-w-xs">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl px-4 py-3 bg-white/5 border border-white/10"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${theme.accent}30` }}>
                  <Icon className="h-4 w-4" style={{ color: theme.accent }} />
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
            <div className="mb-2 flex items-center gap-2" style={{ color: theme.base }}>
              <ShieldCheck size={18} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Authorized Access Only
              </span>
            </div>

            <h1 className="text-3xl font-bold text-stone-900">Welcome back</h1>
            <p className="text-stone-500 text-sm mt-1">
              Sign in to manage scholarship endorsements and OSFA systems
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
                placeholder="staff@pdm.edu.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm transition-all focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': `${theme.base}33` }}
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
                  className="text-[10px] font-bold hover:underline"
                  style={{ color: theme.base }}
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
                  className="w-full h-11 rounded-xl border border-stone-200 bg-stone-50 px-4 pr-12 text-sm transition-all focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': `${theme.base}33` }}
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
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl text-white font-bold text-sm shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
              style={{
                background: theme.base,
                boxShadow: isLoading ? 'none' : `0 8px 20px -6px ${theme.base}80`,
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
