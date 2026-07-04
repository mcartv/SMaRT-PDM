import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, FileCheck2, ShieldCheck, UserCheck } from 'lucide-react';
import pdmLogo from '../assets/pdm-logo.png';
import { buildApiUrl } from '@/api';

const COLORS = {
  base: '#1f4e79',
  sub: '#93c5fd',
  accent: '#38bdf8',
};

export default function GuidanceLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');
    const normalized = email.trim().toLowerCase();

    try {
      const response = await fetch(buildApiUrl('/api/auth/guidance/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalized, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      sessionStorage.setItem('guidanceToken', data.token);
      sessionStorage.setItem('guidanceProfile', JSON.stringify(data.user));
      navigate('/guidance/dashboard');
    } catch (err) {
      setError(err.message || 'Unable to sign in to the Guidance panel.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div
        className="relative hidden flex-col justify-between overflow-hidden lg:flex lg:w-[52%]"
        style={{ background: COLORS.base }}
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative z-10 flex items-center gap-3 p-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10">
            <img src={pdmLogo} alt="Logo" className="block h-16 w-16 object-contain" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-white">PDM · Guidance</p>
            <p className="text-[10px]" style={{ color: COLORS.sub }}>
              Guidance Office
            </p>
          </div>
        </div>

        <div className="relative z-10 px-12">
          <h2 className="mb-10 text-4xl font-bold leading-tight text-white" style={{ fontFamily: 'serif' }}>
            Guidance Office
            <br />
            <span style={{ color: COLORS.accent }}>Portal</span>
          </h2>

          <div className="max-w-xs space-y-3">
            {[
              { icon: FileCheck2, label: 'Role-specific endorsement queue' },
              { icon: UserCheck, label: 'Protected access for assigned staff only' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
              >
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: `${COLORS.accent}30` }}
                >
                  <Icon className="h-4 w-4" style={{ color: COLORS.accent }} />
                </div>
                <p className="text-sm font-medium text-white/90">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 p-10 text-[10px] uppercase tracking-widest text-white/30">
          Separate credentials required for Guidance Office accounts
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8">
            <div className="mb-2 flex items-center gap-2" style={{ color: COLORS.base }}>
              <ShieldCheck size={18} />
              <span className="text-[10px] font-bold uppercase tracking-widest">Authorized Guidance Access</span>
            </div>
            <h1 className="text-3xl font-bold text-stone-900">Guidance Panel</h1>
            <p className="mt-1 text-sm text-stone-500">Use your Guidance Office credentials to continue.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error ? (
              <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-600">{error}</div>
            ) : null}

            <div className="space-y-1.5">
              <label className="ml-1 text-xs font-semibold text-stone-700">Email Address</label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="gco@pdm.edu.ph"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 text-sm transition-all focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': `${COLORS.base}33` }}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-4 pr-12 text-sm transition-all focus:outline-none focus:ring-2"
                  style={{ '--tw-ring-color': `${COLORS.base}33` }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-lg transition-all active:scale-95 disabled:opacity-70"
              style={{
                background: COLORS.base,
                boxShadow: isLoading ? 'none' : `0 8px 20px -6px ${COLORS.base}80`,
              }}
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Authenticating...
                </>
              ) : (
                `Sign In to Guidance`
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs font-medium text-stone-400">
            Contact <span className="text-stone-600">IT Support</span> for account issues.
          </p>
        </div>
      </div>
    </div>
  );
}
