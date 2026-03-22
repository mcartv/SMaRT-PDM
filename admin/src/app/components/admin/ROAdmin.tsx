import { useState } from 'react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { CheckCircle, XCircle, Clock, FileText, Building2, Calendar, User, Bell } from 'lucide-react';

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
} as const;

const CARD = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
} as const;

// ─── Config ──────────────────────────────────────────────────
const SCHOLARSHIP_STYLE: Record<string, { bg: string; color: string }> = {
  TES: { bg: C.blueSoft, color: C.blue },
  TDP: { bg: C.greenSoft, color: C.green },
  Private: { bg: '#FAF5FF', color: '#7c3aed' },
};

// ─── Data ────────────────────────────────────────────────────
const PENDING = [
  { id: 'RO-001', student: { name: 'Juan Dela Cruz', id: 'S2023-001', program: 'TES' }, obligation: 'Community Service — Library', type: 'Community Service', submitted: 'Oct 28, 2025', doc: 'certificate_library.pdf', dept: 'Library', hours: '40 hrs' },
  { id: 'RO-002', student: { name: 'Maria Santos', id: 'S2023-002', program: 'TDP' }, obligation: 'Tutorial Program — Mathematics', type: 'Tutorial Service', submitted: 'Oct 27, 2025', doc: 'tutorial_completion.pdf', dept: 'Mathematics Dept', hours: '30 hrs' },
  { id: 'RO-003', student: { name: 'Ana Reyes', id: 'S2023-003', program: 'TES' }, obligation: 'Campus Cleanup Drive', type: 'Community Service', submitted: 'Oct 26, 2025', doc: 'cleanup_certificate.pdf', dept: 'Facilities', hours: '20 hrs' },
];

const VERIFIED = [
  { id: 'RO-124', student: { name: 'Pedro Garcia', id: 'S2023-004', program: 'Private' }, obligation: 'Library Organization', verifiedBy: 'Ms. Cruz (Library Head)', verifiedDate: 'Oct 25, 2025' },
  { id: 'RO-123', student: { name: 'Rosa Lopez', id: 'S2023-005', program: 'TES' }, obligation: 'Math Tutorial Sessions', verifiedBy: 'Dr. Santos (Math Dept)', verifiedDate: 'Oct 24, 2025' },
];

const OVERDUE = [
  { id: 'RO-OVER-001', student: { name: 'Carlos Martinez', id: 'S2023-006', program: 'TDP' }, obligation: 'Community Service — Required', dueDate: 'Oct 15, 2025', daysOverdue: 14 },
  { id: 'RO-OVER-002', student: { name: 'Lisa Fernandez', id: 'S2023-007', program: 'TES' }, obligation: 'Tutorial Program', dueDate: 'Oct 10, 2025', daysOverdue: 19 },
];

const STATS = [
  { label: 'Pending', value: '16', color: C.orange, icon: Clock },
  { label: 'Verified', value: '124', color: C.green, icon: CheckCircle },
  { label: 'Overdue', value: '3', color: C.red, icon: XCircle },
  { label: 'Completion Rate', value: '89%', color: C.blue, icon: null },
];

const TABS = [
  { key: 'pending', label: 'Pending', count: 16, color: C.orange },
  { key: 'verified', label: 'Verified', count: 124, color: C.green },
  { key: 'overdue', label: 'Overdue', count: 3, color: C.red },
] as const;
type TabKey = typeof TABS[number]['key'];

// ─── Helpers ─────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function ScholarshipPill({ program }: { program: string }) {
  const s = SCHOLARSHIP_STYLE[program] ?? { bg: C.bg, color: C.muted };
  return (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md"
      style={{ background: s.bg, color: s.color }}>
      {program}
    </span>
  );
}

function ActionBtn({ children, color, soft, onClick }: {
  children: React.ReactNode; color: string; soft: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl text-xs font-semibold border transition-all"
      style={{ background: soft, borderColor: color + '55', color }}
      onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.95)')}
      onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
    >
      {children}
    </button>
  );
}

function MetaItem({ icon: Icon, label, value }: { icon: React.FC<any>; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>
        <Icon className="w-3 h-3" />{label}
      </p>
      <p className="text-xs font-medium text-gray-800">{value}</p>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────
export default function ROAdmin() {
  const [tab, setTab] = useState<TabKey>('pending');

  return (
    <div className="space-y-5 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Return of Obligations</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage and verify scholar obligations</p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} style={CARD} className="p-5 flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5 font-medium">{s.label}</p>
            </div>
            {s.icon && (
              <s.icon className="w-8 h-8 opacity-10" style={{ color: s.color }} />
            )}
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div style={CARD} className="overflow-hidden">

        {/* Tab strip */}
        <div className="flex border-b" style={{ borderColor: C.border }}>
          {TABS.map(({ key, label, count, color }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-all"
              style={{
                borderBottomColor: tab === key ? color : 'transparent',
                color: tab === key ? color : C.muted,
                background: 'transparent',
              }}
            >
              {label}
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                style={{
                  background: tab === key ? color + '18' : C.bg,
                  color: tab === key ? color : C.muted,
                }}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        {/* ── Pending ── */}
        {tab === 'pending' && (
          <div className="divide-y" style={{ '--tw-divide-opacity': 1, borderColor: C.border } as React.CSSProperties}>
            {PENDING.map((ro) => (
              <div key={ro.id} className="p-5">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

                  {/* Student */}
                  <div className="lg:col-span-3 flex items-center gap-3">
                    <Avatar className="w-10 h-10 shrink-0">
                      <AvatarFallback className="text-xs font-bold text-white" style={{ background: C.blue }}>
                        {initials(ro.student.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{ro.student.name}</p>
                      <p className="text-[11px] font-mono text-gray-400">{ro.student.id}</p>
                      <ScholarshipPill program={ro.student.program} />
                    </div>
                  </div>

                  {/* Details */}
                  <div className="lg:col-span-6 space-y-2.5">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>Obligation</p>
                      <p className="text-sm font-semibold text-gray-900">{ro.obligation}</p>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-md mt-1 inline-block"
                        style={{ background: C.orangeSoft, color: C.orange }}>
                        {ro.type} · {ro.hours}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <MetaItem icon={Calendar} label="Submitted" value={ro.submitted} />
                      <MetaItem icon={Building2} label="Dept" value={ro.dept} />
                      <div>
                        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: C.muted }}>
                          <FileText className="w-3 h-3" />Document
                        </p>
                        <p className="text-xs font-medium truncate" style={{ color: C.blueMid }}>{ro.doc}</p>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="lg:col-span-3 flex flex-col gap-2">
                    <ActionBtn color={C.green} soft={C.greenSoft}>
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </ActionBtn>
                    <ActionBtn color={C.red} soft={C.redSoft}>
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </ActionBtn>
                    <ActionBtn color={C.blueMid} soft={C.blueSoft}>
                      <User className="w-3.5 h-3.5" /> Assign to Dept Head
                    </ActionBtn>
                  </div>
                </div>
              </div>
            ))}

            {/* Dept Head Info banner */}
            <div className="p-5" style={{ background: C.blueSoft }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.blueSoft, border: `1px solid #bfdbfe` }}>
                    <User className="w-4 h-4" style={{ color: C.blue }} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">Department Head View</p>
                    <p className="text-xs text-gray-500">Library Department · 2 items pending your approval</p>
                  </div>
                </div>
                <button
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ background: C.blue }}
                >
                  <CheckCircle className="w-3.5 h-3.5" /> Verify
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Verified ── */}
        {tab === 'verified' && (
          <div className="divide-y" style={{ borderColor: C.border }}>
            {VERIFIED.map((ro) => (
              <div key={ro.id} className="p-5 flex items-center gap-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: C.greenSoft }}>
                  <CheckCircle className="w-4 h-4" style={{ color: C.green }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-gray-900">{ro.student.name}</p>
                    <ScholarshipPill program={ro.student.program} />
                  </div>
                  <p className="text-xs text-gray-500">{ro.obligation}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Verified by {ro.verifiedBy} · {ro.verifiedDate}
                  </p>
                </div>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
                  style={{ background: C.greenSoft, color: C.green }}>
                  Verified
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ── Overdue ── */}
        {tab === 'overdue' && (
          <div className="divide-y" style={{ borderColor: C.border }}>
            {OVERDUE.map((ro) => (
              <div key={ro.id} className="p-5 flex items-center gap-4"
                style={{ background: '#fffafa' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: C.redSoft }}>
                  <XCircle className="w-4 h-4" style={{ color: C.red }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-bold text-gray-900">{ro.student.name}</p>
                    <ScholarshipPill program={ro.student.program} />
                  </div>
                  <p className="text-xs text-gray-500">{ro.obligation}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-[11px] text-gray-400">Due {ro.dueDate}</p>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: C.redSoft, color: C.red }}>
                      {ro.daysOverdue}d overdue
                    </span>
                  </div>
                </div>
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border shrink-0 transition-colors"
                  style={{ borderColor: C.border, color: C.orange, background: C.white }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.orangeSoft)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.white)}
                >
                  <Bell className="w-3.5 h-3.5" /> Send Reminder
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}