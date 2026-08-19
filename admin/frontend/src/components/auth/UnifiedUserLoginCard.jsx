import { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import { getLoginErrorMessage } from '@/utils/loginErrors';
import {
  consumePortalSessionFeedback,
  getStoredPortalSession,
  PORTAL_CONFIG,
  savePortalSession,
} from '@/utils/authStorage';

function consumeAnyPortalFeedback() {
  for (const portalName of Object.keys(PORTAL_CONFIG)) {
    const feedback = consumePortalSessionFeedback(portalName);
    if (feedback) return feedback;
  }

  return null;
}

export default function UnifiedUserLoginCard({ theme }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionFeedback] = useState(consumeAnyPortalFeedback);

  useEffect(() => {
    const existingSession = getStoredPortalSession();
    if (existingSession?.token && existingSession?.redirectPath) {
      navigate(existingSession.redirectPath, { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (event) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const data = await authService.login({
        email,
        password,
        stayLoggedIn: false,
      });

      const portalName = String(data?.user?.role || '').trim().toLowerCase();
      const portal = PORTAL_CONFIG[portalName];

      if (!portal || !data?.token) {
        const roleError = new Error('This user account does not have configured SMaRT-PDM access.');
        roleError.code = 'USER_ACCESS_NOT_CONFIGURED';
        throw roleError;
      }

      savePortalSession({
        portalName,
        token: data.token,
        user: data.user,
        stayLoggedIn: false,
      });

      navigate(portal.redirectPath, { replace: true });
    } catch (err) {
      setError(getLoginErrorMessage(err, 'User'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section
      id="access"
      className="mx-auto w-full max-w-[430px] scroll-mt-16"
      aria-labelledby="login-heading"
    >
      <div
        className="relative rounded-[1.35rem] border p-[5px] shadow-[0_20px_44px_rgba(63,39,23,0.14)] backdrop-blur-sm"
        style={{
          borderColor: `${theme.base}30`,
          background: `linear-gradient(145deg, rgba(255,255,255,0.74), ${theme.soft}b8)`,
        }}
      >
        <div
          className="relative overflow-hidden rounded-[1.08rem] border bg-[#fffdfa] px-5 py-5 sm:px-6 sm:py-6"
          style={{ borderColor: `${theme.base}18` }}
        >
          <span
            className="absolute inset-x-0 top-0 h-1"
            style={{ background: `linear-gradient(90deg, ${theme.accent}, ${theme.base})` }}
            aria-hidden="true"
          />

          <div className="mb-5 flex items-center gap-3 border-b border-stone-200/80 pb-4 pt-1">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-white shadow-sm"
              style={{ borderColor: `${theme.base}24`, color: theme.base }}
              aria-hidden="true"
            >
              <ShieldCheck size={17} strokeWidth={2.1} />
            </span>
            <div className="min-w-0">
              <p
                id="login-heading"
                className="text-2xl font-black tracking-[-0.025em] text-stone-900 sm:text-[28px]"
              >
                Login Access
              </p>
              <span
                className="mt-2 block h-0.5 w-10 rounded-full"
                style={{ background: theme.accent }}
                aria-hidden="true"
              />
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4" aria-busy={isLoading}>
            {sessionFeedback ? (
              <div
                role="status"
                aria-live="polite"
                className={
                  sessionFeedback.tone === 'danger'
                    ? 'rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700'
                    : sessionFeedback.tone === 'warning'
                      ? 'rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800'
                      : 'rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800'
                }
              >
                <p className="font-bold">{sessionFeedback.title}</p>
                <p className="mt-1 leading-5">{sessionFeedback.message}</p>
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs font-semibold leading-5 text-red-600"
              >
                {error}
              </div>
            ) : null}

            <div>
              <label htmlFor="unified-user-email" className="mb-1.5 block text-xs font-bold text-stone-700">
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                />
                <input
                  id="unified-user-email"
                  type="email"
                  required
                  disabled={isLoading}
                  autoComplete="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-[52px] w-full rounded-xl border border-stone-200 bg-white pl-10 pr-4 text-sm font-medium text-stone-900 outline-none transition placeholder:font-normal placeholder:text-stone-400 focus:ring-2 disabled:cursor-wait disabled:opacity-60"
                  style={{
                    '--tw-ring-color': `${theme.base}1c`,
                    borderColor: email ? `${theme.base}38` : undefined,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <label htmlFor="unified-user-password" className="block text-xs font-bold text-stone-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/admin/forgot-password', { state: { email } })}
                  className="text-[11px] font-bold transition hover:underline"
                  style={{ color: theme.base }}
                >
                  Forgot password?
                </button>
              </div>

              <div className="relative">
                <LockKeyhole
                  size={16}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                />
                <input
                  id="unified-user-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={isLoading}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-[52px] w-full rounded-xl border border-stone-200 bg-white pl-10 pr-12 text-sm font-medium text-stone-900 outline-none transition placeholder:font-normal placeholder:text-stone-400 focus:ring-2 disabled:cursor-wait disabled:opacity-60"
                  style={{
                    '--tw-ring-color': `${theme.base}1c`,
                    borderColor: password ? `${theme.base}38` : undefined,
                  }}
                />
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-3.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 disabled:cursor-wait disabled:opacity-50"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-1 flex h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold text-white shadow-[0_6px_16px_rgba(78,46,25,0.16)] transition hover:brightness-95 hover:shadow-[0_8px_18px_rgba(78,46,25,0.2)] active:translate-y-px disabled:cursor-wait disabled:opacity-70"
              style={{ background: theme.base }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Logging in…
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Login
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
