import React, { useState, useEffect } from 'react';
// --- SHADCN UI COMPONENTS ---
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// --- ICONS ---
import {
    Building2, BookOpen, GraduationCap, SlidersHorizontal,
    Users, Cpu, ClipboardList, Plus, Edit, Trash2,
    CheckSquare, Square, Activity, FileSearch,
    ToggleLeft, ToggleRight, Check, Bell, Globe,
    Lock, Database, RefreshCw, Save, Moon, Sun, Monitor,
    ClipboardCheck, Clock, X, GripVertical, Calendar, Settings
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

// ─── Shared UI Sub-components ───────────────────────────────

function FieldLabel({ children }) {
    return (
        <label className="text-[11px] font-bold uppercase tracking-widest block mb-1.5 text-stone-400">
            {children}
        </label>
    );
}

function GroupCard({ title, icon: Icon, children }) {
    return (
        <Card className="overflow-hidden border-stone-200 shadow-sm bg-white">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-stone-100 bg-stone-50/50">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-stone-200 shadow-sm">
                    <Icon className="w-4 h-4 text-stone-600" />
                </div>
                <p className="text-sm font-bold text-stone-800">{title}</p>
            </div>
            <CardContent className="p-6 space-y-6">{children}</CardContent>
        </Card>
    );
}

function Toggle({ value, onChange, labels = ['Enabled', 'Disabled'] }) {
    return (
        <button onClick={() => onChange(!value)} className="flex items-center gap-2 group">
            {value ? <ToggleRight className="w-7 h-7 text-green-600" /> : <ToggleLeft className="w-7 h-7 text-stone-300" />}
            <span className={`text-xs font-bold uppercase tracking-wider ${value ? 'text-green-600' : 'text-stone-400'}`}>
                {value ? labels[0] : labels[1]}
            </span>
        </button>
    );
}

// ─── Panels ─────────────────────────────────────────────────

function GeneralPanel() {
    const [instName, setInstName] = useState('Pambayang Dalubhasaan ng Marilao');
    const [appOpen, setAppOpen] = useState(true);
    const [saved, setSaved] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h2 className="text-xl font-bold text-stone-900">General Configuration</h2>
                    <p className="text-sm text-stone-500">System-wide preferences and institutional identity</p>
                </div>
                <Button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
                    className="rounded-xl font-bold shadow-lg text-white border-none" style={{ background: saved ? C.green : C.brownMid }}>
                    {saved ? <Check size={16} className="mr-2" /> : <Save size={16} className="mr-2" />}
                    {saved ? 'Saved' : 'Save Changes'}
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <GroupCard title="Institution Info" icon={Globe}>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <FieldLabel>Institution Name</FieldLabel>
                            <Input value={instName} onChange={e => setInstName(e.target.value)} className="rounded-xl bg-stone-50/50" />
                        </div>
                        <div className="space-y-1.5">
                            <FieldLabel>Office Email</FieldLabel>
                            <Input defaultValue="osfa@pdm.edu.ph" className="rounded-xl bg-stone-50/50" />
                        </div>
                    </div>
                </GroupCard>

                <GroupCard title="Application Window" icon={Calendar}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-100">
                            <div>
                                <p className="text-[10px] font-bold text-stone-400 uppercase">Status</p>
                                <Toggle value={appOpen} onChange={setAppOpen} labels={['Registration Open', 'Registration Closed']} />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <FieldLabel>Global Deadline</FieldLabel>
                            <Input type="date" defaultValue="2026-03-31" className="rounded-xl bg-stone-50/50" />
                        </div>
                    </div>
                </GroupCard>
            </div>
        </div>
    );
}

function BenefactorsPanel() {
    const [items, setItems] = useState([
        { id: 1, name: 'Kaizen Corporation', slots: 100, gwa: 2.00, status: 'published' },
        { id: 2, name: 'Genmart Holdings', slots: 50, gwa: 1.75, status: 'published' },
    ]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-stone-900">Benefactors & GWA Control</h2>
                <Button className="rounded-xl font-bold text-white border-none" style={{ background: C.brownMid }}><Plus size={16} className="mr-2" /> Add Partner</Button>
            </div>

            <Card className="border-stone-200 shadow-sm overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-stone-50/80 border-b border-stone-100">
                        <tr>
                            <th className="px-6 py-4 font-bold uppercase text-[10px] text-stone-400 tracking-widest">Partner Name</th>
                            <th className="px-6 py-4 font-bold uppercase text-[10px] text-stone-400 tracking-widest text-center">GWA Cutoff</th>
                            <th className="px-6 py-4 font-bold uppercase text-[10px] text-stone-400 tracking-widest text-center">Slots</th>
                            <th className="px-6 py-4 font-bold uppercase text-[10px] text-stone-400 tracking-widest text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                        {items.map(b => (
                            <tr key={b.id} className="hover:bg-amber-50/10 transition-colors">
                                <td className="px-6 py-4 font-bold text-stone-800">{b.name}</td>
                                <td className="px-6 py-4 text-center">
                                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 font-bold font-mono px-3 border-none">
                                        {b.gwa.toFixed(2)}
                                    </Badge>
                                </td>
                                <td className="px-6 py-4 text-center font-bold text-stone-500">{b.slots}</td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="outline" size="sm" className="h-8 rounded-lg text-[10px] font-bold uppercase border-stone-200 text-stone-600"><Edit size={14} /></Button>
                                        <Button variant="outline" size="sm" className="h-8 rounded-lg border-red-100 text-red-500 hover:bg-red-50 p-2"><Trash2 size={14} /></Button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}

function SystemPanel() {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold text-stone-900">System Efficiency & OCR</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 border-stone-200 shadow-sm flex flex-col items-center justify-center text-center">
                    <Cpu className="w-10 h-10 text-stone-300 mb-4" />
                    <p className="text-2xl font-bold text-stone-800">Tesseract v5.3</p>
                    <p className="text-[10px] font-bold uppercase text-stone-400 mt-1 tracking-widest">Core OCR Engine</p>
                </Card>
                <Card className="p-6 border-stone-200 shadow-sm flex flex-col items-center justify-center text-center">
                    <Activity className="w-10 h-10 text-green-400 mb-4" />
                    <p className="text-2xl font-bold text-stone-800">94.2%</p>
                    <p className="text-[10px] font-bold uppercase text-stone-400 mt-1 tracking-widest">Success Rate</p>
                </Card>
                <Card className="p-6 border-stone-200 shadow-sm flex flex-col items-center justify-center text-center">
                    <Database className="w-10 h-10 text-blue-400 mb-4" />
                    <p className="text-2xl font-bold text-stone-800">14.2 GB</p>
                    <p className="text-[10px] font-bold uppercase text-stone-400 mt-1 tracking-widest">Storage Used</p>
                </Card>
            </div>

            <GroupCard title="Manual Overrides" icon={Settings}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 rounded-xl bg-stone-50 border border-stone-100 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-stone-800">Maintenance Mode</p>
                            <p className="text-xs text-stone-400 mt-0.5">Disable student portal access</p>
                        </div>
                        <Toggle value={false} labels={['Offline', 'Online']} />
                    </div>
                    <Button variant="outline" className="h-auto py-4 rounded-xl border-stone-200 flex flex-col items-center gap-1 group hover:border-stone-400 bg-white">
                        <RefreshCw size={20} className="text-stone-400 group-hover:rotate-180 transition-transform duration-500" />
                        <span className="text-xs font-bold uppercase tracking-widest">Run Manual DB Backup</span>
                    </Button>
                </div>
            </GroupCard>
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────

export default function SettingsMaintenance() {
    const [tab, setTab] = useState('general');

    const TABS = [
        { key: 'general', label: 'General', icon: SlidersHorizontal },
        { key: 'benefactors', label: 'Benefactors', icon: Building2 },
        { key: 'courses', label: 'Courses', icon: BookOpen },
        { key: 'system', label: 'System', icon: Cpu },
        { key: 'audit', label: 'Audit', icon: ClipboardList },
    ];

    return (
        <div className="space-y-6 py-2 animate-in fade-in duration-500">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-stone-900">Settings & Maintenance</h1>
                <p className="text-sm font-medium text-stone-400 mt-1 uppercase tracking-widest">Integrated Management Control</p>
            </div>

            <Card className="border-stone-200 shadow-sm overflow-hidden min-h-[600px]">
                {/* Tab Navigation */}
                <div className="flex border-b border-stone-100 bg-stone-50/50 overflow-x-auto">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-widest border-b-2 transition-all shrink-0 ${tab === t.key ? 'text-blue-900 border-blue-900 bg-white' : 'text-stone-400 border-transparent hover:text-stone-600'
                                }`}
                        >
                            <t.icon size={14} />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content Area */}
                <div className="p-8">
                    {tab === 'general' && <GeneralPanel />}
                    {tab === 'benefactors' && <BenefactorsPanel />}
                    {tab === 'system' && <SystemPanel />}
                    {tab === 'courses' && (
                        <div className="flex flex-col items-center justify-center h-64 text-stone-400 opacity-50">
                            <BookOpen size={48} className="mb-4" />
                            <p className="text-sm font-bold uppercase tracking-widest">Course Registry Under Migration</p>
                        </div>
                    )}
                    {tab === 'audit' && (
                        <div className="flex flex-col items-center justify-center h-64 text-stone-400 opacity-50">
                            <ClipboardList size={48} className="mb-4" />
                            <p className="text-sm font-bold uppercase tracking-widest">Audit Trail Access Restricted</p>
                        </div>
                    )}
                </div>
            </Card>

            <footer className="pt-10 pb-6 border-t border-stone-100 text-center">
                <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest italic">SMaRT PDM Integrated Maintenance · Administrative Control Layer</p>
            </footer>
        </div>
    );
}