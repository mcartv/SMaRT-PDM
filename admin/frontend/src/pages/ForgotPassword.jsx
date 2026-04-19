import React, { useState } from 'react';
import { useNavigate } from 'react-router';
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
} from 'lucide-react';
import pdmLogo from '../assets/pdm-logo.png';

const SB_BASE = '#7c4a2e';
const SB_SUB = '#d4a98a';

const FEATURES = [
    { icon: GraduationCap, label: 'Scholarship Management' },
    { icon: BookOpen, label: 'Application Review' },
    { icon: Award, label: 'Financial Assistance' },
];

const inputClass =
    'w-full h-11 px-4 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-orange-800/20 focus:border-orange-800 transition-all';

const buttonClass =
    'w-full h-12 rounded-xl text-white font-bold text-sm shadow-lg transition-all active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2';

const otpInputClass =
    'w-11 h-11 text-center text-sm font-semibold rounded-xl border border-stone-200 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-orange-800/20 focus:border-orange-800 transition-all';

export default function ForgotPassword() {
    const navigate = useNavigate();

    const [step, setStep] = useState('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [resendTimer, setResendTimer] = useState(0);

    const buttonStyle = {
        background: SB_BASE,
        boxShadow: loading ? 'none' : `0 8px 20px -6px ${SB_BASE}80`,
    };

    const fakeAsync = (cb, ms = 1200) => {
        setLoading(true);
        setTimeout(() => {
            setLoading(false);
            cb();
        }, ms);
    };

    const startResendTimer = () => {
        setResendTimer(60);
        const interval = setInterval(() => {
            setResendTimer((time) => {
                if (time <= 1) {
                    clearInterval(interval);
                    return 0;
                }
                return time - 1;
            });
        }, 1000);
    };

    const handleSendOtp = (e) => {
        e.preventDefault();
        fakeAsync(() => {
            setStep('otp');
            startResendTimer();
        });
    };

    const handleVerifyOtp = (e) => {
        e.preventDefault();
        fakeAsync(() => setStep('reset'));
    };

    const handleReset = (e) => {
        e.preventDefault();
        if (newPassword !== confirmPass) return;
        fakeAsync(() => setStep('done'), 1000);
    };

    const handleOtpChange = (value, index) => {
        const digit = value.replace(/\D/g, '').slice(0, 1);
        const next = [...otp];
        next[index] = digit;
        setOtp(next);

        if (digit && index < 5) {
            document.getElementById(`otp-${index + 1}`)?.focus();
        }
    };

    const handleOtpKeyDown = (e, index) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            document.getElementById(`otp-${index - 1}`)?.focus();
        }
    };

    const otpComplete = otp.every((digit) => digit !== '');
    const passwordsMatch = newPassword && confirmPass && newPassword === confirmPass;

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
                    <img
                        src={pdmLogo}
                        alt="Logo"
                        className="w-16 h-16 object-contain block mx-auto"
                    />
                </div>
                <div>
                    <p className="text-white text-xs font-bold tracking-wide uppercase">PDM · OSFA</p>
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
    );

    const renderEmailStep = () => (
        <>
            <div className="mb-8">
                <div className="flex items-center gap-2 mb-2 text-orange-800">
                    <Mail size={18} />
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                        Recovery
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-stone-900">Forgot password?</h1>
                <p className="text-stone-500 text-sm mt-1">
                    Enter your OSFA email to receive a verification code
                </p>
            </div>

            <form onSubmit={handleSendOtp} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-700 ml-1">
                        Email Address
                    </label>
                    <input
                        type="email"
                        required
                        placeholder="admin@pdm.edu.ph"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading || !email}
                    className={buttonClass}
                    style={buttonStyle}
                >
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
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                        Verification
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-stone-900">Enter code</h1>
                <p className="text-stone-500 text-sm mt-1">
                    Code sent to <span className="font-semibold text-stone-800">{email}</span>
                </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-6">
                <div className="flex gap-2 justify-between">
                    {otp.map((digit, index) => (
                        <input
                            key={index}
                            id={`otp-${index}`}
                            type="text"
                            maxLength={1}
                            value={digit}
                            onChange={(e) => handleOtpChange(e.target.value, index)}
                            onKeyDown={(e) => handleOtpKeyDown(e, index)}
                            className={otpInputClass}
                        />
                    ))}
                </div>

                <button
                    type="submit"
                    disabled={!otpComplete || loading}
                    className={buttonClass}
                    style={buttonStyle}
                >
                    {loading ? 'Verifying...' : 'Verify Code'}
                </button>

                <div className="text-center">
                    {resendTimer > 0 ? (
                        <p className="text-xs text-stone-400">Resend in {resendTimer}s</p>
                    ) : (
                        <button
                            type="button"
                            onClick={startResendTimer}
                            className="text-xs font-bold text-orange-800 hover:underline flex items-center gap-1.5 mx-auto"
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
                    <span className="text-[10px] font-bold uppercase tracking-widest">
                        Security
                    </span>
                </div>
                <h1 className="text-3xl font-bold text-stone-900">New password</h1>
            </div>

            <form onSubmit={handleReset} className="space-y-5">
                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-700 ml-1">
                        New Password
                    </label>
                    <div className="relative">
                        <input
                            type={showNew ? 'text' : 'password'}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className={inputClass}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowNew((prev) => !prev)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400"
                        >
                            {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-700 ml-1">
                        Confirm Password
                    </label>
                    <div className="relative">
                        <input
                            type={showConfirm ? 'text' : 'password'}
                            value={confirmPass}
                            onChange={(e) => setConfirmPass(e.target.value)}
                            className={inputClass}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowConfirm((prev) => !prev)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400"
                        >
                            {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={!passwordsMatch || loading}
                    className={buttonClass}
                    style={buttonStyle}
                >
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
            <h1 className="text-3xl font-bold text-stone-900">Password reset!</h1>
            <p className="text-stone-500 text-sm mt-2 mb-8">
                You can now sign in with your new password
            </p>
            <button
                onClick={() => navigate('/')}
                className={buttonClass}
                style={{ background: SB_BASE }}
            >
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
        <div
            className="min-h-screen flex bg-white"
            style={{ fontFamily: "'Inter', sans-serif" }}
        >
            {renderBrandingPanel()}

            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                <div className="w-full max-w-[380px]">
                    {renderStep()}

                    {step !== 'done' && (
                        <button
                            onClick={() => (step === 'email' ? navigate('/') : setStep('email'))}
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