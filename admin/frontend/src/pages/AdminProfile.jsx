import React, { useState } from 'react';
// --- SHADCN UI COMPONENTS ---
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
// --- ICONS ---
import {
    User, Mail, Phone, MapPin, Lock, Eye, EyeOff,
    Save, Check, Camera, Shield, Clock, Activity,
    LogOut, Key, ChevronRight
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

// ─── Mock Data ────────────────────────────────────────────────
const SESSION_LOG = [
    { device: 'Chrome · Windows 11', location: 'Marilao, Bulacan', time: 'Mar 22, 2026 · 10:14 AM', current: true },
    { device: 'Chrome · Android (Mobile)', location: 'Marilao, Bulacan', time: 'Mar 21, 2026 · 08:30 AM', current: false },
];

const ACTIVITY_LOG = [
    { action: 'Approved 3 applications', time: 'Mar 22, 2026 · 10:14 AM' },
    { action: 'Published announcement', time: 'Mar 21, 2026 · 03:22 PM' },
    { action: 'Updated TDP scholarship criteria', time: 'Mar 20, 2026 · 09:00 AM' },
];

// ─── Sub-Components ───────────────────────────────────────────

function SectionCard({ title, icon: Icon, children }) {
    return (
        <Card className="overflow-hidden border-stone-200 shadow-sm">
            <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-stone-100 bg-stone-50/50">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white border border-stone-200 shadow-sm">
                    <Icon className="w-4 h-4 text-stone-600" />
                </div>
                <p className="text-sm font-bold text-stone-800">{title}</p>
            </div>
            <CardContent className="p-6">{children}</CardContent>
        </Card>
    );
}

// ─── Main Component ───────────────────────────────────────────────

export default function AdminProfile() {
    // Personal info
    const [firstName, setFirstName] = useState('Carmelita');
    const [lastName, setLastName] = useState('Dela Cruz');
    const [email, setEmail] = useState('cdelacruz@pdm.edu.ph');
    const [phone, setPhone] = useState('+63 917 123 4567');
    const [position, setPosition] = useState('OSFA Administrator');
    const [department, setDepartment] = useState('Office for Scholarship and Financial Assistance');

    // Security
    const [currentPw, setCurrentPw] = useState('');
    const [newPw, setNewPw] = useState('');
    const [confirmPw, setConfirmPw] = useState('');
    const [showNew, setShowNew] = useState(false);

    // Save states
    const [profileSaved, setProfileSaved] = useState(false);

    const handleProfileSave = () => {
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2500);
    };

    return (
        <div className="space-y-6 py-2 animate-in fade-in duration-500">

            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-stone-900">My Profile</h1>
                <p className="text-sm font-medium text-stone-400 mt-1 uppercase tracking-widest">Account Management & Security</p>
            </div>

            {/* Hero Profile Card */}
            <Card className="border-stone-200 shadow-sm overflow-hidden bg-white">
                <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row items-center gap-8">
                        <div className="relative group shrink-0">
                            <Avatar className="w-24 h-24 border-4 border-white shadow-xl">
                                <AvatarFallback className="text-2xl font-bold bg-blue-900 text-white">CD</AvatarFallback>
                            </Avatar>
                            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <Camera className="w-6 h-6 text-white" />
                            </div>
                        </div>

                        <div className="flex-1 text-center md:text-left">
                            <h2 className="text-2xl font-bold text-stone-900">{firstName} {lastName}</h2>
                            <p className="text-stone-500 font-medium">{position}</p>
                            <p className="text-xs text-stone-400 mt-1 uppercase tracking-wide">{department}</p>
                            <div className="flex items-center justify-center md:justify-start gap-2 mt-4">
                                <Badge className="bg-green-50 text-green-700 border-green-100 font-bold uppercase text-[10px] py-1 px-3">Active</Badge>
                                <Badge variant="outline" className="border-stone-200 text-stone-500 font-bold uppercase text-[10px] py-1 px-3"><Shield className="w-3 h-3 mr-1.5" /> Super Admin</Badge>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 shrink-0">
                            {[
                                { label: 'Processed', value: '284' },
                                { label: 'Verified', value: '91' },
                                { label: 'Reports', value: '18' },
                            ].map(s => (
                                <div key={s.label} className="text-center bg-stone-50 p-3 rounded-xl border border-stone-100">
                                    <p className="text-lg font-bold text-stone-800">{s.value}</p>
                                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-tighter">{s.label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Identity Form */}
                <SectionCard title="Personal Information" icon={User}>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest ml-1">First Name</label>
                                <Input value={firstName} onChange={e => setFirstName(e.target.value)} className="h-10 rounded-xl bg-stone-50/50" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest ml-1">Last Name</label>
                                <Input value={lastName} onChange={e => setLastName(e.target.value)} className="h-10 rounded-xl bg-stone-50/50" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest ml-1">Position / Role</label>
                            <Input value={position} onChange={e => setPosition(e.target.value)} className="h-10 rounded-xl bg-stone-50/50" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest ml-1">Bio / Designation</label>
                            <Textarea value="Managing scholarship systems for PDM students since 2023." className="rounded-xl bg-stone-50/50 resize-none h-24" />
                        </div>
                        <Button onClick={handleProfileSave} className="w-full h-11 rounded-xl font-bold shadow-lg border-none" style={{ background: profileSaved ? C.green : C.brownMid }}>
                            {profileSaved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            {profileSaved ? 'Updates Saved' : 'Save Personal Details'}
                        </Button>
                    </div>
                </SectionCard>

                {/* Access & Security */}
                <div className="space-y-6">
                    <SectionCard title="Security & Access" icon={Lock}>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest ml-1">Account Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
                                    <Input type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-10 pl-10 rounded-xl bg-stone-50/50" />
                                </div>
                            </div>

                            <div className="space-y-1.5 pt-2">
                                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest ml-1">New Password</label>
                                <div className="relative">
                                    <Input type={showNew ? 'text' : 'password'} value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="••••••••" className="h-10 pr-10 rounded-xl bg-stone-50/50" />
                                    <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-300">
                                        {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <Button variant="outline" className="w-full h-11 rounded-xl font-bold border-stone-200">
                                <Key className="w-4 h-4 mr-2 text-stone-400" /> Reset Password
                            </Button>
                        </div>
                    </SectionCard>

                    {/* Active Sessions */}
                    <SectionCard title="Active Sessions" icon={Clock}>
                        <div className="space-y-3">
                            {SESSION_LOG.map((s, i) => (
                                <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-stone-100 bg-stone-50/30">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.current ? 'bg-green-100 text-green-600' : 'bg-stone-100 text-stone-400'}`}>
                                            <Shield size={16} />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-stone-800">{s.device}</p>
                                            <p className="text-[10px] text-stone-400 font-medium">{s.location} · {s.time}</p>
                                        </div>
                                    </div>
                                    {s.current ? (
                                        <Badge className="bg-green-50 text-green-700 font-bold text-[9px] border-none uppercase">Current</Badge>
                                    ) : (
                                        <button className="text-[9px] font-bold uppercase text-red-400 hover:text-red-600 px-2 transition-colors">Revoke</button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                </div>
            </div>

            {/* Activity History */}
            <SectionCard title="Recent Activity" icon={Activity}>
                <div className="space-y-1">
                    {ACTIVITY_LOG.map((a, i) => (
                        <div key={i} className="flex items-center justify-between py-3 border-b border-stone-100 last:border-0 hover:bg-stone-50/50 transition-colors px-2 rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                <span className="text-xs font-semibold text-stone-700">{a.action}</span>
                            </div>
                            <span className="text-[10px] font-bold text-stone-400 uppercase">{a.time}</span>
                        </div>
                    ))}
                </div>
            </SectionCard>

            <footer className="pt-10 pb-6 border-t border-stone-100 text-center">
                <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest italic">SMaRT PDM Identity Manager · Secure Governance Layer</p>
            </footer>
        </div>
    );
}