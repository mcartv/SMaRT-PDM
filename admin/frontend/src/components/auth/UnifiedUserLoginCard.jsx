import { useEffect, useRef, useState } from 'react';
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
import TurnstileWidget from '@/components/auth/TurnstileWidget';
import {
  consumePortalSessionFeedback,
  getStoredPortalSession,
  PORTAL_CONFIG,
  savePortalSession,
} from '@/utils/authStorage';

const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || '').trim();

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
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileStatus, setTurnstileStatus] = useState(
    TURNSTILE_SITE_KEY ? 'loading' : 'misconfigured'
  );
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const [sessionFeedback] = useState(consumeAnyPortalFeedback);
  const emailInputRef = useRef(null);
  const loginRequestRef = useRef(false);
  const loginTooltip = !email.trim() && !password
    ? 'Enter your email and password to continue.'
    : !email.trim()
      ? 'Enter your email to continue.'
      : !password
        ? 'Enter your password to continue.'
        : !turnstileToken
          ? ['error', 'unsupported', 'misconfigured'].includes(turnstileStatus)
            ? 'Security verification is unavailable.'
            : 'Wait for security verification to complete.'
          : 'Sign in to SMaRT-PDM.';

  useEffect(() => {
    const existingSession = getStoredPortalSession();
    if (existingSession?.token && existingSession?.redirectPath) {
      navigate(existingSession.redirectPath, { replace: true });
      return undefined;
    }

    if (window.matchMedia?.('(pointer: fine)').matches) {
      const frameId = window.requestAnimationFrame(() => emailInputRef.current?.focus());
      return () => window.cancelAnimationFrame(frameId);
    }

    return undefined;
  }, [navigate]);

  const handleLogin = async (event) => {
    event.preventDefault();
    if (loginRequestRef.current || isLoading) return;

    if (!turnstileToken) {
      setError(
        turnstileStatus === 'misconfigured'
          ? 'Security verification is not configured for this site.'
          : 'Wait for security verification to complete, then try again.'
      );
      return;
    }

    loginRequestRef.current = true;
    setError('');
    setIsLoading(true);

    try {
      const data = await authService.login({
        email: email.trim(),
        password,
        stayLoggedIn: false,
        turnstileToken,
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

      // Keep the card in its busy state until React Router unmounts this page.
      // Releasing it immediately after navigate() caused a brief button/input flash.
      navigate(portal.redirectPath, { replace: true });
    } catch (err) {
      setError(getLoginErrorMessage(err, 'User'));
      setTurnstileToken('');
      setTurnstileStatus(TURNSTILE_SITE_KEY ? 'loading' : 'misconfigured');
      setTurnstileResetSignal((current) => current + 1);
      loginRequestRef.current = false;
      setIsLoading(false);
    }
  };

  const updateCapsLockState = (event) => {
    setCapsLockOn(Boolean(event?.getModifierState?.('CapsLock')));
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
          className="relative overflow-hidden rounded-[1.08rem] border bg-[#fffdfa] px-4 py-5 min-[360px]:px-5 sm:px-6 sm:py-6"
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
                  ref={emailInputRef}
                  id="unified-user-email"
                  type="email"
                  required
                  disabled={isLoading}
                  autoComplete="username"
                  inputMode="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError('');
                  }}
                  className="h-[52px] w-full rounded-xl border border-stone-200 bg-white pl-10 pr-4 text-sm font-medium text-stone-900 outline-none transition placeholder:font-normal placeholder:text-stone-400 focus:ring-2 disabled:cursor-wait disabled:opacity-60"
                  style={{
                    '--tw-ring-color': `${theme.base}1c`,
                    borderColor: email ? `${theme.base}38` : undefined,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <label htmlFor="unified-user-password" className="block text-xs font-bold text-stone-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => navigate('/admin/forgot-password', { state: { email } })}
                  disabled={isLoading}
                  className="cursor-pointer text-[11px] font-bold transition hover:opacity-80 hover:underline disabled:cursor-wait disabled:opacity-50 disabled:no-underline"
                  style={{ color: theme.base }}
                  aria-label="Admin password recovery"
                  title="Admin account password recovery"
                >
                  Admin password recovery
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
                  enterKeyHint="go"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError('');
                  }}
                  onKeyDown={updateCapsLockState}
                  onKeyUp={updateCapsLockState}
                  onFocus={updateCapsLockState}
                  onBlur={() => setCapsLockOn(false)}
                  aria-describedby={capsLockOn ? 'unified-user-caps-lock' : undefined}
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
                  className="absolute right-3.5 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-stone-400 transition duration-200 hover:bg-stone-100 hover:text-stone-700 hover:shadow-sm disabled:cursor-wait disabled:opacity-50"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>

                {capsLockOn ? (
                  <div
                    id="unified-user-caps-lock"
                    role="status"
                    className="pointer-events-none absolute right-2 top-[-2.35rem] z-20 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold leading-none text-amber-800 shadow-sm"
                  >
                    Caps Lock is on
                    <span
                      className="absolute -bottom-1 right-5 h-2 w-2 rotate-45 border-b border-r border-amber-200 bg-amber-50"
                      aria-hidden="true"
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <TurnstileWidget
                siteKey={TURNSTILE_SITE_KEY}
                resetSignal={turnstileResetSignal}
                onTokenChange={setTurnstileToken}
                onStatusChange={setTurnstileStatus}
              />

              {['error', 'unsupported', 'misconfigured'].includes(turnstileStatus) ? (
                <p
                  role="alert"
                  className="text-[11px] font-semibold leading-4 text-red-600"
                >
                  {turnstileStatus === 'misconfigured' ? (
                    'Security verification is not configured for this site.'
                  ) : turnstileStatus === 'unsupported' ? (
                    'This browser cannot complete security verification.'
                  ) : (
                    'Security verification could not load. Refresh the page and try again.'
                  )}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={isLoading || !turnstileToken}
              title={loginTooltip}
              className="mt-1 flex h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-extrabold text-white shadow-[0_6px_16px_rgba(78,46,25,0.16)] transition duration-200 hover:-translate-y-px hover:brightness-95 hover:shadow-[0_8px_18px_rgba(78,46,25,0.2)] active:translate-y-px disabled:cursor-wait disabled:opacity-70"
              style={{ background: theme.base }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Signing in...
                </>
              ) : turnstileStatus === 'loading' ? (
                <>
                  <Loader2 size={17} className="animate-spin" />
                  Checking security...
                </>
              ) : (
                <>
                  <LogIn size={16} />
                  Login
                </>
              )}
            </button>

            <span className="sr-only" role="status" aria-live="polite">
              {isLoading
                ? 'Signing in. Please wait.'
                : turnstileStatus === 'loading'
                  ? 'Checking browser security. Please wait.'
                  : turnstileStatus === 'verified'
                    ? 'Security verification complete. Login is ready.'
                    : ''}
            </span>
          </form>
        </div>
      </div>
    </section>
  );
}
