import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Mail,
    KeyRound,
    Eye,
    EyeOff,
    ShieldCheck,
    RefreshCw,
    ArrowLeft,
    CheckCircle2,
    GraduationCap,
    BookOpen,
    Award,
    AlertCircle,
} from 'lucide-react';
import pdmLogo from '../assets/pdm-logo.png';
import { buildApiUrl } from '@/api';

const SB_BASE = '#7c4a2e';
const SB_SUB = '#d4a98a';
const ADMIN_LOGIN_PATH = '/admin/login';

const START_RESET_URL = buildApiUrl('/api/auth/admin/forgot-password/start');
const VERIFY_RESET_URL = buildApiUrl('/api/auth/admin/forgot-password/verify');
const FINALIZE_RESET_URL = buildApiUrl('/api/auth/admin/forgot-password/reset');

const FEATURES = [
    { icon: GraduationCap, label: 'Scholarship Management' },
    { icon: BookOpen, label: 'Application Review' },
    { icon: Award, label: 'Financial Assistance' },
];

const inputClass =
    'w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-800/20 focus:border-orange-800 transition-all disabled:opacity-70';

const buttonClass =
    'w-full h-12 rounded-xl text-white font-bold text-sm shadow-lg transition-all active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2';

const otpInputClass =
    'w-11 h-11 text-center text-sm font-semibold rounded-xl border border-stone-200 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-800/20 focus:border-orange-800 transition-all';

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
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

async function requestJson(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || 'Request failed. Please try again.');
    }

    return data;
}

export default function ForgotPassword() {
    const navigate = useNavigate();
    const otpRefs = useRef([]);

    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');

    const buttonStyle = {
        background: SB_BASE,
        boxShadow: loading ? 'none' : `0 8px 20px -6px ${SB_BASE}80`,
    };

    const normalizedEmail = normalizeEmail(email);
    const otpValue = otp.join('');
    const otpComplete = otpValue.length === 6;
    const passwordChecks = useMemo(() => getPasswordChecks(newPassword), [newPassword]);
    const passwordStrong = passwordChecks.every((item) => item.valid);
    const passwordsMatch = newPassword && confirmPass && newPassword === confirmPass;

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

    const startResendTimer = () => {
        setResendTimer(60);
    };

    const sendOtpRequest = async () => {
        clearFeedback();
        setLoading(true);

        try {
            await requestJson(START_RESET_URL, { email: normalizedEmail });
            setStep('otp');
            setOtp(['', '', '', '', '', '']);
            setResetToken('');
            setNotice('Recovery code sent. Check the admin email inbox.');
            startResendTimer();
            window.setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } catch (err) {
            setError(err.message || 'Unable to send recovery code.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendOtp = async (event) => {
        event.preventDefault();
        await sendOtpRequest();
    };

    const handleVerifyOtp = async (event) => {
        event.preventDefault();
        clearFeedback();
        setLoading(true);

        try {
            const data = await requestJson(VERIFY_RESET_URL, {
                email: normalizedEmail,
                otp: otpValue,
            });

            setResetToken(data.resetToken || '');
            setStep('reset');
            setNotice('Code verified. Set a new password.');
        } catch (err) {
            setError(err.message || 'Invalid or expired recovery code.');
        } finally {
            setLoading(false);
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

        setLoading(true);

        try {
            await requestJson(FINALIZE_RESET_URL, {
                email: normalizedEmail,
                resetToken,
                newPassword,
            });

            setStep('done');
            setEmail('');
            setOtp(['', '', '', '', '', '']);
            setResetToken('');
            setNewPassword('');
            setConfirmPass('');
        } catch (err) {
            setError(err.message || 'Unable to reset password.');
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (loading || resendTimer > 0) return;
        await sendOtpRequest();
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
        window.setTimeout(() => otpRefs.current[nextFocusIndex]?.focus(), 0);
    };

    const handleOtpKeyDown = (event, index) => {
        if (event.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const goBackToSignIn = () => {
        navigate(ADMIN_LOGIN_PATH, { replace: true });
    };

    const changeEmail = () => {
        clearFeedback();
        setStep('email');
        setOtp(['', '', '', '', '', '']);
        setResetToken('');
        setResendTimer(0);
    };

    const renderFeedback = () => (
        <>
            {error && (
                <div className="mb-5 flex gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs font-medium text-red-700">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {notice && !error && (
                <div className="mb-5 rounded-xl border border-green-100 bg-green-50 p-3 text-xs font-medium text-green-700">
                    {notice}
                </div>
            )}
        </>
    );

    const renderBrandingPanel = () => (
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
                    <img src={pdmLogo} alt="Logo" className="w-16 h-16 object-contain block mx-auto" />
                </div>
                <div>
                    <p className="text-white text-xs font-bold tracking-wide uppercase">PDM · OSFA</p>
                    <p className="text-[10px]" style={{ color: SB_SUB }}>
                        Admin Portal
                    </p>
                </div>
            </div>

            <div className="relative z-10 px-12">
                <h2 className="text-4xl font-bold leading-tight mb-10 text-white" style={{ fontFamily: 'serif' }}>
                    Scholarship <br />
                    <span className="text-yellow-400">Monitoring System</span>
                </h2>

                <div className="space-y-3 max-w-xs">
                    {FEATURES.map(({ icon: Icon, label }) => (
                        <div key={label} className="flex items-center gap-3 rounded-xl px-4 py-3 bg-white/5 border border-white/10">
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
    );

    const renderEmailStep = () => (
        <>
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-2 text-orange-800">
                    <Mail size={18} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Account Recovery</span>
                </div>
                <h1 className="text-3xl font-bold text-stone-900">Forgot password?</h1>
                <p className="text-stone-500 text-sm mt-1">Enter the authorized admin email to receive a verification code.</p>
            </div>

            {renderFeedback()}

            <form onSubmit={handleSendOtp} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-700 ml-1">Email Address</label>
                    <input
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="admin@pdm.edu.ph"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className={inputClass}
                        disabled={loading}
                    />
                </div>

                <button type="submit" disabled={loading || !normalizedEmail} className={buttonClass} style={buttonStyle}>
                    {loading ? 'Sending code...' : 'Send Recovery Code'}
                </button>
            </form>
        </>
    );

    const renderOtpStep = () => (
        <>
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-2 text-orange-800">
                    <KeyRound size={18} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Verification</span>
                </div>
                <h1 className="text-3xl font-bold text-stone-900">Enter code</h1>
                <p className="text-stone-500 text-sm mt-1">
                    Code sent to <span className="font-semibold text-stone-800">{normalizedEmail}</span>
                </p>
            </div>

            {renderFeedback()}

            <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="flex gap-2 justify-between">
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            ref={(element) => {
                                otpRefs.current[index] = element;
                            }}
                            id={`otp-${index}`}
                            type="text"
                            inputMode="numeric"
                            autoComplete={index === 0 ? 'one-time-code' : 'off'}
                            maxLength={1}
                            value={digit}
                            onChange={(event) => handleOtpChange(event.target.value, index)}
                            onPaste={handleOtpPaste}
                            onKeyDown={(event) => handleOtpKeyDown(event, index)}
                            className={otpInputClass}
                            disabled={loading}
                        />
                    ))}
                </div>

                <button type="submit" disabled={!otpComplete || loading} className={buttonClass} style={buttonStyle}>
                    {loading ? 'Verifying...' : 'Verify Code'}
                </button>

                <div className="text-center">
                    {resendTimer > 0 ? (
                        <p className="text-xs text-stone-400">Resend in {resendTimer}s</p>
                    ) : (
                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={loading}
                            className="text-xs font-bold text-orange-800 hover:underline flex items-center gap-1.5 mx-auto disabled:opacity-60"
                        >
                            <RefreshCw size={14} />
                            Resend Code
                        </button>
                    )}
                </div>
            </form>
        </>
    );

    const renderResetStep = () => (
        <>
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-2 text-orange-800">
                    <ShieldCheck size={18} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Security</span>
                </div>
                <h1 className="text-3xl font-bold text-stone-900">New password</h1>
                <p className="text-stone-500 text-sm mt-1">Use a strong password for the admin account.</p>
            </div>

            {renderFeedback()}

            <form onSubmit={handleReset} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-700 ml-1">New Password</label>
                    <div className="relative">
                        <input
                            type={showNew ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            className={`${inputClass} pr-12`}
                            required
                            autoComplete="new-password"
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowNew((prev) => !prev)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                        >
                            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-1 rounded-xl bg-stone-50 p-3">
                    {passwordChecks.map((item) => (
                        <div key={item.label} className={`text-[11px] font-medium ${item.valid ? 'text-green-700' : 'text-stone-400'}`}>
                            {item.valid ? '✓' : '•'} {item.label}
                        </div>
                    ))}
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-700 ml-1">Confirm Password</label>
                    <div className="relative">
                        <input
                            type={showConfirm ? 'text' : 'password'}
                            value={confirmPass}
                            onChange={(event) => setConfirmPass(event.target.value)}
                            className={`${inputClass} pr-12`}
                            required
                            autoComplete="new-password"
                            disabled={loading}
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm((prev) => !prev)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                        >
                            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    {confirmPass && !passwordsMatch && <p className="ml-1 text-[11px] font-medium text-red-600">Passwords do not match.</p>}
                </div>

                <button type="submit" disabled={!passwordStrong || !passwordsMatch || loading || !resetToken} className={buttonClass} style={buttonStyle}>
                    {loading ? 'Saving...' : 'Set New Password'}
                </button>
            </form>
        </>
    );

    const renderDoneStep = () => (
        <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-green-50 border border-green-100 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-stone-900">Password reset</h1>
            <p className="text-stone-500 text-sm mt-2 mb-8">You can now sign in with your new admin password.</p>
            <button onClick={goBackToSignIn} className={buttonClass} style={{ background: SB_BASE }}>
                Back to Sign In
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
        <div className="min-h-screen flex bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
            {renderBrandingPanel()}

            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                <div className="w-full max-w-[380px]">
                    {renderStep()}

                    {step !== 'done' && (
                        <button
                            type="button"
                            onClick={step === 'email' ? goBackToSignIn : changeEmail}
                            className="mt-8 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-stone-400 hover:text-stone-900 mx-auto"
                        >
                            <ArrowLeft size={14} />
                            {step === 'email' ? 'Back to sign in' : 'Change email'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
