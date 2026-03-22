import { useState, useEffect } from 'react';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
    Building2, BookOpen, GraduationCap, SlidersHorizontal,
    Users, Cpu, ClipboardList, Plus, Edit, Trash2,
    CheckSquare, Square, Activity, FileSearch,
    ToggleLeft, ToggleRight, Check, Bell, Globe,
    Lock, Mail, Database, RefreshCw, Save, Moon, Sun, Monitor,
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

// ─── Nav tabs ─────────────────────────────────────────────────
const TABS = [
    { key: 'general', label: 'General', icon: SlidersHorizontal },
    { key: 'benefactors', label: 'Benefactors', icon: Building2 },
    { key: 'scholarship', label: 'Scholarship', icon: GraduationCap },
    { key: 'courses', label: 'Courses', icon: BookOpen },
    { key: 'users', label: 'User Management', icon: Users },
    { key: 'audit', label: 'Audit Trail', icon: ClipboardList },
    { key: 'system', label: 'System & OCR', icon: Cpu },
] as const;
type TabKey = typeof TABS[number]['key'];

// ─── Mock data ────────────────────────────────────────────────
const INIT_BENEFACTORS = [
    { id: 1, name: 'Kaizen Corporation', program: 'BSIT / BSTM', slots: 100, gwa: 1.75, status: 'published', financial: 5000 },
    { id: 2, name: 'Genmart Holdings', program: 'BSHM / BSOA', slots: 50, gwa: 1.75, status: 'published', financial: 4500 },
    { id: 3, name: 'Food Crafters Inc.', program: 'All Programs', slots: 30, gwa: 2.00, status: 'published', financial: 4000 },
    { id: 4, name: 'BC Packaging Corp.', program: 'BECED / BTLED', slots: 15, gwa: 1.75, status: 'draft', financial: 3500 },
];

const INIT_SCHOLARSHIPS = [
    { id: 'tes', name: 'TES – Tertiary Education Subsidy', minGwa: 2.50, levels: ['All'], status: 'published' },
    { id: 'tdp', name: 'TDP – Tulong Dunong Program', minGwa: 1.75, levels: ['1st', '2nd'], status: 'published' },
    { id: 'private', name: 'Private Financial Assistance', minGwa: 2.00, levels: ['All'], status: 'published' },
];

const INIT_COURSES = [
    { id: 1, code: 'BSIT', name: 'BS Information Technology', dept: 'CCS', active: true },
    { id: 2, code: 'BSCS', name: 'BS Computer Science', dept: 'CCS', active: true },
    { id: 3, code: 'BSHM', name: 'BS Hospitality Management', dept: 'CHM', active: true },
    { id: 4, code: 'BSTM', name: 'BS Tourism Management', dept: 'CHM', active: true },
    { id: 5, code: 'BECED', name: 'BEEd – Early Childhood', dept: 'CTE', active: true },
    { id: 6, code: 'BTLED', name: 'BTLEd', dept: 'CTE', active: false },
    { id: 7, code: 'BSOA', name: 'BS Office Administration', dept: 'CBS', active: true },
];

const INIT_USERS = [
    { id: 1, name: 'Carmelita Dela Cruz', email: 'cdelacruz@pdm.edu.ph', role: 'Super Admin', status: 'Active', last: 'Mar 22, 2026' },
    { id: 2, name: 'Ramos, J.', email: 'jramos@pdm.edu.ph', role: 'Staff', status: 'Active', last: 'Mar 21, 2026' },
    { id: 3, name: 'Bautista, L.', email: 'lbautista@pdm.edu.ph', role: 'Dept Head', status: 'Active', last: 'Mar 20, 2026' },
    { id: 4, name: 'Cruz, M.', email: 'mcruz@pdm.edu.ph', role: 'Staff', status: 'Inactive', last: 'Feb 14, 2026' },
];

const AUDIT_LOGS = [
    { id: 1, user: 'Dela Cruz, C.', action: 'Approved application', target: '#2025-031', time: 'Mar 22, 2026 · 10:14 AM', type: 'approve' },
    { id: 2, user: 'Ramos, J.', action: 'Rejected document', target: 'Grade Form · S2023-006', time: 'Mar 22, 2026 · 09:45 AM', type: 'reject' },
    { id: 3, user: 'Dela Cruz, C.', action: 'Published announcement', target: 'TES Deadline Extended', time: 'Mar 21, 2026 · 03:22 PM', type: 'publish' },
    { id: 4, user: 'Bautista, L.', action: 'Verified RO submission', target: 'RO-001 · Juan Dela Cruz', time: 'Mar 21, 2026 · 02:10 PM', type: 'approve' },
    { id: 5, user: 'Ramos, J.', action: 'Added new user', target: 'santos.osfa', time: 'Mar 20, 2026 · 11:30 AM', type: 'create' },
    { id: 6, user: 'Dela Cruz, C.', action: 'Updated scholarship criteria', target: 'TDP GWA threshold', time: 'Mar 20, 2026 · 09:00 AM', type: 'update' },
];

const REQUIREMENTS = [
    'Certificate of Registration (COR)',
    'Grade Form / Transcript of Records',
    'Certificate of Indigency',
    'Valid Government ID',
    'Barangay Certificate',
    '2x2 ID Photo',
    'Birth Certificate (PSA)',
    'Proof of Enrollment',
];

const YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

// ─── Shared helpers ───────────────────────────────────────────
function SectionTitle({ title, sub }: { title: string; sub?: string }) {
    return (
        <div className="mb-5">
            <h2 className="text-sm font-bold" style={{ color: C.text }}>{title}</h2>
            {sub && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</p>}
        </div>
    );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
    return (
        <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
            {children}
        </label>
    );
}

function GroupCard({ title, icon: Icon, children }: { title: string; icon: React.FC<any>; children: React.ReactNode }) {
    return (
        <div style={CARD} className="overflow-hidden">
            <div className="flex items-center gap-2.5 px-5 py-3.5" style={{ borderBottom: BD, background: C.yellowSoft }}>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.amberSoft }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: C.brownLight }} />
                </div>
                <p className="text-xs font-bold" style={{ color: C.text }}>{title}</p>
            </div>
            <div className="p-5 space-y-4">{children}</div>
        </div>
    );
}

function ActionBtn({ children, color, soft, border, onClick }: {
    children: React.ReactNode; color: string; soft: string; border?: string; onClick?: () => void;
}) {
    return (
        <button onClick={onClick}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all"
            style={{ borderColor: border ?? C.border, color, background: soft }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.95)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}>
            {children}
        </button>
    );
}

function Toggle({ value, onChange, labels }: { value: boolean; onChange: (v: boolean) => void; labels?: [string, string] }) {
    const [on, off] = labels ?? ['Enabled', 'Disabled'];
    return (
        <button onClick={() => onChange(!value)} className="flex items-center gap-2">
            {value
                ? <ToggleRight className="w-6 h-6" style={{ color: C.green }} />
                : <ToggleLeft className="w-6 h-6" style={{ color: C.muted }} />}
            <span className="text-xs font-semibold" style={{ color: value ? C.green : C.muted }}>
                {value ? on : off}
            </span>
        </button>
    );
}

// ─── GENERAL SETTINGS PANEL ──────────────────────────────────
function GeneralPanel() {
    // Institution
    const [instName, setInstName] = useState('Pambayang Dalubhasaan ng Marilao');
    const [instAcronym, setInstAcronym] = useState('PDM');
    const [officeEmail, setOfficeEmail] = useState('osfa@pdm.edu.ph');
    const [officePhone, setOfficePhone] = useState('+63 44 123 4567');
    const [address, setAddress] = useState('Marilao, Bulacan, Philippines');
    const [logoUrl, setLogoUrl] = useState('');

    // Academic
    const [currentAY, setCurrentAY] = useState('2025-2026');
    const [currentSem, setCurrentSem] = useState('1st');
    const [appOpen, setAppOpen] = useState(true);
    const [appDeadline, setAppDeadline] = useState('2026-03-31');

    // Notifications
    const [emailNotif, setEmailNotif] = useState(true);
    const [smsNotif, setSmsNotif] = useState(false);
    const [autoReminder, setAutoReminder] = useState(true);
    const [reminderDays, setReminderDays] = useState(3);
    const [notifEmail, setNotifEmail] = useState('notifications@pdm.edu.ph');

    // Security
    const [sessionTimeout, setSessionTimeout] = useState(30);
    const [twoFactor, setTwoFactor] = useState(false);
    const [passwordExpiry, setPasswordExpiry] = useState(90);
    const [maxLoginAttempts, setMaxLoginAttempts] = useState(5);

    // Display
    const [dateFormat, setDateFormat] = useState('MMM DD, YYYY');
    const [timezone, setTimezone] = useState('Asia/Manila');
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [language, setLanguage] = useState('en');

    // Maintenance
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [autoBackup, setAutoBackup] = useState(true);
    const [backupFrequency, setBackupFrequency] = useState('daily');
    const [saved, setSaved] = useState(false);

    // Theme
    type ThemeMode = 'light' | 'dark' | 'system';
    const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
        return (localStorage.getItem('smart-pdm-theme') as ThemeMode) ?? 'light';
    });

    useEffect(() => {
        const root = document.documentElement;
        const isDark =
            themeMode === 'dark' ||
            (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        root.classList.toggle('dark', isDark);
        localStorage.setItem('smart-pdm-theme', themeMode);
    }, [themeMode]);

    function handleSave() {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <SectionTitle title="General Settings" sub="Adjust system-wide configuration and preferences" />
                <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold text-white transition-all"
                    style={{ background: saved ? C.green : C.brown }}
                >
                    {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    {saved ? 'Saved!' : 'Save Changes'}
                </button>
            </div>

            {/* Display Preferences */}
            <GroupCard title="Display & Localization" icon={SlidersHorizontal}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                        <FieldLabel>Date Format</FieldLabel>
                        <Select value={dateFormat} onValueChange={setDateFormat}>
                            <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {['MMM DD, YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'MM-DD-YYYY'].map(f => (
                                    <SelectItem key={f} value={f}>{f}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <FieldLabel>Timezone</FieldLabel>
                        <Select value={timezone} onValueChange={setTimezone}>
                            <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Asia/Manila">Asia/Manila (PHT, UTC+8)</SelectItem>
                                <SelectItem value="UTC">UTC</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <FieldLabel>Items Per Page (tables)</FieldLabel>
                        <div className="flex gap-2">
                            {[10, 25, 50, 100].map(n => (
                                <button key={n} onClick={() => setItemsPerPage(n)}
                                    className="flex-1 py-2 rounded-xl border text-xs font-bold transition-all"
                                    style={{
                                        background: itemsPerPage === n ? C.brown : C.white,
                                        color: itemsPerPage === n ? C.white : C.muted,
                                        borderColor: itemsPerPage === n ? C.brown : C.border,
                                    }}>
                                    {n}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <FieldLabel>Language</FieldLabel>
                        <Select value={language} onValueChange={setLanguage}>
                            <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="en">English</SelectItem>
                                <SelectItem value="fil">Filipino</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Theme Mode — spans full width */}
                    <div className="lg:col-span-2">
                        <FieldLabel>Appearance / Theme</FieldLabel>
                        <div className="grid grid-cols-3 gap-3">
                            {([
                                { value: 'light', label: 'Light', icon: Sun },
                                { value: 'dark', label: 'Dark', icon: Moon },
                                { value: 'system', label: 'System', icon: Monitor },
                            ] as { value: ThemeMode; label: string; icon: React.FC<any> }[]).map(({ value, label, icon: Icon }) => {
                                const isActive = themeMode === value;
                                return (
                                    <button
                                        key={value}
                                        onClick={() => setThemeMode(value)}
                                        className="flex flex-col items-center gap-2 py-4 rounded-xl border transition-all"
                                        style={{
                                            background: isActive ? C.brown : C.white,
                                            borderColor: isActive ? C.brown : C.border,
                                            color: isActive ? C.white : C.muted,
                                        }}
                                    >
                                        <Icon className="w-5 h-5" />
                                        <span className="text-xs font-semibold">{label}</span>
                                        {isActive && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                                style={{ background: 'rgba(255,255,255,0.2)', color: C.white }}>
                                                Active
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-[11px] mt-1.5" style={{ color: C.muted }}>
                            {themeMode === 'system'
                                ? 'Follows your operating system preference'
                                : themeMode === 'dark'
                                    ? 'Dark mode is active — applies to the entire portal'
                                    : 'Light mode is active — applies to the entire portal'}
                        </p>
                    </div>
                </div>
            </GroupCard>

            {/* Academic Year */}
            <GroupCard title="Academic Year & Application Window" icon={GraduationCap}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                        <FieldLabel>Current Academic Year</FieldLabel>
                        <Select value={currentAY} onValueChange={setCurrentAY}>
                            <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {['2025-2026', '2024-2025', '2023-2024'].map(y => (
                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <FieldLabel>Current Semester</FieldLabel>
                        <div className="flex gap-2">
                            {['1st', '2nd', 'Summer'].map(s => (
                                <button key={s} onClick={() => setCurrentSem(s)}
                                    className="flex-1 py-2 rounded-xl border text-xs font-semibold transition-all"
                                    style={{
                                        background: currentSem === s ? C.brown : C.white,
                                        color: currentSem === s ? C.white : C.muted,
                                        borderColor: currentSem === s ? C.brown : C.border,
                                    }}>
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <FieldLabel>Application Status</FieldLabel>
                        <Toggle value={appOpen} onChange={setAppOpen} labels={['Open', 'Closed']} />
                        <p className="text-[11px] mt-1" style={{ color: C.muted }}>
                            Controls whether scholars can submit new applications
                        </p>
                    </div>
                    <div>
                        <FieldLabel>Application Deadline</FieldLabel>
                        <Input className="h-9 text-sm rounded-xl bg-gray-50" type="date"
                            value={appDeadline} onChange={e => setAppDeadline(e.target.value)} />
                    </div>
                </div>
            </GroupCard>

            {/* Notifications */}
            <GroupCard title="Notification Settings" icon={Bell}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <div>
                            <FieldLabel>Email Notifications</FieldLabel>
                            <Toggle value={emailNotif} onChange={setEmailNotif} />
                        </div>
                        <div>
                            <FieldLabel>SMS Notifications</FieldLabel>
                            <Toggle value={smsNotif} onChange={setSmsNotif} />
                            <p className="text-[11px] mt-1" style={{ color: C.muted }}>Requires SMS gateway configuration</p>
                        </div>
                        <div>
                            <FieldLabel>Auto Deadline Reminders</FieldLabel>
                            <Toggle value={autoReminder} onChange={setAutoReminder} />
                        </div>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <FieldLabel>Reminder Days Before Deadline</FieldLabel>
                            <div className="flex items-center gap-3">
                                <input type="range" min={1} max={14} step={1}
                                    className="flex-1 accent-amber-700"
                                    value={reminderDays} onChange={e => setReminderDays(+e.target.value)} />
                                <span className="text-sm font-bold w-8 text-right" style={{ color: C.brown }}>{reminderDays}d</span>
                            </div>
                        </div>
                        <div>
                            <FieldLabel>System Notification Email</FieldLabel>
                            <Input className="h-9 text-sm rounded-xl bg-gray-50" type="email"
                                value={notifEmail} onChange={e => setNotifEmail(e.target.value)} />
                        </div>
                    </div>
                </div>
            </GroupCard>

            {/* Security */}
            <GroupCard title="Security & Access" icon={Lock}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                        <FieldLabel>Session Timeout (minutes)</FieldLabel>
                        <div className="flex items-center gap-3">
                            <input type="range" min={5} max={120} step={5}
                                className="flex-1 accent-amber-700"
                                value={sessionTimeout} onChange={e => setSessionTimeout(+e.target.value)} />
                            <span className="text-sm font-bold w-10 text-right" style={{ color: C.brown }}>{sessionTimeout}m</span>
                        </div>
                        <p className="text-[11px] mt-1" style={{ color: C.muted }}>Auto-logout after inactivity</p>
                    </div>
                    <div>
                        <FieldLabel>Max Login Attempts</FieldLabel>
                        <div className="flex items-center gap-3">
                            <input type="range" min={3} max={10} step={1}
                                className="flex-1 accent-amber-700"
                                value={maxLoginAttempts} onChange={e => setMaxLoginAttempts(+e.target.value)} />
                            <span className="text-sm font-bold w-6 text-right" style={{ color: C.brown }}>{maxLoginAttempts}</span>
                        </div>
                        <p className="text-[11px] mt-1" style={{ color: C.muted }}>Account locked after this many failed attempts</p>
                    </div>
                    <div>
                        <FieldLabel>Password Expiry (days)</FieldLabel>
                        <input type="number" min={30} max={365}
                            className="w-full h-9 px-3 text-sm rounded-xl bg-gray-50 border focus:outline-none"
                            style={{ border: BD, color: C.text }}
                            value={passwordExpiry} onChange={e => setPasswordExpiry(+e.target.value)} />
                        <p className="text-[11px] mt-1" style={{ color: C.muted }}>Set to 0 to disable expiry</p>
                    </div>
                    <div>
                        <FieldLabel>Two-Factor Authentication</FieldLabel>
                        <Toggle value={twoFactor} onChange={setTwoFactor} />
                        <p className="text-[11px] mt-1" style={{ color: C.muted }}>Requires OTP on login for all admin accounts</p>
                    </div>
                </div>
            </GroupCard>

            {/* Maintenance */}
            <GroupCard title="Maintenance & Backup" icon={Database}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                        <FieldLabel>Maintenance Mode</FieldLabel>
                        <Toggle value={maintenanceMode} onChange={setMaintenanceMode} labels={['On — site is offline', 'Off — site is live']} />
                        {maintenanceMode && (
                            <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl"
                                style={{ background: C.redSoft, border: '1px solid #fecaca' }}>
                                <span className="text-[11px] font-semibold" style={{ color: C.red }}>
                                    ⚠ System is in maintenance mode — students cannot log in
                                </span>
                            </div>
                        )}
                    </div>
                    <div>
                        <FieldLabel>Auto Backup</FieldLabel>
                        <Toggle value={autoBackup} onChange={setAutoBackup} />
                    </div>
                    <div>
                        <FieldLabel>Backup Frequency</FieldLabel>
                        <div className="flex gap-2">
                            {['daily', 'weekly', 'monthly'].map(f => (
                                <button key={f} onClick={() => setBackupFrequency(f)}
                                    className="flex-1 py-2 rounded-xl border text-xs font-semibold capitalize transition-all"
                                    style={{
                                        background: backupFrequency === f ? C.brown : C.white,
                                        color: backupFrequency === f ? C.white : C.muted,
                                        borderColor: backupFrequency === f ? C.brown : C.border,
                                    }}>
                                    {f}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <FieldLabel>Manual Backup</FieldLabel>
                        <button
                            className="flex items-center gap-1.5 px-4 h-9 rounded-xl border text-xs font-semibold transition-colors"
                            style={{ borderColor: C.border, color: C.brownLight, background: C.white }}
                            onMouseEnter={e => (e.currentTarget.style.background = C.amberSoft)}
                            onMouseLeave={e => (e.currentTarget.style.background = C.white)}
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Run Backup Now
                        </button>
                        <p className="text-[11px] mt-1" style={{ color: C.muted }}>Last backup: Mar 22, 2026 · 2:00 AM</p>
                    </div>
                </div>
            </GroupCard>

            {/* Save footer */}
            <div className="flex justify-end pt-2">
                <button
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-6 h-10 rounded-xl text-sm font-bold text-white transition-all"
                    style={{ background: saved ? C.green : C.brown }}
                >
                    {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                    {saved ? 'All changes saved!' : 'Save All Settings'}
                </button>
            </div>
        </div>
    );
}

// ─── BENEFACTORS PANEL ────────────────────────────────────────
function BenefactorsPanel() {
    const [items, setItems] = useState(INIT_BENEFACTORS);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', program: '', description: '', slots: 50, gwa: 1.75, financial: 4000, status: true });
    const [reqs, setReqs] = useState<string[]>([]);
    const [years, setYears] = useState<string[]>([]);

    function toggleReq(r: string) { setReqs(p => p.includes(r) ? p.filter(x => x !== r) : [...p, r]); }
    function toggleYear(y: string) { setYears(p => p.includes(y) ? p.filter(x => x !== y) : [...p, y]); }
    function toggleStatus(id: number) {
        setItems(p => p.map(b => b.id === id ? { ...b, status: b.status === 'published' ? 'draft' : 'published' } : b));
    }

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <SectionTitle title="Benefactors" sub="Manage corporate and institutional scholarship benefactors" />
                <button onClick={() => setShowForm(v => !v)}
                    className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold text-white"
                    style={{ background: C.brown }}>
                    <Plus className="w-3.5 h-3.5" /> Add Benefactor
                </button>
            </div>

            {showForm && (
                <div style={CARD} className="p-5 space-y-5">
                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: C.brownLight }}>New Benefactor Profile</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                        <div className="space-y-4">
                            <div><FieldLabel>Benefactor Name</FieldLabel>
                                <Input className="h-9 text-sm rounded-xl bg-gray-50" placeholder="e.g. Kaizen Corporation"
                                    value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                            <div><FieldLabel>Program / Course Coverage</FieldLabel>
                                <Input className="h-9 text-sm rounded-xl bg-gray-50" placeholder="e.g. BSIT, BSTM or All Programs"
                                    value={form.program} onChange={e => setForm(p => ({ ...p, program: e.target.value }))} /></div>
                            <div><FieldLabel>Description</FieldLabel>
                                <Textarea className="text-sm rounded-xl bg-gray-50 resize-none" rows={3}
                                    placeholder="Brief description…"
                                    value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div><FieldLabel>Max Slots</FieldLabel>
                                    <input type="number" min={1} max={500}
                                        className="w-full h-9 px-3 text-sm rounded-xl bg-gray-50 border focus:outline-none"
                                        style={{ border: BD, color: C.text }}
                                        value={form.slots} onChange={e => setForm(p => ({ ...p, slots: +e.target.value }))} /></div>
                                <div><FieldLabel>Financial (₱)</FieldLabel>
                                    <input type="number" min={0}
                                        className="w-full h-9 px-3 text-sm rounded-xl bg-gray-50 border focus:outline-none"
                                        style={{ border: BD, color: C.text }}
                                        value={form.financial} onChange={e => setForm(p => ({ ...p, financial: +e.target.value }))} /></div>
                            </div>
                            <div><FieldLabel>Min GWA — {form.gwa.toFixed(2)}</FieldLabel>
                                <input type="range" min={1.00} max={3.00} step={0.05} className="w-full accent-amber-700"
                                    value={form.gwa} onChange={e => setForm(p => ({ ...p, gwa: +e.target.value }))} />
                                <div className="flex justify-between text-[10px] mt-0.5" style={{ color: C.muted }}>
                                    <span>1.00</span><span>3.00</span></div></div>
                            <div><FieldLabel>Visibility</FieldLabel>
                                <button onClick={() => setForm(p => ({ ...p, status: !p.status }))} className="flex items-center gap-2">
                                    {form.status
                                        ? <><ToggleRight className="w-6 h-6" style={{ color: C.green }} /><span className="text-xs font-semibold" style={{ color: C.green }}>Published</span></>
                                        : <><ToggleLeft className="w-6 h-6" style={{ color: C.muted }} /><span className="text-xs font-semibold" style={{ color: C.muted }}>Draft</span></>}
                                </button></div>
                        </div>
                        <div className="space-y-4">
                            <div><FieldLabel>Year Level Filter</FieldLabel>
                                <div className="flex flex-wrap gap-2">
                                    {YEAR_LEVELS.map(y => (
                                        <button key={y} onClick={() => toggleYear(y)}
                                            className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all"
                                            style={{ background: years.includes(y) ? C.brownLight : C.white, color: years.includes(y) ? C.white : C.muted, borderColor: years.includes(y) ? C.brownLight : C.border }}>
                                            {y}</button>))}
                                </div></div>
                            <div><FieldLabel>Required Documents</FieldLabel>
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {REQUIREMENTS.map(r => (
                                        <button key={r} onClick={() => toggleReq(r)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left text-xs font-medium transition-all"
                                            style={{ background: reqs.includes(r) ? C.yellowSoft : C.white, borderColor: reqs.includes(r) ? C.amber : C.border, color: C.text }}>
                                            {reqs.includes(r) ? <CheckSquare className="w-4 h-4 shrink-0" style={{ color: C.amber }} /> : <Square className="w-4 h-4 shrink-0" style={{ color: C.muted }} />}
                                            {r}</button>))}
                                </div></div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4" style={{ borderTop: BD }}>
                        <button onClick={() => setShowForm(false)} className="px-4 h-9 rounded-xl text-xs font-semibold border"
                            style={{ borderColor: C.border, color: C.muted, background: C.white }}>Cancel</button>
                        <button onClick={() => setShowForm(false)} className="px-4 h-9 rounded-xl text-xs font-bold text-white"
                            style={{ background: C.brown }}>Save Benefactor</button>
                    </div>
                </div>
            )}

            <div style={{ ...CARD, overflow: 'hidden' }}>
                <table className="w-full">
                    <thead><tr style={{ background: C.yellowSoft, borderBottom: BD }}>
                        {['Benefactor', 'Program', 'Slots', 'Min GWA', 'Financial', 'Status', ''].map((h, i) => (
                            <th key={i} className={'px-4 py-3 text-[11px] font-bold uppercase tracking-wider ' + (i === 0 ? 'text-left' : 'text-center')} style={{ color: C.muted }}>{h}</th>))}
                    </tr></thead>
                    <tbody>
                        {items.map((b, i) => (
                            <tr key={b.id} style={{ borderBottom: BD, background: i % 2 === 0 ? C.white : C.sand }}>
                                <td className="px-4 py-3 text-sm font-semibold" style={{ color: C.text }}>{b.name}</td>
                                <td className="px-4 py-3 text-center text-xs" style={{ color: C.muted }}>{b.program}</td>
                                <td className="px-4 py-3 text-center text-sm font-bold" style={{ color: C.brownLight }}>{b.slots}</td>
                                <td className="px-4 py-3 text-center text-sm" style={{ color: C.text }}>{b.gwa.toFixed(2)}</td>
                                <td className="px-4 py-3 text-center text-sm" style={{ color: C.text }}>₱{b.financial.toLocaleString()}</td>
                                <td className="px-4 py-3 text-center">
                                    <button onClick={() => toggleStatus(b.id)} className="flex items-center gap-1 mx-auto">
                                        {b.status === 'published'
                                            ? <><ToggleRight className="w-5 h-5" style={{ color: C.green }} /><span className="text-[11px] font-semibold" style={{ color: C.green }}>Published</span></>
                                            : <><ToggleLeft className="w-5 h-5" style={{ color: C.muted }} /><span className="text-[11px] font-semibold" style={{ color: C.muted }}>Draft</span></>}
                                    </button>
                                </td>
                                <td className="px-4 py-3 pr-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <ActionBtn color={C.brownLight} soft={C.amberSoft}><Edit className="w-3.5 h-3.5" /></ActionBtn>
                                        <ActionBtn color={C.red} soft={C.redSoft} border="#fecaca" onClick={() => setItems(p => p.filter(x => x.id !== b.id))}>
                                            <Trash2 className="w-3.5 h-3.5" /></ActionBtn>
                                    </div>
                                </td>
                            </tr>))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── SCHOLARSHIP PANEL ────────────────────────────────────────
function ScholarshipPanel() {
    const [items] = useState(INIT_SCHOLARSHIPS);
    const [editing, setEditing] = useState<string | null>(null);
    const [gwaMap, setGwaMap] = useState<Record<string, number>>(
        Object.fromEntries(INIT_SCHOLARSHIPS.map(s => [s.id, s.minGwa]))
    );
    return (
        <div className="space-y-5">
            <SectionTitle title="Scholarship & Criteria Settings" sub="Configure eligibility requirements for each scholarship program" />
            <div className="space-y-4">
                {items.map(s => (
                    <div key={s.id} style={CARD} className="p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <p className="text-sm font-bold" style={{ color: C.text }}>{s.name}</p>
                                <p className="text-[11px] mt-0.5 font-mono uppercase" style={{ color: C.muted }}>{s.id.toUpperCase()}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: C.greenSoft, color: C.green }}>{s.status}</span>
                                <ActionBtn color={C.brownLight} soft={C.amberSoft} onClick={() => setEditing(editing === s.id ? null : s.id)}>
                                    <Edit className="w-3.5 h-3.5" /> {editing === s.id ? 'Close' : 'Edit'}
                                </ActionBtn>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-3">
                            <div className="rounded-xl p-3" style={{ background: C.sand }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: C.muted }}>Min GWA</p>
                                <p className="text-2xl font-bold" style={{ color: C.brown }}>{gwaMap[s.id]?.toFixed(2)}</p>
                            </div>
                            <div className="rounded-xl p-3" style={{ background: C.sand }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: C.muted }}>Year Levels</p>
                                <p className="text-sm font-semibold" style={{ color: C.text }}>{s.levels.join(', ')}</p>
                            </div>
                        </div>
                        {editing === s.id && (
                            <div className="pt-4 space-y-4" style={{ borderTop: BD }}>
                                <div>
                                    <FieldLabel>GWA Threshold — {gwaMap[s.id]?.toFixed(2)}</FieldLabel>
                                    <input type="range" min={1.00} max={3.00} step={0.05} className="w-full accent-amber-700"
                                        value={gwaMap[s.id]} onChange={e => setGwaMap(p => ({ ...p, [s.id]: +e.target.value }))} />
                                    <div className="flex justify-between text-[10px] mt-0.5" style={{ color: C.muted }}>
                                        <span>1.00 (Highest)</span><span>3.00 (Lowest)</span></div>
                                </div>
                                <div>
                                    <FieldLabel>Eligible Year Levels</FieldLabel>
                                    <div className="flex gap-2 flex-wrap">
                                        {['All', ...YEAR_LEVELS].map(y => (
                                            <button key={y} className="px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all"
                                                style={{ background: s.levels.includes(y) ? C.brown : C.white, color: s.levels.includes(y) ? C.white : C.muted, borderColor: s.levels.includes(y) ? C.brown : C.border }}>
                                                {y}</button>))}
                                    </div>
                                </div>
                                <div>
                                    <FieldLabel>Required Documents</FieldLabel>
                                    <div className="grid grid-cols-2 gap-2">
                                        {REQUIREMENTS.map(r => (
                                            <div key={r} className="flex items-center gap-2 text-xs" style={{ color: C.text }}>
                                                <CheckSquare className="w-3.5 h-3.5 shrink-0" style={{ color: C.amber }} />{r}
                                            </div>))}
                                    </div>
                                </div>
                                <div className="flex justify-end">
                                    <button className="px-4 h-9 rounded-xl text-xs font-bold text-white" style={{ background: C.brown }} onClick={() => setEditing(null)}>
                                        Save Changes</button>
                                </div>
                            </div>
                        )}
                    </div>))}
            </div>
        </div>
    );
}

// ─── COURSES PANEL ────────────────────────────────────────────
function CoursesPanel() {
    const [courses, setCourses] = useState(INIT_COURSES);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ code: '', name: '', dept: '' });

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <SectionTitle title="Course Management" sub="Add and manage degree programs offered" />
                <button onClick={() => setShowForm(v => !v)}
                    className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold text-white"
                    style={{ background: C.brown }}>
                    <Plus className="w-3.5 h-3.5" /> Add Course
                </button>
            </div>
            {showForm && (
                <div style={CARD} className="p-5 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: C.brownLight }}>New Course</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div><FieldLabel>Code</FieldLabel><Input className="h-9 text-sm rounded-xl bg-gray-50" placeholder="e.g. BSIT" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} /></div>
                        <div><FieldLabel>Course Name</FieldLabel><Input className="h-9 text-sm rounded-xl bg-gray-50" placeholder="e.g. BS Information Technology" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
                        <div><FieldLabel>Department</FieldLabel><Input className="h-9 text-sm rounded-xl bg-gray-50" placeholder="e.g. CCS" value={form.dept} onChange={e => setForm(p => ({ ...p, dept: e.target.value }))} /></div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowForm(false)} className="px-4 h-9 rounded-xl text-xs font-semibold border" style={{ borderColor: C.border, color: C.muted, background: C.white }}>Cancel</button>
                        <button onClick={() => { setCourses(p => [...p, { id: Date.now(), ...form, active: true }]); setShowForm(false); setForm({ code: '', name: '', dept: '' }); }}
                            className="px-4 h-9 rounded-xl text-xs font-bold text-white" style={{ background: C.brown }}>Add Course</button>
                    </div>
                </div>
            )}
            <div style={{ ...CARD, overflow: 'hidden' }}>
                <table className="w-full">
                    <thead><tr style={{ background: C.yellowSoft, borderBottom: BD }}>
                        {['Code', 'Course Name', 'Department', 'Status', ''].map((h, i) => (
                            <th key={i} className={'px-4 py-3 text-[11px] font-bold uppercase tracking-wider ' + (i === 0 ? 'text-left' : 'text-center')} style={{ color: C.muted }}>{h}</th>))}
                    </tr></thead>
                    <tbody>
                        {courses.map((c, i) => (
                            <tr key={c.id} style={{ borderBottom: BD, background: i % 2 === 0 ? C.white : C.sand }}>
                                <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: C.brownLight }}>{c.code}</td>
                                <td className="px-4 py-3 text-sm" style={{ color: C.text }}>{c.name}</td>
                                <td className="px-4 py-3 text-center"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-md" style={{ background: C.sand, color: C.muted }}>{c.dept}</span></td>
                                <td className="px-4 py-3 text-center">
                                    <button onClick={() => setCourses(p => p.map(x => x.id === c.id ? { ...x, active: !x.active } : x))} className="flex items-center gap-1 mx-auto">
                                        {c.active ? <><ToggleRight className="w-5 h-5" style={{ color: C.green }} /><span className="text-[11px] font-semibold" style={{ color: C.green }}>Active</span></>
                                            : <><ToggleLeft className="w-5 h-5" style={{ color: C.muted }} /><span className="text-[11px] font-semibold" style={{ color: C.muted }}>Inactive</span></>}
                                    </button>
                                </td>
                                <td className="px-4 py-3 pr-4 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                        <ActionBtn color={C.brownLight} soft={C.amberSoft}><Edit className="w-3.5 h-3.5" /></ActionBtn>
                                        <ActionBtn color={C.red} soft={C.redSoft} border="#fecaca" onClick={() => setCourses(p => p.filter(x => x.id !== c.id))}><Trash2 className="w-3.5 h-3.5" /></ActionBtn>
                                    </div>
                                </td>
                            </tr>))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── USERS PANEL ─────────────────────────────────────────────
function UsersPanel() {
    const [users, setUsers] = useState(INIT_USERS);
    const ROLES = ['Super Admin', 'Staff', 'Dept Head', 'Read Only'];
    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <SectionTitle title="User & Role Management" sub="Manage admin portal access and permissions" />
                <button className="flex items-center gap-1.5 px-4 h-9 rounded-xl text-xs font-bold text-white" style={{ background: C.brown }}>
                    <Plus className="w-3.5 h-3.5" /> Invite User
                </button>
            </div>
            <div style={{ ...CARD, overflow: 'hidden' }}>
                <table className="w-full">
                    <thead><tr style={{ background: C.yellowSoft, borderBottom: BD }}>
                        {['Name', 'Email', 'Role', 'Status', 'Last Active', ''].map((h, i) => (
                            <th key={i} className={'px-4 py-3 text-[11px] font-bold uppercase tracking-wider ' + (i === 0 ? 'text-left' : 'text-center')} style={{ color: C.muted }}>{h}</th>))}
                    </tr></thead>
                    <tbody>
                        {users.map((u, i) => (
                            <tr key={u.id} style={{ borderBottom: BD, background: i % 2 === 0 ? C.white : C.sand }}>
                                <td className="px-4 py-3 text-sm font-semibold" style={{ color: C.text }}>{u.name}</td>
                                <td className="px-4 py-3 text-center text-xs font-mono" style={{ color: C.muted }}>{u.email}</td>
                                <td className="px-4 py-3 text-center">
                                    <select className="text-xs rounded-lg px-2 py-1 border" style={{ border: BD, color: C.text, background: C.white }}
                                        value={u.role} onChange={e => setUsers(p => p.map(x => x.id === u.id ? { ...x, role: e.target.value } : x))}>
                                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                    </select>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                                        style={{ background: u.status === 'Active' ? C.greenSoft : C.sand, color: u.status === 'Active' ? C.green : C.muted }}>
                                        {u.status}</span>
                                </td>
                                <td className="px-4 py-3 text-center text-xs" style={{ color: C.muted }}>{u.last}</td>
                                <td className="px-4 py-3 pr-4 text-right">
                                    <ActionBtn color={C.red} soft={C.redSoft} border="#fecaca" onClick={() => setUsers(p => p.filter(x => x.id !== u.id))}>
                                        <Trash2 className="w-3.5 h-3.5" /></ActionBtn>
                                </td>
                            </tr>))}
                    </tbody>
                </table>
            </div>
            <div style={CARD} className="p-5">
                <p className="text-xs font-bold mb-3" style={{ color: C.text }}>Role Permissions</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { role: 'Super Admin', perms: ['Full access', 'User management', 'System config', 'All modules'] },
                        { role: 'Staff', perms: ['Applications', 'Scholars', 'RO Verification', 'Reports'] },
                        { role: 'Dept Head', perms: ['RO approval', 'View scholars', 'View reports', '—'] },
                        { role: 'Read Only', perms: ['View dashboard', 'View reports', '—', '—'] },
                    ].map(({ role, perms }) => (
                        <div key={role} className="p-3 rounded-xl" style={{ background: C.sand }}>
                            <p className="text-xs font-bold mb-2" style={{ color: C.brown }}>{role}</p>
                            {perms.map(p => (
                                <p key={p} className="text-[11px] flex items-center gap-1" style={{ color: p === '—' ? C.muted : C.text }}>
                                    {p !== '—' && <Check className="w-3 h-3" style={{ color: C.green }} />}{p}
                                </p>))}
                        </div>))}
                </div>
            </div>
        </div>
    );
}

// ─── AUDIT PANEL ─────────────────────────────────────────────
const AUDIT_TYPE_STYLE: Record<string, { bg: string; color: string }> = {
    approve: { bg: C.greenSoft, color: C.green },
    reject: { bg: '#FEF2F2', color: '#dc2626' },
    publish: { bg: C.yellowSoft, color: C.amber },
    create: { bg: C.sand, color: C.brownLight },
    update: { bg: C.amberSoft, color: C.amber },
};

function AuditPanel() {
    const [filter, setFilter] = useState('all');
    const filtered = filter === 'all' ? AUDIT_LOGS : AUDIT_LOGS.filter(l => l.type === filter);
    return (
        <div className="space-y-5">
            <SectionTitle title="Audit Trail" sub="Complete log of all admin actions in the system" />
            <div className="flex items-center gap-2 flex-wrap">
                {['all', 'approve', 'reject', 'publish', 'create', 'update'].map(f => {
                    const s = AUDIT_TYPE_STYLE[f] ?? { bg: C.sand, color: C.muted };
                    return (
                        <button key={f} onClick={() => setFilter(f)}
                            className="px-3 py-1.5 rounded-xl border text-xs font-semibold capitalize transition-all"
                            style={{ background: filter === f ? s.bg : C.white, color: filter === f ? s.color : C.muted, borderColor: filter === f ? s.color : C.border }}>
                            {f === 'all' ? 'All Actions' : f}
                        </button>);
                })}
            </div>
            <div style={{ ...CARD, overflow: 'hidden' }}>
                <div className="divide-y" style={{ borderColor: C.border }}>
                    {filtered.map(log => {
                        const s = AUDIT_TYPE_STYLE[log.type] ?? { bg: C.sand, color: C.muted };
                        return (
                            <div key={log.id} className="flex items-start gap-4 px-5 py-3.5">
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: s.bg }}>
                                    <Activity className="w-3.5 h-3.5" style={{ color: s.color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold" style={{ color: C.text }}>{log.user}</span>
                                        <span className="text-xs" style={{ color: C.muted }}>{log.action}</span>
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ background: s.bg, color: s.color }}>{log.target}</span>
                                    </div>
                                    <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{log.time}</p>
                                </div>
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize shrink-0" style={{ background: s.bg, color: s.color }}>{log.type}</span>
                            </div>);
                    })}
                </div>
            </div>
        </div>
    );
}

// ─── SYSTEM PANEL ────────────────────────────────────────────
function SystemPanel() {
    const OCR_STATS = [
        { label: 'Documents Scanned', value: '1,842', color: C.brown },
        { label: 'OCR Success Rate', value: '94.2%', color: C.green },
        { label: 'Failed / Manual', value: '107', color: C.red },
        { label: 'Avg. Process Time', value: '1.4s', color: C.brownLight },
    ];
    const OCR_QUEUE = [
        { name: 'grade_form_S2023-006.pdf', status: 'Processing', confidence: null, time: 'Just now' },
        { name: 'cor_S2023-011.pdf', status: 'Success', confidence: '98%', time: '2 min ago' },
        { name: 'indigency_S2023-009.pdf', status: 'Success', confidence: '91%', time: '5 min ago' },
        { name: 'id_scan_S2023-008.pdf', status: 'Failed', confidence: '42%', time: '8 min ago' },
        { name: 'cor_S2023-007.pdf', status: 'Success', confidence: '96%', time: '12 min ago' },
    ];
    const SS: Record<string, { bg: string; color: string }> = {
        Processing: { bg: C.yellowSoft, color: C.amber },
        Success: { bg: C.greenSoft, color: C.green },
        Failed: { bg: C.redSoft, color: C.red },
    };
    return (
        <div className="space-y-5">
            <SectionTitle title="System & Hardware Efficiency" sub="OCR performance and document processing metrics" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {OCR_STATS.map(s => (
                    <div key={s.label} style={CARD} className="p-5">
                        <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs font-medium mt-0.5" style={{ color: C.muted }}>{s.label}</p>
                    </div>))}
            </div>
            <div style={CARD} className="p-5">
                <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold" style={{ color: C.text }}>OCR Accuracy Overview</p>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: C.greenSoft, color: C.green }}>Live</span>
                </div>
                <div className="space-y-3">
                    {[{ label: 'Certificate of Registration', rate: 98 }, { label: 'Grade Form', rate: 91 }, { label: 'Certificate of Indigency', rate: 87 }, { label: 'Valid ID', rate: 95 }].map(item => (
                        <div key={item.label}>
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs" style={{ color: C.muted }}>{item.label}</span>
                                <span className="text-xs font-bold" style={{ color: item.rate >= 90 ? C.green : C.amber }}>{item.rate}%</span>
                            </div>
                            <div className="h-1.5 rounded-full" style={{ background: C.border }}>
                                <div className="h-1.5 rounded-full" style={{ width: item.rate + '%', background: item.rate >= 90 ? C.green : C.amber }} />
                            </div>
                        </div>))}
                </div>
            </div>
            <div style={{ ...CARD, overflow: 'hidden' }}>
                <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: BD }}>
                    <div>
                        <p className="text-sm font-bold" style={{ color: C.text }}>OCR Processing Queue</p>
                        <p className="text-xs mt-0.5" style={{ color: C.muted }}>Recent document scan activity</p>
                    </div>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: C.yellowSoft, color: C.amber }}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.amber }} />1 processing
                    </span>
                </div>
                <div className="divide-y" style={{ borderColor: C.border }}>
                    {OCR_QUEUE.map((item, i) => {
                        const s = SS[item.status];
                        return (
                            <div key={i} className="flex items-center gap-4 px-5 py-3">
                                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                                    <FileSearch className="w-4 h-4" style={{ color: s.color }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold truncate" style={{ color: C.text }}>{item.name}</p>
                                    <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{item.time}</p>
                                </div>
                                {item.confidence && <span className="text-xs font-bold" style={{ color: s.color }}>{item.confidence}</span>}
                                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ background: s.bg, color: s.color }}>{item.status}</span>
                            </div>);
                    })}
                </div>
            </div>
            <div style={CARD} className="p-5">
                <p className="text-sm font-bold mb-4" style={{ color: C.text }}>System Info</p>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                        { label: 'OCR Engine', value: 'Tesseract v5.3' },
                        { label: 'Storage Used', value: '14.2 GB / 50 GB' },
                        { label: 'Uptime', value: '99.7% (30 days)' },
                        { label: 'Last Backup', value: 'Mar 22, 2026 · 2AM' },
                        { label: 'Active Sessions', value: '3 admin users' },
                        { label: 'Version', value: 'SMaRT-PDM v1.0.0' },
                    ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl p-3" style={{ background: C.sand }}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>{label}</p>
                            <p className="text-xs font-bold" style={{ color: C.text }}>{value}</p>
                        </div>))}
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────
export default function SettingsMaintenance() {
    const [tab, setTab] = useState<TabKey>('general');

    const PANEL: Record<TabKey, React.ReactNode> = {
        general: <GeneralPanel />,
        benefactors: <BenefactorsPanel />,
        scholarship: <ScholarshipPanel />,
        courses: <CoursesPanel />,
        users: <UsersPanel />,
        audit: <AuditPanel />,
        system: <SystemPanel />,
    };

    return (
        <div className="space-y-5 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>
            <div>
                <h1 className="text-2xl font-bold" style={{ color: C.text }}>Settings & Maintenance</h1>
                <p className="text-sm mt-0.5" style={{ color: C.muted }}>System configuration, roles, and audit management</p>
            </div>
            <div style={{ ...CARD, overflow: 'hidden' }}>
                <div className="flex overflow-x-auto" style={{ borderBottom: BD }}>
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setTab(key)}
                            className="flex items-center gap-2 px-5 py-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all shrink-0"
                            style={{ borderBottomColor: tab === key ? C.brown : 'transparent', color: tab === key ? C.brown : C.muted, background: 'transparent' }}>
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>))}
                </div>
                <div className="p-6" style={{ background: C.bg }}>
                    {PANEL[tab]}
                </div>
            </div>
        </div>
    );
}