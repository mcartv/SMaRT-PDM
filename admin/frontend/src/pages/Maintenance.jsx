import { useState, useEffect } from 'react';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Button } from "../components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
    Building2, BookOpen, GraduationCap, SlidersHorizontal,
    Users, Cpu, ClipboardList, Plus, Edit, Trash2,
    CheckSquare, Square, Activity, FileSearch,
    ToggleLeft, ToggleRight, Check, Bell,
    Lock, Database, RefreshCw, Save, Moon, Sun, Monitor,
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
};

const BD = '1px solid ' + C.border;

const CARD = {
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
];

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
function SectionTitle({ title, sub }) {
    return (
        <div className="mb-5">
            <h2 className="text-sm font-bold" style={{ color: C.text }}>{title}</h2>
            {sub && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</p>}
        </div>
    );
}

function FieldLabel({ children }) {
    return (
        <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
            {children}
        </label>
    );
}

function GroupCard({ title, icon: Icon, children }) {
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

function ActionBtn({ children, color, soft, border, onClick }) {
    return (
        <button onClick={onClick}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all"
            style={{ borderColor: border ?? C.border, color, background: soft }}
        >
            {children}
        </button>
    );
}

function Toggle({ value, onChange, labels }) {
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

// ─── Panels ───
function GeneralPanel() {
    const [themeMode, setThemeMode] = useState(() => localStorage.getItem('smart-pdm-theme') ?? 'light');

    useEffect(() => {
        const root = document.documentElement;
        const isDark = themeMode === 'dark' || (themeMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        root.classList.toggle('dark', isDark);
        localStorage.setItem('smart-pdm-theme', themeMode);
    }, [themeMode]);

    return (
        <div className="space-y-5">
            <SectionTitle title="General Settings" sub="Adjust configuration" />
            <GroupCard title="Display & Localization" icon={SlidersHorizontal}>
                <div className="grid grid-cols-3 gap-3">
                    {[{ value: 'light', label: 'Light', icon: Sun }, { value: 'dark', label: 'Dark', icon: Moon }, { value: 'system', label: 'System', icon: Monitor }].map(({ value, label, icon: Icon }) => (
                        <button key={value} onClick={() => setThemeMode(value)} className={`flex flex-col items-center gap-2 py-4 rounded-xl border transition-all ${themeMode === value ? 'bg-amber-900 text-white border-amber-900' : 'bg-white text-stone-500 border-stone-200'}`}>
                            <Icon className="w-5 h-5" />
                            <span className="text-xs font-semibold">{label}</span>
                        </button>
                    ))}
                </div>
            </GroupCard>
        </div>
    );
}

function BenefactorsPanel() {
    const [items, setItems] = useState(INIT_BENEFACTORS);
    return (
        <div className="space-y-5">
            <SectionTitle title="Benefactors" sub="Manage corporate partners" />
            <div style={{ ...CARD, overflow: 'hidden' }}>
                <table className="w-full text-left">
                    <thead className="bg-amber-50 text-[11px] font-bold uppercase text-stone-500 border-b border-stone-200">
                        <tr><th className="px-4 py-3">Benefactor</th><th className="px-4 py-3">Program</th><th className="px-4 py-3 text-center">Slots</th><th className="px-4 py-3 text-right">Actions</th></tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                        {items.map((b) => (
                            <tr key={b.id}>
                                <td className="px-4 py-3 text-sm font-semibold">{b.name}</td>
                                <td className="px-4 py-3 text-xs">{b.program}</td>
                                <td className="px-4 py-3 text-center text-sm font-bold text-amber-700">{b.slots}</td>
                                <td className="px-4 py-3 text-right space-x-2">
                                    <button className="p-1.5 border rounded-lg hover:bg-stone-50"><Edit className="w-4 h-4 text-stone-500" /></button>
                                    <button onClick={() => setItems(items.filter(i => i.id !== b.id))} className="p-1.5 border border-red-100 bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-600" /></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────
export default function SettingsMaintenance() {
    const [tab, setTab] = useState('general');

    const PANEL = {
        general: <GeneralPanel />,
        benefactors: <BenefactorsPanel />,
        scholarship: <div className="p-4">Scholarship Panel (Cleaned)</div>,
        courses: <div className="p-4">Courses Panel (Cleaned)</div>,
        users: <div className="p-4">Users Panel (Cleaned)</div>,
        audit: <div className="p-4">Audit Panel (Cleaned)</div>,
        system: <div className="p-4">System Panel (Cleaned)</div>,
    };

    return (
        <div className="space-y-5 py-1">
            <h1 className="text-2xl font-bold">Settings & Maintenance</h1>
            <div style={{ ...CARD, overflow: 'hidden' }}>
                <div className="flex overflow-x-auto border-b border-stone-200">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-5 py-3.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${tab === key ? 'border-amber-900 text-amber-900' : 'border-transparent text-stone-400'}`}>
                            <Icon className="w-4 h-4" />{label}
                        </button>
                    ))}
                </div>
                <div className="p-6 bg-[#faf7f2]">{PANEL[tab]}</div>
            </div>
        </div>
    );
}