import { useState, useRef } from 'react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Avatar, AvatarFallback } from '../ui/avatar';
import {
    User, Mail, Phone, MapPin, Lock, Eye, EyeOff,
    Save, Check, Camera, Shield, Clock, Activity,
    LogOut, Key,
} from 'lucide-react';

// ─── Palette ─────────────────────────────────────────────────
const C = {
    brown: '#5c2d0e',
    brownMid: '#7c4a2e',
    brownLight: '#92500f',
    amber: '#d97706',
    amberSoft: '#FFF7ED',
    yellowSoft: '#fef3c7',
    sand: '#fdf6ec',
    green: '#16a34a',
    greenSoft: '#F0FDF4',
    red: '#dc2626',
    redSoft: '#FEF2F2',
    border: '#e8d5b7',
    muted: '#a0785a',
    text: '#3b1f0a',
    bg: '#faf7f2',
    white: '#FFFFFF',
} as const;

const BD = '1px solid ' + C.border;

const CARD: React.CSSProperties = {
    background: C.white,
    border: BD,
    borderRadius: 16,
    boxShadow: '0 1px 3px rgba(107,58,31,0.07)',
};

// ─── Mock session log ─────────────────────────────────────────
const SESSION_LOG = [
    { device: 'Chrome · Windows 11', location: 'Marilao, Bulacan', time: 'Mar 22, 2026 · 10:14 AM', current: true },
    { device: 'Chrome · Android (Mobile)', location: 'Marilao, Bulacan', time: 'Mar 21, 2026 · 08:30 AM', current: false },
    { device: 'Firefox · Windows 11', location: 'Marilao, Bulacan', time: 'Mar 19, 2026 · 02:15 PM', current: false },
];

const ACTIVITY_LOG = [
    { action: 'Approved 3 applications', time: 'Mar 22, 2026 · 10:14 AM' },
    { action: 'Published announcement', time: 'Mar 21, 2026 · 03:22 PM' },
    { action: 'Updated TDP scholarship criteria', time: 'Mar 20, 2026 · 09:00 AM' },
    { action: 'Generated UAQTEA enrollment report', time: 'Mar 19, 2026 · 11:45 AM' },
    { action: 'Verified 6 RO submissions', time: 'Mar 18, 2026 · 04:10 PM' },
];

// ─── Helpers ─────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5"
            style={{ color: C.muted }}>
            {children}
        </label>
    );
}

function SectionCard({ title, icon: Icon, children }: {
    title: string; icon: React.FC<any>; children: React.ReactNode;
}) {
    return (
        <div style={CARD} className="overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5"
                style={{ borderBottom: BD, background: C.yellowSoft }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: C.amberSoft }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: C.brownLight }} />
                </div>
                <p className="text-xs font-bold" style={{ color: C.text }}>{title}</p>
            </div>
            <div className="p-5">{children}</div>
        </div>
    );
}

// ─── Component ───────────────────────────────────────────────
export default function AdminProfile() {
    // Personal info
    const [firstName, setFirstName] = useState('Carmelita');
    const [lastName, setLastName] = useState('Dela Cruz');
    const [email, setEmail] = useState('cdelacruz@pdm.edu.ph');
    const [phone, setPhone] = useState('+63 917 123 4567');
    const [position, setPosition] = useState('OSFA Administrator');
    const [department, setDepartment] = useState('Office for Scholarship and Financial Assistance');
    const [address, setAddress] = useState('Marilao, Bulacan');
    const [bio, setBio] = useState('Manages scholarship applications and financial assistance programs at PDM.');

    // Password
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [pwError, setPwError] = useState('');

    // Save states
    const [profileSaved, setProfileSaved] = useState(false);
    const [pwSaved, setPwSaved] = useState(false);

    function handleProfileSave() {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2500);
    }

    function handlePasswordSave() {
        if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
        if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
        setPwError('');
        setCurrentPw(''); setNewPw(''); setConfirmPw('');
        setPwSaved(true);
        setTimeout(() => setPwSaved(false), 2500);
    }

    // Password strength
    const pwStrength = (() => {
        if (!newPw) return null;
        let score = 0;
        if (newPw.length >= 8) score++;
        if (newPw.length >= 12) score++;
        if (/[A-Z]/.test(newPw)) score++;
        if (/[0-9]/.test(newPw)) score++;
        if (/[^a-zA-Z0-9]/.test(newPw)) score++;
        if (score <= 1) return { label: 'Weak', color: C.red, width: '25%' };
        if (score <= 3) return { label: 'Fair', color: C.amber, width: '55%' };
        if (score <= 4) return { label: 'Good', color: C.green, width: '78%' };
        return { label: 'Strong', color: C.green, width: '100%' };
    })();

    return (
        <div className="space-y-5 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>

            {/* ── Header ── */}
            <div>
                <h1 className="text-2xl font-bold" style={{ color: C.text }}>My Profile</h1>
                <p className="text-sm mt-0.5" style={{ color: C.muted }}>Manage your account information and security settings</p>
            </div>

            {/* ── Profile hero card ── */}
            <div style={CARD} className="p-6">
                <div className="flex items-center gap-5">

                    {/* Avatar with upload hint */}
                    <div className="relative shrink-0">
                        <Avatar className="w-20 h-20">
                            <AvatarFallback
                                className="text-xl font-bold text-white"
                                style={{ background: C.brown }}>
                                CD
                            </AvatarFallback>
                        </Avatar>
                        <div
                            className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                            style={{ background: 'rgba(92,45,14,0.6)' }}>
                            <Camera className="w-5 h-5 text-white" />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="text-xl font-bold" style={{ color: C.text }}>
                            {firstName} {lastName}
                        </p>
                        <p className="text-sm mt-0.5" style={{ color: C.muted }}>{position}</p>
                        <p className="text-xs mt-0.5" style={{ color: C.muted }}>{department}</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                                style={{ background: C.greenSoft, color: C.green }}>
                                <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
                                Active
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                                style={{ background: C.yellowSoft, color: C.brownLight }}>
                                <Shield className="w-3 h-3" />
                                Super Admin
                            </span>
                        </div>
                    </div>

                    {/* Quick stats */}
                    <div className="hidden lg:grid grid-cols-3 gap-4 shrink-0">
                        {[
                            { label: 'Apps Processed', value: '284' },
                            { label: 'ROs Verified', value: '91' },
                            { label: 'Reports Generated', value: '18' },
                        ].map(s => (
                            <div key={s.label} className="text-center px-4 py-3 rounded-xl" style={{ background: C.sand }}>
                                <p className="text-xl font-bold" style={{ color: C.brown }}>{s.value}</p>
                                <p className="text-[10px] font-medium mt-0.5" style={{ color: C.muted }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Two-column grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                {/* Personal Information */}
                <SectionCard title="Personal Information" icon={User}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <FieldLabel>First Name</FieldLabel>
                                <Input className="h-9 text-sm rounded-xl bg-gray-50"
                                    value={firstName} onChange={e => setFirstName(e.target.value)} />
                            </div>
                            <div>
                                <FieldLabel>Last Name</FieldLabel>
                                <Input className="h-9 text-sm rounded-xl bg-gray-50"
                                    value={lastName} onChange={e => setLastName(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <FieldLabel>Position / Title</FieldLabel>
                            <Input className="h-9 text-sm rounded-xl bg-gray-50"
                                value={position} onChange={e => setPosition(e.target.value)} />
                        </div>
                        <div>
                            <FieldLabel>Department</FieldLabel>
                            <Input className="h-9 text-sm rounded-xl bg-gray-50"
                                value={department} onChange={e => setDepartment(e.target.value)} />
                        </div>
                        <div>
                            <FieldLabel>Address</FieldLabel>
                            <Input className="h-9 text-sm rounded-xl bg-gray-50"
                                value={address} onChange={e => setAddress(e.target.value)} />
                        </div>
                        <div>
                            <FieldLabel>Short Bio <span className="normal-case font-normal">(optional)</span></FieldLabel>
                            <Textarea className="text-sm rounded-xl bg-gray-50 resize-none" rows={3}
                                value={bio} onChange={e => setBio(e.target.value)} />
                        </div>
                    </div>
                </SectionCard>

                {/* Contact Information */}
                <SectionCard title="Contact Information" icon={Mail}>
                    <div className="space-y-4">
                        <div>
                            <FieldLabel>Email Address</FieldLabel>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: C.muted }} />
                                <Input className="h-9 text-sm rounded-xl bg-gray-50 pl-9"
                                    type="email" value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <FieldLabel>Phone Number</FieldLabel>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: C.muted }} />
                                <Input className="h-9 text-sm rounded-xl bg-gray-50 pl-9"
                                    value={phone} onChange={e => setPhone(e.target.value)} />
                            </div>
                        </div>
                        <div>
                            <FieldLabel>Location</FieldLabel>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: C.muted }} />
                                <Input className="h-9 text-sm rounded-xl bg-gray-50 pl-9"
                                    value={address} onChange={e => setAddress(e.target.value)} />
                            </div>
                        </div>

                        {/* Account info (read-only) */}
                        <div className="pt-4 space-y-3" style={{ borderTop: BD }}>
                            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Account Details</p>
                            {[
                                { label: 'Username', value: 'cdelacruz.osfa' },
                                { label: 'Role', value: 'Super Admin' },
                                { label: 'Member Since', value: 'August 2023' },
                                { label: 'Last Login', value: 'Mar 22, 2026 · 10:14 AM' },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex items-center justify-between">
                                    <span className="text-xs" style={{ color: C.muted }}>{label}</span>
                                    <span className="text-xs font-semibold" style={{ color: C.text }}>{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </SectionCard>
            </div>

            {/* Save profile button */}
            <div className="flex justify-end">
                <button
                    onClick={handleProfileSave}
                    className="flex items-center gap-1.5 px-6 h-10 rounded-xl text-sm font-bold text-white transition-all"
                    style={{ background: profileSaved ? C.green : C.brown }}
                >
                    {profileSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {profileSaved ? 'Profile Saved!' : 'Save Profile'}
                </button>
            </div>

            {/* ── Change Password ── */}
            <SectionCard title="Change Password" icon={Lock}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="space-y-4">

                        {/* Current password */}
                        <div>
                            <FieldLabel>Current Password</FieldLabel>
                            <div className="relative">
                                <Input
                                    className="h-9 text-sm rounded-xl bg-gray-50 pr-10"
                                    type={showCurrent ? 'text' : 'password'}
                                    placeholder="Enter current password"
                                    value={currentPw}
                                    onChange={e => setCurrentPw(e.target.value)}
                                />
                                <button type="button" onClick={() => setShowCurrent(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                                    style={{ color: C.muted }}>
                                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {/* New password */}
                        <div>
                            <FieldLabel>New Password</FieldLabel>
                            <div className="relative">
                                <Input
                                    className="h-9 text-sm rounded-xl bg-gray-50 pr-10"
                                    type={showNew ? 'text' : 'password'}
                                    placeholder="Enter new password"
                                    value={newPw}
                                    onChange={e => setNewPw(e.target.value)}
                                />
                                <button type="button" onClick={() => setShowNew(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                                    style={{ color: C.muted }}>
                                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* Strength bar */}
                            {pwStrength && (
                                <div className="mt-2">
                                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: C.border }}>
                                        <div className="h-1.5 rounded-full transition-all"
                                            style={{ width: pwStrength.width, background: pwStrength.color }} />
                                    </div>
                                    <p className="text-[11px] mt-1 font-semibold" style={{ color: pwStrength.color }}>
                                        {pwStrength.label} password
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Confirm password */}
                        <div>
                            <FieldLabel>Confirm New Password</FieldLabel>
                            <div className="relative">
                                <Input
                                    className="h-9 text-sm rounded-xl bg-gray-50 pr-10"
                                    type={showConfirm ? 'text' : 'password'}
                                    placeholder="Re-enter new password"
                                    value={confirmPw}
                                    onChange={e => setConfirmPw(e.target.value)}
                                />
                                <button type="button" onClick={() => setShowConfirm(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                                    style={{ color: C.muted }}>
                                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {confirmPw && newPw && (
                                <p className="text-[11px] mt-1 font-semibold"
                                    style={{ color: newPw === confirmPw ? C.green : C.red }}>
                                    {newPw === confirmPw ? '✓ Passwords match' : '✗ Passwords do not match'}
                                </p>
                            )}
                        </div>

                        {pwError && (
                            <p className="text-xs font-medium px-3 py-2 rounded-xl"
                                style={{ background: C.redSoft, color: C.red }}>
                                {pwError}
                            </p>
                        )}

                        <button
                            onClick={handlePasswordSave}
                            className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold text-white transition-all"
                            style={{ background: pwSaved ? C.green : C.brown }}
                        >
                            {pwSaved ? <Check className="w-3.5 h-3.5" /> : <Key className="w-3.5 h-3.5" />}
                            {pwSaved ? 'Password Updated!' : 'Update Password'}
                        </button>
                    </div>

                    {/* Password requirements */}
                    <div className="rounded-xl p-4 space-y-2.5" style={{ background: C.sand }}>
                        <p className="text-xs font-bold mb-3" style={{ color: C.text }}>Password Requirements</p>
                        {[
                            { rule: 'At least 8 characters', met: newPw.length >= 8 },
                            { rule: 'At least one uppercase letter', met: /[A-Z]/.test(newPw) },
                            { rule: 'At least one number', met: /[0-9]/.test(newPw) },
                            { rule: 'At least one special character', met: /[^a-zA-Z0-9]/.test(newPw) },
                            { rule: '12+ characters for Strong rating', met: newPw.length >= 12 },
                        ].map(({ rule, met }) => (
                            <div key={rule} className="flex items-center gap-2">
                                <div className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                                    style={{ background: met ? C.greenSoft : C.border }}>
                                    {met && <Check className="w-2.5 h-2.5" style={{ color: C.green }} />}
                                </div>
                                <span className="text-xs" style={{ color: met ? C.green : C.muted }}>{rule}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </SectionCard>

            {/* ── Active Sessions ── */}
            <SectionCard title="Active Sessions" icon={Clock}>
                <div className="space-y-3">
                    {SESSION_LOG.map((s, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl"
                            style={{ background: s.current ? C.yellowSoft : C.sand, border: BD }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                                    style={{ background: s.current ? C.amberSoft : C.white }}>
                                    <Shield className="w-4 h-4" style={{ color: s.current ? C.brownLight : C.muted }} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold" style={{ color: C.text }}>{s.device}</p>
                                    <p className="text-[11px]" style={{ color: C.muted }}>{s.location} · {s.time}</p>
                                </div>
                            </div>
                            {s.current ? (
                                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                                    style={{ background: C.greenSoft, color: C.green }}>
                                    Current
                                </span>
                            ) : (
                                <button className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-colors"
                                    style={{ borderColor: '#fecaca', color: C.red, background: C.white }}
                                    onMouseEnter={e => (e.currentTarget.style.background = C.redSoft)}
                                    onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
                                    <LogOut className="w-3 h-3" /> Revoke
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* ── Recent Activity ── */}
            <SectionCard title="Recent Activity" icon={Activity}>
                <div className="space-y-1">
                    {ACTIVITY_LOG.map((a, i) => (
                        <div key={i} className="flex items-center justify-between py-2.5"
                            style={{ borderBottom: i < ACTIVITY_LOG.length - 1 ? BD : 'none' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: C.amber }} />
                                <span className="text-xs" style={{ color: C.text }}>{a.action}</span>
                            </div>
                            <span className="text-[11px] shrink-0 ml-4" style={{ color: C.muted }}>{a.time}</span>
                        </div>
                    ))}
                </div>
            </SectionCard>

        </div>
    );
}