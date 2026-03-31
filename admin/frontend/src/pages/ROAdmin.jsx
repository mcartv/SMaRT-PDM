import React, { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle, XCircle, Clock, FileText, Building2,
  Calendar, User, Bell, Settings, RotateCcw, Package,
  ChevronDown, ChevronUp, Check, AlertTriangle,
} from 'lucide-react';

// ─── Palette ─────────────────────────────────────────────────
const C = {
  blue: '#1E3A8A',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  orange: '#d97706',
  orangeSoft: '#FFF7ED',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  border: '#E5E7EB',
  muted: '#6B7280',
  text: '#111827',
  bg: '#F9FAFB',
  white: '#FFFFFF',
};

const SCHOLARSHIP_STYLE = {
  TES: { bg: '#EFF6FF', color: '#1E3A8A' },
  TDP: { bg: '#F0FDF4', color: '#16a34a' },
  Private: { bg: '#FAF5FF', color: '#7c3aed' },
};

const DIST_ITEMS = ['DDR Form', 'T-shirt'];

// ─── Data ────────────────────────────────────────────────────
const INIT_PENDING = [
  {
    id: 'RO-001',
    student: { name: 'Juan Dela Cruz', id: 'S2023-001', program: 'TES' },
    obligation: 'Community Service — Library',
    type: 'Community Service',
    submitted: 'Oct 28, 2025',
    doc: 'certificate_library.pdf',
    dept: 'Library',
    hoursLogged: 40,
    carryOver: false,
    prevSem: '',
    distributed: { 'DDR Form': true, 'T-shirt': false },
  },
  {
    id: 'RO-002',
    student: { name: 'Maria Santos', id: 'S2023-002', program: 'TDP' },
    obligation: 'Tutorial Program — Mathematics',
    type: 'Tutorial Service',
    submitted: 'Oct 27, 2025',
    doc: 'tutorial_completion.pdf',
    dept: 'Mathematics Dept',
    hoursLogged: 30,
    carryOver: true,
    prevSem: '2nd Sem AY 2024-25',
    distributed: { 'DDR Form': false, 'T-shirt': false },
  },
  {
    id: 'RO-003',
    student: { name: 'Ana Reyes', id: 'S2023-003', program: 'TES' },
    obligation: 'Campus Cleanup Drive',
    type: 'Community Service',
    submitted: 'Oct 26, 2025',
    doc: 'cleanup_certificate.pdf',
    dept: 'Facilities',
    hoursLogged: 20,
    carryOver: false,
    prevSem: '',
    distributed: { 'DDR Form': true, 'T-shirt': true },
  },
];

const VERIFIED = [
  { id: 'RO-124', student: { name: 'Pedro Garcia', id: 'S2023-004', program: 'Private' }, obligation: 'Library Organization', verifiedBy: 'Ms. Cruz (Library Head)', verifiedDate: 'Oct 25, 2025', hoursLogged: 20, distributed: { 'DDR Form': true, 'T-shirt': true } },
  { id: 'RO-123', student: { name: 'Rosa Lopez', id: 'S2023-005', program: 'TES' }, obligation: 'Math Tutorial Sessions', verifiedBy: 'Dr. Santos (Math Dept)', verifiedDate: 'Oct 24, 2025', hoursLogged: 30, distributed: { 'DDR Form': true, 'T-shirt': false } },
];

const OVERDUE = [
  { id: 'RO-OVER-001', student: { name: 'Carlos Martinez', id: 'S2023-006', program: 'TDP' }, obligation: 'Community Service — Required', dueDate: 'Oct 15, 2025', daysOverdue: 14, carryOver: false },
  { id: 'RO-OVER-002', student: { name: 'Lisa Fernandez', id: 'S2023-007', program: 'TES' }, obligation: 'Tutorial Program', dueDate: 'Oct 10, 2025', daysOverdue: 19, carryOver: true, prevSem: '1st Sem AY 2024-25' },
];

const HISTORY = [
  { sem: '2nd Sem AY 2023-24', required: 50 },
  { sem: '1st Sem AY 2024-25', required: 20 },
  { sem: '2nd Sem AY 2024-25', required: 20 },
];

// ─── Sub-components ───────────────────────────────────────────

function ScholarPill({ program }) {
  const s = SCHOLARSHIP_STYLE[program] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md" style={{ background: s.bg, color: s.color }}>
      {program}
    </span>
  );
}

function HoursBar({ logged, required }) {
  const pct = Math.min(100, Math.round((logged / required) * 100));
  const met = logged >= required;
  const color = met ? C.green : logged >= required * 0.5 ? C.orange : C.red;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-stone-500">
          Hours · {logged}/{required} hrs
        </span>
        <span className="text-[11px] font-bold" style={{ color }}>
          {pct}%{met ? ' ✓' : ''}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-stone-200">
        <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: pct + '%', background: color }} />
      </div>
    </div>
  );
}

function DistChecklist({ distributed, onToggle }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-stone-500 mb-1.5">
        <Package className="w-3 h-3" /> Distribution
      </p>
      <div className="flex gap-2">
        {DIST_ITEMS.map(item => {
          const done = distributed[item];
          return (
            <button key={item} onClick={() => onToggle(item)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all"
              style={{
                background: done ? C.greenSoft : C.white,
                borderColor: done ? C.green : C.border,
                color: done ? C.green : C.muted,
              }}>
              {done ? <Check className="w-3 h-3" /> : <div className="w-3 h-3 rounded-sm border border-stone-300" />}
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function ROAdmin() {
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState(INIT_PENDING);
  const [expanded, setExpanded] = useState(null);
  const [reqHours, setReqHours] = useState(20);
  const [currentSem, setCurrentSem] = useState('1st Sem AY 2025-26');
  const [configSaved, setConfigSaved] = useState(false);

  const toggleDist = (roId, item) => {
    setPending(prev => prev.map(r =>
      r.id === roId ? { ...r, distributed: { ...r.distributed, [item]: !r.distributed[item] } } : r
    ));
  };

  const initials = (name) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Return of Obligations</h1>
          <p className="text-sm font-medium text-stone-400 mt-1 uppercase tracking-widest">{currentSem}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-50 border border-orange-200">
          <Clock className="w-4 h-4 text-orange-600" />
          <div>
            <p className="text-[10px] font-semibold uppercase text-orange-600">Requirement</p>
            <p className="text-lg font-bold leading-tight text-orange-700">{reqHours} hrs</p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pending', value: '16', color: C.orange, icon: Clock },
          { label: 'Verified', value: '124', color: C.green, icon: CheckCircle },
          { label: 'Overdue', value: '3', color: C.red, icon: XCircle },
          { label: 'Carry-Over', value: '2', color: C.orange, icon: RotateCcw },
        ].map(s => (
          <div key={s.label} className="p-5 flex items-center justify-between bg-white border border-stone-200 rounded-2xl shadow-sm">
            <div>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-semibold text-stone-400 mt-0.5">{s.label}</p>
            </div>
            <s.icon className="w-8 h-8 opacity-10" style={{ color: s.color }} />
          </div>
        ))}
      </div>

      {/* Tabs Layout */}
      <div className="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex border-b border-stone-100 bg-stone-50/50">
          {[
            { key: 'pending', label: 'Pending', color: C.orange },
            { key: 'verified', label: 'Verified', color: C.green },
            { key: 'overdue', label: 'Overdue', color: C.red },
            { key: 'config', label: 'Settings', color: C.blue },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-semibold border-b-2 transition-all ${tab === t.key ? '' : 'text-stone-400 border-transparent hover:text-stone-600'}`}
              style={{ borderBottomColor: tab === t.key ? t.color : 'transparent', color: tab === t.key ? t.color : '' }}>
              {t.key === 'config' && <Settings className="w-3.5 h-3.5" />}
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab Content: Pending */}
        {tab === 'pending' && (
          <div className="divide-y divide-stone-100">
            {pending.map(ro => (
              <div key={ro.id} className="p-6 hover:bg-stone-50/50 transition-colors">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-3 flex items-center gap-3">
                    <Avatar className="w-10 h-10 border border-stone-200 shadow-sm">
                      <AvatarFallback className="text-xs font-bold bg-blue-900 text-white">{initials(ro.student.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-900 truncate">{ro.student.name}</p>
                      <p className="text-[11px] font-mono text-stone-400">{ro.student.id}</p>
                      <div className="mt-1 flex gap-1">
                        <ScholarPill program={ro.student.program} />
                        {ro.carryOver && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100 uppercase tracking-tighter">Carry-over</span>}
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-6 space-y-4">
                    <div>
                      <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">Obligation & Type</p>
                      <p className="text-sm font-semibold text-stone-800 leading-tight">{ro.obligation}</p>
                      <Badge variant="outline" className="mt-1.5 text-[9px] font-bold bg-stone-100 border-stone-200 text-stone-600">{ro.type}</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-[9px] font-bold text-stone-400 uppercase mb-0.5">Submitted</p>
                        <p className="text-xs font-semibold text-stone-700">{ro.submitted}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-stone-400 uppercase mb-0.5">Dept</p>
                        <p className="text-xs font-semibold text-stone-700">{ro.dept}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-bold text-stone-400 uppercase mb-0.5">Document</p>
                        <p className="text-xs font-semibold text-blue-600 underline truncate">{ro.doc}</p>
                      </div>
                    </div>
                    <HoursBar logged={ro.hoursLogged} required={reqHours} />
                    <button onClick={() => setExpanded(expanded === ro.id ? null : ro.id)} className="flex items-center gap-1.5 text-[11px] font-bold text-stone-400 hover:text-stone-600 transition-colors">
                      <Package className="w-3.5 h-3.5" /> Distribution Checklist {expanded === ro.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                    {expanded === ro.id && (
                      <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 animate-in slide-in-from-top-2">
                        <DistChecklist distributed={ro.distributed} onToggle={(item) => toggleDist(ro.id, item)} />
                      </div>
                    )}
                  </div>
                  <div className="lg:col-span-3 flex flex-col gap-2">
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold text-xs h-10 rounded-xl"><CheckCircle className="w-4 h-4 mr-2" /> Approve</Button>
                    <Button variant="outline" className="w-full text-red-600 border-red-100 hover:bg-red-50 font-bold text-xs h-10 rounded-xl"><XCircle className="w-4 h-4 mr-2" /> Reject</Button>
                    <Button variant="ghost" className="w-full text-stone-500 font-bold text-[10px] uppercase h-8 hover:bg-stone-100">Assign Head</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content: Verified */}
        {tab === 'verified' && (
          <div className="divide-y divide-stone-100">
            {VERIFIED.map(ro => (
              <div key={ro.id} className="p-6">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-stone-900">{ro.student.name}</p>
                      <ScholarPill program={ro.student.program} />
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">{ro.obligation} · Verified by {ro.verifiedBy}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-700 border-none font-bold text-[10px]">VERIFIED</Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab Content: Settings */}
        {tab === 'config' && (
          <div className="p-8 max-w-2xl space-y-8">
            <div>
              <h3 className="text-lg font-bold text-stone-900">RO Hours Configuration</h3>
              <p className="text-sm text-stone-500 mt-1">Set the baseline requirement for service obligations.</p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Active Semester</label>
                <Input value={currentSem} onChange={e => setCurrentSem(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Required Hours</label>
                <div className="flex items-center gap-4">
                  <input type="range" min="10" max="100" value={reqHours} onChange={e => setReqHours(parseInt(e.target.value))} className="flex-1 accent-orange-600" />
                  <span className="text-xl font-bold text-orange-600 w-12 text-center">{reqHours}</span>
                </div>
              </div>
            </div>
            <div className="pt-6 border-t border-stone-100">
              <Button onClick={() => { setConfigSaved(true); setTimeout(() => setConfigSaved(false), 2000); }}
                className={`h-11 px-8 rounded-xl font-bold transition-all ${configSaved ? 'bg-green-600' : 'bg-blue-900 text-white'}`}>
                {configSaved ? '✓ Configuration Saved' : 'Update Requirements'}
              </Button>
            </div>
          </div>
        )}
      </div>

      <footer className="pt-8 pb-4 text-center border-t border-stone-100">
        <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest">Secure Integrated Monitoring · RO Subsystem</p>
      </footer>
    </div>
  );
}