import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import useLandingTheme from '@/hooks/useLandingTheme';
import LandingInstitutionHeader from '@/components/landing/LandingInstitutionHeader';
import pdmFacade from '../assets/PDM-Facade-optimized.jpg';

const LOGIN_PATH = '/login';
const START_RESET_URL = buildApiUrl('/api/auth/admin/forgot-password/start');
const VERIFY_RESET_URL = buildApiUrl('/api/auth/admin/forgot-password/verify');
const FINALIZE_RESET_URL = buildApiUrl('/api/auth/admin/forgot-password/reset');

const RESET_REQUEST_STORAGE_KEY_PREFIX = 'smartpdm_admin_reset_last_request_at';
const RESEND_SECONDS = 60;

async function requestJson(url, body, fallbackMessage) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || data.error || fallbackMessage);
  }

  return data;
}

function getPasswordChecks(password) {
  const value = String(password || '');

  return [
    { label: 'At least 10 characters', valid: value.length >= 10 },
    { label: 'Uppercase letter', valid: /[A-Z]/.test(value) },
    { label: 'Lowercase letter', valid: /[a-z]/.test(value) },
    { label: 'Number', valid: /\d/.test(value) },
    { label: 'Special character', valid: /[^A-Za-z0-9]/.test(value) },
  ];
}

function normalizeEmail(value) {
  return String(value || '').replace(/\s+/g, '').trim().toLowerCase();
}

function getCooldownStorageKey(email) {
  return `${RESET_REQUEST_STORAGE_KEY_PREFIX}:${normalizeEmail(email)}`;
}

function getRemainingCooldown(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return 0;

  const lastRequestedAt = Number(
    sessionStorage.getItem(getCooldownStorageKey(normalizedEmail)) || 0
  );

  if (!lastRequestedAt) return 0;

  const elapsedSeconds = Math.floor((Date.now() - lastRequestedAt) / 1000);
  return Math.max(RESEND_SECONDS - elapsedSeconds, 0);
}

function HexCluster({ className = '', color = '#d29a00', mirrored = false }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 310 250"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={mirrored ? { transform: 'scaleX(-1)' } : undefined}
    >
      <g stroke={color} strokeWidth="2.2" opacity="0.62">
        <path d="M82 16 122 39v47l-40 23-40-23V39L82 16Z" />
        <path d="m153 56 39 23v46l-39 23-40-23V79l40-23Z" />
        <path d="m92 108 34 20v40l-34 20-35-20v-40l35-20Z" />
        <path d="m220 119 33 19v39l-33 19-34-19v-39l34-19Z" />
        <path d="m158 160 29 17v34l-29 17-30-17v-34l30-17Z" />
        <path d="M18 66h31M202 56h35M248 196h46M1 151h49" />
      </g>
      <g fill={color}>
        <circle cx="122" cy="39" r="4.5" />
        <circle cx="192" cy="79" r="4.5" />
        <circle cx="57" cy="128" r="3.5" />
        <circle cx="253" cy="138" r="3.5" />
        <circle cx="128" cy="211" r="3.5" />
      </g>
    </svg>
  );
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const otpRefs = useRef([]);
  const { theme } = useLandingTheme();

  const [email, setEmail] = useState(() => normalizeEmail(location.state?.email || ''));
  const [step, setStep] = useState('email');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const loading = Boolean(loadingAction);
  const [resendTimer, setResendTimer] = useState(0);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const otpValue = otp.join('');
  const otpComplete = otpValue.length === 6;
  const passwordChecks = useMemo(() => getPasswordChecks(newPassword), [newPassword]);
  const passwordStrong = passwordChecks.every((item) => item.valid);
  const passwordsMatch = Boolean(newPassword && confirmPass && newPassword === confirmPass);
  const cardTitle = {
    email: 'Admin Password Recovery',
    otp: 'Admin Verification Code',
    reset: 'Reset Admin Password',
    done: 'Admin Password Reset',
  }[step] || 'Admin Password Recovery';

  useEffect(() => {
    if (resendTimer <= 0) return undefined;

    const timeout = window.setTimeout(() => {
      setResendTimer((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timeout);
  }, [resendTimer]);

  const clearFeedback = () => {
    setError('');
    setNotice('');
  };

  const focusFirstOtp = () => {
    window.setTimeout(() => {
      otpRefs.current[0]?.focus();
    }, 100);
  };

  const startResendTimer = (seconds = RESEND_SECONDS) => {
    setResendTimer(seconds);
  };

  const sendOtpRequest = async ({ isResend = false } = {}) => {
    clearFeedback();

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      setStep('email');
      setError('Enter the registered Admin email address.');
      return;
    }

    const remaining = getRemainingCooldown(normalizedEmail);
    if (remaining > 0) {
      setStep('otp');
      setNotice('A recovery code was already requested. Check the registered Admin email.');
      startResendTimer(remaining);
      focusFirstOtp();
      return;
    }

    setLoadingAction(isResend ? 'resend' : 'send');

    try {
      await requestJson(
        START_RESET_URL,
        { email: normalizedEmail },
        'Unable to send recovery code.'
      );

      sessionStorage.setItem(getCooldownStorageKey(normalizedEmail), String(Date.now()));
      setEmail(normalizedEmail);
      setStep('otp');
      setOtp(['', '', '', '', '', '']);
      setResetToken('');
      setNotice('');
      startResendTimer();
      focusFirstOtp();
    } catch (err) {
      console.error('[FORGOT PASSWORD] SEND OTP ERROR:', err);
      setError(err.message || 'Unable to send recovery code.');
    } finally {
      setLoadingAction('');
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    await sendOtpRequest();
  };

  const handleVerifyOtp = async (event) => {
    event.preventDefault();
    clearFeedback();
    setLoadingAction('verify');

    try {
      const data = await requestJson(
        VERIFY_RESET_URL,
        {
          email: normalizeEmail(email),
          otp: otpValue,
        },
        'Invalid or expired recovery code.'
      );

      setResetToken(data.resetToken || '');
      setStep('reset');
      setNotice('Code verified. Set a new password.');
    } catch (err) {
      console.error('[FORGOT PASSWORD] VERIFY OTP ERROR:', err);
      setError(err.message || 'Invalid or expired recovery code.');
    } finally {
      setLoadingAction('');
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    clearFeedback();

    if (!passwordStrong) {
      setError('Password does not meet the required security rules.');
      return;
    }

    if (!passwordsMatch) {
      setError('Passwords do not match.');
      return;
    }

    if (!resetToken) {
      setError('Reset session is missing or expired. Verify the OTP again.');
      return;
    }

    setLoadingAction('reset');

    try {
      await requestJson(
        FINALIZE_RESET_URL,
        {
          email: normalizeEmail(email),
          resetToken,
          newPassword,
        },
        'Unable to reset password.'
      );

      setStep('done');
      setOtp(['', '', '', '', '', '']);
      setResetToken('');
      setNewPassword('');
      setConfirmPass('');
      setNotice('');
      setError('');
      sessionStorage.removeItem(getCooldownStorageKey(email));
    } catch (err) {
      console.error('[FORGOT PASSWORD] RESET PASSWORD ERROR:', err);
      setError(err.message || 'Unable to reset password.');
    } finally {
      setLoadingAction('');
    }
  };

  const handleResend = async () => {
    if (loading || resendTimer > 0) return;
    await sendOtpRequest({ isResend: true });
  };

  const handleOtpChange = (value, index) => {
    clearFeedback();

    const digit = value.replace(/\D/g, '').slice(0, 1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (event) => {
    event.preventDefault();

    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;

    const next = ['', '', '', '', '', ''];
    pasted.split('').forEach((digit, index) => {
      next[index] = digit;
    });

    setOtp(next);

    const nextFocusIndex = Math.min(pasted.length, 5);
    window.setTimeout(() => {
      otpRefs.current[nextFocusIndex]?.focus();
    }, 0);
  };

  const handleOtpKeyDown = (event, index) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const goBackToLogin = () => {
    navigate(LOGIN_PATH, { replace: true });
  };

  const fieldStyle = (hasValue = false) => ({
    '--tw-ring-color': `${theme.base}1c`,
    borderColor: hasValue ? `${theme.base}38` : undefined,
  });

  const primaryButtonClass =
    'flex h-[48px] w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold text-white shadow-[0_6px_16px_rgba(78,46,25,0.16)] transition hover:brightness-95 hover:shadow-[0_8px_18px_rgba(78,46,25,0.2)] active:translate-y-px disabled:cursor-wait disabled:opacity-60';

  const inputClass =
    'h-[52px] w-full rounded-xl border border-stone-200 bg-white text-sm font-medium text-stone-900 outline-none transition placeholder:font-normal placeholder:text-stone-400 focus:ring-2 disabled:cursor-wait disabled:opacity-60';

  const renderFeedback = () => (
    <>
      {error ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-xs font-semibold leading-5 text-red-600"
        >
          {error}
        </div>
      ) : null}

      {notice && !error ? (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-3 text-xs font-semibold leading-5 text-emerald-700"
        >
          {notice}
        </div>
      ) : null}
    </>
  );

  const renderEmailStep = () => (
    <div className="space-y-5">
      {renderFeedback()}

      <form onSubmit={handleEmailSubmit} className="space-y-4" aria-busy={loading}>
        <div>
          <label htmlFor="admin-recovery-email" className="mb-1.5 block text-xs font-bold text-stone-700">
            Registered Admin Email
          </label>
          <div className="relative">
            <Mail
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              id="admin-recovery-email"
              type="email"
              required
              disabled={loading}
              autoComplete="email"
              placeholder="Enter Admin email"
              value={email}
              onChange={(event) => setEmail(normalizeEmail(event.target.value))}
              className={`${inputClass} pl-10 pr-4`}
              style={fieldStyle(Boolean(email))}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={!normalizeEmail(email) || loading}
          className={primaryButtonClass}
          style={{ background: theme.base }}
        >
          {loadingAction === 'send' ? (
            <>
              <Loader2 size={17} className="animate-spin" />
              Sending code...
            </>
          ) : (
            <>
              <KeyRound size={16} />
              Send Verification Code
            </>
          )}
        </button>
      </form>
    </div>
  );

  const renderOtpStep = () => (
    <div className="space-y-5">
      <p className="text-sm leading-6 text-stone-500">
        Enter the 6-digit code sent to the registered Admin email{email ? ` (${email})` : ''}.
      </p>

      {renderFeedback()}

      <form onSubmit={handleVerifyOtp} className="space-y-4" aria-busy={loading}>
        <div>
          <label className="mb-1.5 block text-xs font-bold text-stone-700">Verification Code</label>
          <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  otpRefs.current[index] = element;
                }}
                id={`otp-${index}`}
                aria-label={`Verification code digit ${index + 1}`}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? 'one-time-code' : 'off'}
                maxLength={1}
                value={digit}
                onChange={(event) => handleOtpChange(event.target.value, index)}
                onPaste={handleOtpPaste}
                onKeyDown={(event) => handleOtpKeyDown(event, index)}
                disabled={loading}
                className="h-12 min-w-0 rounded-xl border border-stone-200 bg-white text-center text-base font-extrabold text-stone-900 outline-none transition focus:ring-2 disabled:cursor-wait disabled:opacity-60"
                style={fieldStyle(Boolean(digit))}
              />
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={!otpComplete || loading}
          className={primaryButtonClass}
          style={{ background: theme.base }}
        >
          {loadingAction === 'verify' ? (
            <>
              <Loader2 size={17} className="animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              Verify Code
            </>
          )}
        </button>

        <div className="flex flex-col items-center gap-2 pt-1 text-center">
          {resendTimer > 0 ? (
            <p className="text-xs font-medium text-stone-400">Resend available in {resendTimer}s</p>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs font-bold transition hover:underline disabled:cursor-wait disabled:opacity-60"
              style={{ color: theme.base }}
            >
              {loadingAction === 'resend' ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              {loadingAction === 'resend' ? 'Resending...' : 'Resend Code'}
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              clearFeedback();
              setOtp(['', '', '', '', '', '']);
              setResetToken('');
              setStep('email');
            }}
            disabled={loading}
            className="text-[11px] font-semibold text-stone-500 transition hover:text-stone-800 hover:underline disabled:opacity-60"
          >
            Use a different email
          </button>
        </div>
      </form>
    </div>
  );

  const renderResetStep = () => (
    <div className="space-y-5">
      {renderFeedback()}

      <form onSubmit={handleReset} className="space-y-4" aria-busy={loading}>
        <div>
          <label htmlFor="admin-new-password" className="mb-1.5 block text-xs font-bold text-stone-700">
            New Password
          </label>
          <div className="relative">
            <LockKeyhole
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              id="admin-new-password"
              type={showNew ? 'text' : 'password'}
              required
              disabled={loading}
              autoComplete="new-password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className={`${inputClass} pl-10 pr-12`}
              style={fieldStyle(Boolean(newPassword))}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowNew((current) => !current)}
              className="absolute right-3.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 disabled:cursor-wait disabled:opacity-50"
              aria-label={showNew ? 'Hide new password' : 'Show new password'}
            >
              {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <div
          className="grid grid-cols-1 gap-x-3 gap-y-1 rounded-xl border bg-stone-50/80 px-3.5 py-3 sm:grid-cols-2"
          style={{ borderColor: `${theme.base}16` }}
        >
          {passwordChecks.map((item) => (
            <div
              key={item.label}
              className={`flex items-center gap-1.5 text-[11px] font-semibold ${
                item.valid ? 'text-emerald-700' : 'text-stone-400'
              }`}
            >
              <span aria-hidden="true">{item.valid ? '✓' : '•'}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <div>
          <label htmlFor="admin-confirm-password" className="mb-1.5 block text-xs font-bold text-stone-700">
            Confirm Password
          </label>
          <div className="relative">
            <LockKeyhole
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              id="admin-confirm-password"
              type={showConfirm ? 'text' : 'password'}
              required
              disabled={loading}
              autoComplete="new-password"
              placeholder="Confirm new password"
              value={confirmPass}
              onChange={(event) => setConfirmPass(event.target.value)}
              className={`${inputClass} pl-10 pr-12`}
              style={fieldStyle(Boolean(confirmPass))}
            />
            <button
              type="button"
              disabled={loading}
              onClick={() => setShowConfirm((current) => !current)}
              className="absolute right-3.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-600 disabled:cursor-wait disabled:opacity-50"
              aria-label={showConfirm ? 'Hide confirmation password' : 'Show confirmation password'}
            >
              {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          {confirmPass && !passwordsMatch ? (
            <p className="mt-1.5 text-[11px] font-semibold text-red-600">Passwords do not match.</p>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={!passwordStrong || !passwordsMatch || loading || !resetToken}
          className={primaryButtonClass}
          style={{ background: theme.base }}
        >
          {loadingAction === 'reset' ? (
            <>
              <Loader2 size={17} className="animate-spin" />
              Updating password...
            </>
          ) : (
            <>
              <ShieldCheck size={16} />
              Reset Admin Password
            </>
          )}
        </button>
      </form>
    </div>
  );

  const renderDoneStep = () => (
    <div className="py-1 text-center">
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border"
        style={{ background: theme.soft, borderColor: `${theme.base}20`, color: theme.base }}
      >
        <CheckCircle2 size={30} strokeWidth={2} />
      </div>

      <p className="mx-auto mt-5 max-w-[310px] text-sm leading-6 text-stone-500">
        The Admin password has been updated. You can now sign in with the new password.
      </p>

      <button
        type="button"
        onClick={goBackToLogin}
        className={`${primaryButtonClass} mt-6`}
        style={{ background: theme.base }}
      >
        <ArrowLeft size={16} />
        Back to Login
      </button>
    </div>
  );

  const renderStep = () => {
    switch (step) {
      case 'email':
        return renderEmailStep();
      case 'otp':
        return renderOtpStep();
      case 'reset':
        return renderResetStep();
      case 'done':
        return renderDoneStep();
      default:
        return renderEmailStep();
    }
  };

  return (
    <div className="smartpdm-auth-page flex min-h-screen flex-col bg-[#f7f4ec]" style={{ minHeight: '100dvh' }}>


      <LandingInstitutionHeader theme={theme} />

      <main className="smartpdm-auth-main relative flex min-h-0 flex-1 overflow-x-hidden overflow-y-auto">


        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <img
            src={pdmFacade}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center opacity-[0.58] saturate-[0.88]"
          />
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(90deg, rgba(255,252,244,0.76) 0%, rgba(255,249,236,0.69) 36%, rgba(255,249,238,0.62) 63%, ${theme.soft}a8 100%)`,
            }}
          />
          <div
            className="absolute inset-0 opacity-[0.11]"
            style={{
              backgroundImage: `radial-gradient(circle, ${theme.base}38 1px, transparent 1.2px)`,
              backgroundSize: '24px 24px',
              maskImage: 'linear-gradient(90deg, black 0%, black 16%, transparent 42%, transparent 100%)',
            }}
          />
        </div>

        <div
          className="smartpdm-auth-ribbon pointer-events-none absolute inset-y-0 left-0 hidden w-[21vw] min-w-[175px] max-w-[305px] lg:block"
          aria-hidden="true"
        >
          <div
            className="absolute inset-y-0 left-0 w-full opacity-[0.98]"
            style={{
              background: `linear-gradient(135deg, ${theme.dark} 0%, ${theme.base} 72%, ${theme.accent} 100%)`,
              clipPath: 'polygon(0 0, 58% 0, 100% 50%, 58% 100%, 0 100%)',
            }}
          />
          <div
            className="absolute inset-y-0 left-[43%] w-[22%] opacity-100"
            style={{
              background: theme.accent,
              clipPath: 'polygon(0 0, 40% 0, 100% 50%, 40% 100%, 0 100%, 60% 50%)',
            }}
          />
          <div
            className="absolute inset-y-0 left-[55%] w-[10%] bg-[#fff9ec]/90"
            style={{ clipPath: 'polygon(0 0, 24% 0, 100% 50%, 24% 100%, 0 100%, 74% 50%)' }}
          />
        </div>

        <HexCluster
          className="pointer-events-none absolute left-[3%] top-[6%] hidden h-[190px] w-[240px] opacity-70 lg:block"
          color={theme.accent}
        />
        <HexCluster
          className="pointer-events-none absolute -bottom-10 right-[-24px] hidden h-[210px] w-[260px] opacity-55 lg:block"
          color={theme.base}
          mirrored
        />

        <div className="smartpdm-auth-grid relative z-10 mx-auto grid w-full max-w-[92rem] flex-1 items-center gap-8 px-4 py-8 sm:px-6 sm:py-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_450px] lg:gap-10 lg:px-10 lg:py-12 xl:gap-14">
          <section className="smartpdm-auth-copy hidden min-w-0 pl-[15vw] lg:block xl:pl-[13vw]">
            <div className="max-w-[560px]">
              <p
                className="text-xs font-black uppercase tracking-[0.2em]"
                style={{ color: theme.base }}
              >
                Pambayang Dalubhasaan ng Marilao
              </p>
              <h2
                className="mt-3 max-w-[520px] text-4xl font-black leading-[1.02] tracking-[-0.035em] xl:text-5xl"
                style={{ color: theme.dark }}
              >
                SMaRT-PDM: Scholarship System
              </h2>

              <div className="mt-7 flex items-center gap-3" aria-hidden="true">
                <span className="h-px w-16" style={{ background: theme.accent }} />
                <span className="h-2 w-2 rounded-full" style={{ background: theme.accent }} />
                <span className="h-px w-24" style={{ background: `${theme.base}55` }} />
              </div>
            </div>
          </section>

          <section
            className="smartpdm-auth-card mx-auto w-full max-w-[430px] justify-self-center lg:mx-0 lg:justify-self-end"
            aria-labelledby="recovery-heading"
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
                    <KeyRound size={17} strokeWidth={2.1} />
                  </span>
                  <div className="min-w-0">
                    <p
                      id="recovery-heading"
                      className="text-2xl font-black tracking-[-0.025em] text-stone-900 sm:text-[28px]"
                    >
                      {cardTitle}
                    </p>
                    <span
                      className="mt-2 block h-0.5 w-10 rounded-full"
                      style={{ background: theme.accent }}
                      aria-hidden="true"
                    />
                  </div>
                </div>

                {renderStep()}

                <span className="sr-only" role="status" aria-live="polite">
                  {loadingAction === 'send'
                    ? 'Sending Admin verification code. Please wait.'
                    : loadingAction === 'resend'
                      ? 'Resending Admin verification code. Please wait.'
                      : loadingAction === 'verify'
                        ? 'Verifying Admin recovery code. Please wait.'
                        : loadingAction === 'reset'
                          ? 'Updating Admin password. Please wait.'
                          : ''}
                </span>

                {step !== 'done' ? (
                  <button
                    type="button"
                    onClick={goBackToLogin}
                    disabled={loading}
                    className="mt-4 flex h-[44px] w-full items-center justify-center gap-2 rounded-xl border bg-white text-sm font-bold text-stone-700 transition hover:bg-stone-50 hover:text-stone-900 disabled:cursor-wait disabled:opacity-60"
                    style={{ borderColor: `${theme.base}28` }}
                  >
                    <ArrowLeft size={16} />
                    Back to Login
                  </button>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
