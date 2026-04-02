import React, { useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  CheckCircle, XCircle, Clock, FileText, Building2,
  Calendar, User, Bell, Settings, RotateCcw, Package,
  ChevronDown, ChevronUp, Check, AlertTriangle, CheckCircle2,
} from 'lucide-react';

// ─── Shared Admin Palette ───────────────────────────────────────
const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  blue: '#1E3A8A',
  blueSoft: '#EFF6FF',
  border: '#e7e5e4',
  muted: '#78716c',
  text: '#1c1917',
  bg: '#faf7f2',
  white: '#FFFFFF',
};

const SCHOLARSHIP_STYLE = {
  TES: { bg: '#EFF6FF', color: '#1E3A8A' },
  TDP: { bg: '#F0FDF4', color: '#16a34a' },
  Private: { bg: '#FAF5FF', color: '#7c3aed' },
};

const DIST_ITEMS = ['DDR Form', 'T-shirt'];

// ─── Data ───────────────────────────────────────────────────────
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
  {
    id: 'RO-124',
    student: { name: 'Pedro Garcia', id: 'S2023-004', program: 'Private' },
    obligation: 'Library Organization',
    verifiedBy: 'Ms. Cruz (Library Head)',
    verifiedDate: 'Oct 25, 2025',
    hoursLogged: 20,
    distributed: { 'DDR Form': true, 'T-shirt': true },
  },
  {
    id: 'RO-123',
    student: { name: 'Rosa Lopez', id: 'S2023-005', program: 'TES' },
    obligation: 'Math Tutorial Sessions',
    verifiedBy: 'Dr. Santos (Math Dept)',
    verifiedDate: 'Oct 24, 2025',
    hoursLogged: 30,
    distributed: { 'DDR Form': true, 'T-shirt': false },
  },
];

const OVERDUE = [
  {
    id: 'RO-OVER-001',
    student: { name: 'Carlos Martinez', id: 'S2023-006', program: 'TDP' },
    obligation: 'Community Service — Required',
    dueDate: 'Oct 15, 2025',
    daysOverdue: 14,
    carryOver: false,
  },
  {
    id: 'RO-OVER-002',
    student: { name: 'Lisa Fernandez', id: 'S2023-007', program: 'TES' },
    obligation: 'Tutorial Program',
    dueDate: 'Oct 10, 2025',
    daysOverdue: 19,
    carryOver: true,
    prevSem: '1st Sem AY 2024-25',
  },
];

const HISTORY = [
  { sem: '2nd Sem AY 2023-24', required: 50 },
  { sem: '1st Sem AY 2024-25', required: 20 },
  { sem: '2nd Sem AY 2024-25', required: 20 },
];

// ─── UI Helpers ────────────────────────────────────────────────
function ScholarPill({ program }) {
  const s = SCHOLARSHIP_STYLE[program] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span
      className="text-[10px] font-medium px-2 py-1 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {program}
    </span>
  );
}

function StatusChip({ children, tone = 'default' }) {
  const map = {
    default: { bg: '#f5f5f4', color: '#57534e' },
    green: { bg: C.greenSoft, color: C.green },
    amber: { bg: C.amberSoft, color: C.amber },
    red: { bg: C.redSoft, color: C.red },
    blue: { bg: C.blueSoft, color: C.blue },
  };

  const s = map[tone] || map.default;

  return (
    <span
      className="text-[10px] font-medium px-2 py-1 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      {children}
    </span>
  );
}

function HoursBar({ logged, required }) {
  const pct = Math.min(100, Math.round((logged / required) * 100));
  const met = logged >= required;
  const color = met ? C.green : logged >= required * 0.5 ? C.amber : C.red;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
          Hours Progress
        </span>
        <span className="text-[11px] font-semibold" style={{ color }}>
          {logged}/{required} hrs · {pct}%
        </span>
      </div>

      <div className="h-2 rounded-full bg-stone-200 overflow-hidden">
        <div
          className="h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

function DistChecklist({ distributed, onToggle }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-stone-400">
        <Package className="w-3 h-3" />
        Distribution Checklist
      </p>

      <div className="flex flex-wrap gap-2">
        {DIST_ITEMS.map((item) => {
          const done = distributed[item];

          return (
            <button
              key={item}
              onClick={() => onToggle(item)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all"
              style={{
                background: done ? C.greenSoft : C.white,
                borderColor: done ? '#bbf7d0' : C.border,
                color: done ? C.green : C.muted,
              }}
            >
              {done ? (
                <Check className="w-3 h-3" />
              ) : (
                <div className="w-3 h-3 rounded-sm border border-stone-300" />
              )}
              {item}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InfoBlock({ icon: Icon, label, value, className = '' }) {
  return (
    <div className={`rounded-lg border border-stone-200 bg-white px-3 py-3 ${className}`}>
      <div className="flex items-center gap-2 text-stone-400 mb-1">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xs font-medium text-stone-800">{value}</p>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────
export default function ROAdmin() {
  const [tab, setTab] = useState('pending');
  const [pending, setPending] = useState(INIT_PENDING);
  const [expanded, setExpanded] = useState(null);
  const [reqHours, setReqHours] = useState(20);
  const [currentSem, setCurrentSem] = useState('1st Sem AY 2025-26');
  const [configSaved, setConfigSaved] = useState(false);

  const toggleDist = (roId, item) => {
    setPending((prev) =>
      prev.map((r) =>
        r.id === roId
          ? { ...r, distributed: { ...r.distributed, [item]: !r.distributed[item] } }
          : r
      )
    );
  };

  const initials = (name) =>
    name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();

  const stats = useMemo(() => {
    return [
      {
        label: 'Pending',
        value: String(pending.length),
        icon: Clock,
        accent: C.amber,
        soft: C.amberSoft,
      },
      {
        label: 'Verified',
        value: String(VERIFIED.length),
        icon: CheckCircle2,
        accent: C.green,
        soft: C.greenSoft,
      },
      {
        label: 'Overdue',
        value: String(OVERDUE.length),
        icon: AlertTriangle,
        accent: C.red,
        soft: C.redSoft,
      },
      {
        label: 'Carry-Over',
        value: String(
          [...pending, ...OVERDUE].filter((item) => item.carryOver).length
        ),
        icon: RotateCcw,
        accent: C.blue,
        soft: C.blueSoft,
      },
    ];
  }, [pending]);

  const tabs = [
    { key: 'pending', label: 'Pending', color: C.amber },
    { key: 'verified', label: 'Verified', color: C.green },
    { key: 'overdue', label: 'Overdue', color: C.red },
    { key: 'config', label: 'Settings', color: C.blue, icon: Settings },
  ];

  return (
    <div className="space-y-5 py-2" style={{ background: C.bg }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
            Return of Obligations
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            Monitor RO submissions, approvals, overdue cases, and semester requirements
          </p>
        </div>

        <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-orange-600">
            Active Requirement
          </p>
          <p className="text-lg font-semibold text-orange-700 leading-tight">
            {reqHours} hrs
          </p>
          <p className="text-[11px] text-orange-500 mt-0.5">{currentSem}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="border-stone-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: s.soft }}
              >
                <s.icon className="w-4 h-4" style={{ color: s.accent }} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold" style={{ color: C.text }}>
                {s.value}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Panel */}
      <Card className="border-stone-200 shadow-none overflow-hidden">
        <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
          <CardTitle className="text-sm font-semibold text-stone-800">
            RO Tracking Workspace
          </CardTitle>
          <CardDescription className="text-xs">
            Review pending obligations, verified completions, and overdue cases
          </CardDescription>
        </CardHeader>

        {/* Tabs */}
        <div className="flex flex-wrap border-b border-stone-100 bg-white px-2 pt-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                tab === t.key ? '' : 'text-stone-400 border-transparent hover:text-stone-600'
              }`}
              style={{
                borderBottomColor: tab === t.key ? t.color : 'transparent',
                color: tab === t.key ? t.color : undefined,
              }}
            >
              {t.icon ? <t.icon className="w-3.5 h-3.5" /> : null}
              {t.label}
            </button>
          ))}
        </div>

        {/* Pending */}
        {tab === 'pending' && (
          <div className="divide-y divide-stone-100">
            {pending.map((ro) => (
              <div key={ro.id} className="p-5 hover:bg-stone-50/40 transition-colors">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                  {/* Scholar */}
                  <div className="xl:col-span-3 flex items-start gap-3">
                    <Avatar className="w-11 h-11 border border-stone-200 shadow-sm shrink-0">
                      <AvatarFallback className="text-xs font-semibold bg-blue-900 text-white">
                        {initials(ro.student.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900 truncate">
                        {ro.student.name}
                      </p>
                      <p className="text-[11px] font-mono text-stone-400 mt-0.5">
                        {ro.student.id}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <ScholarPill program={ro.student.program} />
                        {ro.carryOver && <StatusChip tone="amber">Carry-Over</StatusChip>}
                      </div>
                    </div>
                  </div>

                  {/* Main details */}
                  <div className="xl:col-span-6 space-y-4">
                    <div>
                      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-400 mb-1">
                        Obligation
                      </p>
                      <p className="text-sm font-semibold text-stone-800 leading-tight">
                        {ro.obligation}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <StatusChip>{ro.type}</StatusChip>
                        {ro.prevSem ? (
                          <StatusChip tone="blue">From {ro.prevSem}</StatusChip>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <InfoBlock
                        icon={Calendar}
                        label="Submitted"
                        value={ro.submitted}
                      />
                      <InfoBlock
                        icon={Building2}
                        label="Department"
                        value={ro.dept}
                      />
                      <InfoBlock
                        icon={FileText}
                        label="Document"
                        value={ro.doc}
                      />
                    </div>

                    <HoursBar logged={ro.hoursLogged} required={reqHours} />

                    <button
                      onClick={() => setExpanded(expanded === ro.id ? null : ro.id)}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-stone-500 hover:text-stone-700 transition-colors"
                    >
                      <Package className="w-3.5 h-3.5" />
                      Distribution Checklist
                      {expanded === ro.id ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {expanded === ro.id && (
                      <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4 animate-in slide-in-from-top-2">
                        <DistChecklist
                          distributed={ro.distributed}
                          onToggle={(item) => toggleDist(ro.id, item)}
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="xl:col-span-3 flex flex-col gap-2">
                    <Button
                      className="w-full h-10 rounded-lg text-white border-none"
                      style={{ background: C.green }}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Approve
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full h-10 rounded-lg border-red-100 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="w-4 h-4 mr-2" />
                      Reject
                    </Button>

                    <Button
                      variant="outline"
                      className="w-full h-10 rounded-lg border-stone-200 text-stone-600"
                    >
                      <User className="w-4 h-4 mr-2" />
                      Assign to Dept
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Verified */}
        {tab === 'verified' && (
          <div className="divide-y divide-stone-100">
            {VERIFIED.map((ro) => (
              <div key={ro.id} className="p-5 hover:bg-stone-50/40 transition-colors">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  <div className="lg:col-span-5 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-green-50 shrink-0">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-stone-900">
                          {ro.student.name}
                        </p>
                        <ScholarPill program={ro.student.program} />
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">{ro.student.id}</p>
                    </div>
                  </div>

                  <div className="lg:col-span-4">
                    <p className="text-sm font-medium text-stone-800">{ro.obligation}</p>
                    <p className="text-xs text-stone-500 mt-1">
                      Verified by {ro.verifiedBy}
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {ro.verifiedDate}
                    </p>
                  </div>

                  <div className="lg:col-span-3 flex items-center justify-start lg:justify-end gap-2">
                    <StatusChip tone="green">Verified</StatusChip>
                    <StatusChip tone="blue">{ro.hoursLogged} hrs</StatusChip>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Overdue */}
        {tab === 'overdue' && (
          <div className="divide-y divide-stone-100">
            {OVERDUE.map((ro) => (
              <div key={ro.id} className="p-5 hover:bg-stone-50/40 transition-colors">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                  <div className="lg:col-span-4 flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-red-50 shrink-0">
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-stone-900">
                          {ro.student.name}
                        </p>
                        <ScholarPill program={ro.student.program} />
                      </div>
                      <p className="text-xs text-stone-500 mt-0.5">{ro.student.id}</p>
                    </div>
                  </div>

                  <div className="lg:col-span-5">
                    <p className="text-sm font-medium text-stone-800">{ro.obligation}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatusChip tone="red">{ro.daysOverdue} days overdue</StatusChip>
                      {ro.carryOver && <StatusChip tone="amber">Carry-Over</StatusChip>}
                      {ro.prevSem ? <StatusChip tone="blue">{ro.prevSem}</StatusChip> : null}
                    </div>
                  </div>

                  <div className="lg:col-span-3 flex items-center justify-start lg:justify-end">
                    <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-red-500 font-medium">
                        Due Date
                      </p>
                      <p className="text-xs font-semibold text-red-700 mt-0.5">
                        {ro.dueDate}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Settings */}
        {tab === 'config' && (
          <div className="p-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
              <Card className="xl:col-span-2 border-stone-200 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-stone-800">
                    RO Hours Configuration
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Set the active semester and the number of required hours for RO compliance
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                        Active Semester
                      </label>
                      <Input
                        value={currentSem}
                        onChange={(e) => setCurrentSem(e.target.value)}
                        className="h-10 rounded-lg border-stone-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-medium uppercase tracking-wide text-stone-400">
                        Required Hours
                      </label>
                      <div className="flex items-center gap-4 rounded-lg border border-stone-200 px-4 py-3 bg-white">
                        <input
                          type="range"
                          min="10"
                          max="100"
                          value={reqHours}
                          onChange={(e) => setReqHours(parseInt(e.target.value))}
                          className="flex-1 accent-orange-600"
                        />
                        <span className="text-lg font-semibold text-orange-600 w-12 text-center">
                          {reqHours}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button
                      onClick={() => {
                        setConfigSaved(true);
                        setTimeout(() => setConfigSaved(false), 2000);
                      }}
                      className="h-10 rounded-lg text-white border-none"
                      style={{ background: configSaved ? C.green : C.blue }}
                    >
                      {configSaved ? '✓ Configuration Saved' : 'Update Requirements'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-stone-200 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-stone-800">
                    Requirement History
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Previous semester RO baselines
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {HISTORY.map((item) => (
                    <div
                      key={item.sem}
                      className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-3 bg-white"
                    >
                      <div>
                        <p className="text-xs font-medium text-stone-800">{item.sem}</p>
                        <p className="text-[11px] text-stone-400 mt-0.5">
                          Required baseline
                        </p>
                      </div>
                      <StatusChip tone="amber">{item.required} hrs</StatusChip>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </Card>

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SMaRT PDM · RO Monitoring Layer
        </p>
      </footer>
    </div>
  );
}