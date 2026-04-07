import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, ShieldCheck, Scale, Users } from 'lucide-react';
import pdmLogo from '../assets/pdm-logo.png';

const PANEL = '#2e4b43';

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

    try {
      const response = await fetch('http://localhost:5000/api/auth/sdo/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
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
    <div className="flex min-h-screen bg-[#f7f4ef]">
      <div className="hidden w-[48%] flex-col justify-between bg-[#2e4b43] p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <img src={pdmLogo} alt="PDM" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <p className="text-sm font-semibold">Student Disciplinary Office</p>
            <p className="text-xs text-emerald-100/70">Secure monitoring portal</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-100/60">
              SDO Access
            </p>
            <h1 className="mt-4 text-5xl font-semibold leading-tight">
              Review probation records with a dedicated office login.
            </h1>
          </div>

          <div className="space-y-3">
            {[
              { icon: Scale, label: 'Disciplinary analytics and case overview' },
              { icon: Users, label: 'Scholar probation updates connected to admin records' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                <div className="rounded-xl bg-white/10 p-2">
                  <item.icon className="h-4 w-4" />
                </div>
                <p className="text-sm text-emerald-50/90">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs uppercase tracking-[0.2em] text-emerald-100/45">
          Separate credentials required for Student Disciplinary Office accounts
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[390px] rounded-[28px] border border-stone-200 bg-white p-8 shadow-[0_28px_90px_-50px_rgba(0,0,0,0.45)]">
          <div className="mb-8">
            <div className="mb-3 flex items-center gap-2 text-emerald-900">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">
                Authorized SDO Sign-In
              </span>
            </div>
            <h2 className="text-3xl font-semibold text-stone-900">Access the SDO panel</h2>
            <p className="mt-2 text-sm text-stone-500">
              Use your Student Disciplinary Office credentials to continue.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sdo@pdm.edu.ph"
                className="h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 text-sm outline-none transition focus:border-emerald-900/30 focus:ring-2 focus:ring-emerald-900/10"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 pr-11 text-sm outline-none transition focus:border-emerald-900/30 focus:ring-2 focus:ring-emerald-900/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center rounded-2xl text-sm font-semibold text-white transition disabled:opacity-70"
              style={{ background: PANEL }}
            >
              {isLoading ? 'Signing in...' : 'Sign In to SDO'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
