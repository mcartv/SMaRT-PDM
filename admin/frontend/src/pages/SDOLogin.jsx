import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, ShieldCheck, Scale, Users } from 'lucide-react';
import pdmLogo from '../assets/pdm-logo.png';
import { buildApiUrl } from '@/api';

// ─── GREEN SDO THEME ────────────────────────────────────────────
const PANEL_BASE = '#2e4b43';
const PANEL_TEXT = '#ecfdf5';
const PANEL_SUB = '#a7f3d0';
const ACCENT = '#16a34a';
const ALLOWED_SDO_EMAIL = 'sdo@pdm.edu.ph';

export default function SDOLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail !== ALLOWED_SDO_EMAIL) {
      setError('Only sdo@pdm.edu.ph can log in to the SDO portal.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(buildApiUrl('/api/auth/sdo/login'), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: normalizedEmail, password }),
});

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      localStorage.setItem('sdoToken', data.token);
      localStorage.setItem('sdoProfile', JSON.stringify(data.user));
      navigate('/sdo/dashboard');
    } catch (err) {
      setError(err.message || 'Unable to sign in to the SDO panel.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      
      {/* ── LEFT PANEL ── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between relative overflow-hidden"
        style={{ background: PANEL_BASE }}
      >
        {/* subtle pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)',
            backgroundSize: '28px 28px'
          }}
        />

        {/* header */}
        <div className="relative z-10 p-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <img src={pdmLogo} alt="Logo" className="w-16 h-16 object-contain block mx-auto" />
          </div>
          <div>
            <p className="text-white text-xs font-bold tracking-wide uppercase">PDM · SDO</p>
            <p className="text-[10px]" style={{ color: PANEL_SUB }}>
              Student Disciplinary Office
            </p>
          </div>
        </div>

        {/* content */}
        <div className="relative z-10 px-12">
          <h2 className="text-4xl font-bold leading-tight mb-10 text-white" style={{ fontFamily: "serif" }}>
            Student Disciplinary <br />
            <span style={{ color: ACCENT }}>Office Portal</span>
          </h2>

          <div className="space-y-3 max-w-xs">
            {[
              { icon: Scale, label: 'Disciplinary analytics and case overview' },
              { icon: Users, label: 'Scholar probation updates connected to admin records' },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl px-4 py-3 bg-white/5 border border-white/10"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${ACCENT}30` }}
                >
                  <Icon className="w-4 h-4" style={{ color: ACCENT }} />
                </div>
                <p className="text-sm font-medium text-emerald-50">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* footer */}
        <div className="relative z-10 p-10 text-[10px] text-white/30 uppercase tracking-widest">
          Separate credentials required for Student Disciplinary Office accounts
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">

          {/* header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2" style={{ color: PANEL_BASE }}>
              <ShieldCheck size={18} />
              <span className="text-[10px] font-bold uppercase tracking-widest">
                Authorized SDO Access
              </span>
            </div>
            <h1 className="text-3xl font-bold text-stone-900">SDO Panel</h1>
            <p className="text-stone-500 text-sm mt-1">
              Use your Student Disciplinary Office credentials to continue.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">

            {/* error */}
            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium">
                {error}
              </div>
            )}

            {/* email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700 ml-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="sdo@pdm.edu.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700 transition-all"
              />
            </div>

            {/* password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-stone-700">
                Password
              </label>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 px-4 pr-12 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-green-700/20 focus:border-green-700 transition-all"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl text-white font-bold text-sm shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
              style={{
                background: PANEL_BASE,
                boxShadow: isLoading ? 'none' : `0 8px 20px -6px ${PANEL_BASE}80`
              }}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Authenticating...
                </>
              ) : 'Sign In to SDO'}
            </button>
          </form>

          {/* footer */}
          <p className="mt-8 text-center text-xs text-stone-400 font-medium">
            Contact <span className="text-stone-600">IT Support</span> for account issues.
          </p>
        </div>
      </div>
    </div>
  );
}