import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Search, Download, Eye, ChevronLeft, ChevronRight,
  AlertTriangle, History, Shield, SlidersHorizontal, X, Plus,
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
  purple: '#7c3aed',
  purpleSoft: '#FAF5FF',
  border: '#E5E7EB',
  muted: '#6B7280',
  text: '#111827',
  bg: '#F9FAFB',
  white: '#FFFFFF',
} as const;

const BD = '1px solid ' + C.border;

const CARD: React.CSSProperties = {
  background: C.white,
  border: BD,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

// ─── Config ───────────────────────────────────────────────────
const SCHOLARSHIP_STYLE: Record<string, { bg: string; color: string }> = {
  TES: { bg: C.blueSoft, color: C.blue },
  TDP: { bg: C.greenSoft, color: C.green },
  Private: { bg: C.purpleSoft, color: C.purple },
};

const RO_COLOR: Record<string, string> = {
  complete: C.green,
  progress: C.orange,
  behind: C.red,
};

// ─── Types ───────────────────────────────────────────────────
type ROStatus = 'complete' | 'progress' | 'behind';
type SDULevel = 'none' | 'minor' | 'major';

type ReplacementEntry = {
  replacedBy: string; // scholar ID
  replacedName: string;
  reason: string;
  sem: string;
  ay: string;
};

type GWAOverride = {
  originalGwa: number;
  adjustedGwa: number;
  reason: string;
  approvedBy: string;
  benefactor: string;
  date: string;
};

type Scholar = {
  id: string;
  name: string;
  program: string;
  scholarship: string;
  gwa: number;
  status: string;
  roPct: number;
  roStatus: ROStatus;
  sduLevel: SDULevel;
  sduDetails: string;
  replacedFrom: ReplacementEntry | null; // this scholar replaced someone
  gwaOverride: GWAOverride | null;
};

// ─── Static data ─────────────────────────────────────────────
const INIT_SCHOLARS: Scholar[] = [
  {
    id: 'S2023-001', name: 'Dela Cruz, Maria', program: 'BS Computer Science', scholarship: 'TES', gwa: 1.45, status: 'Active', roPct: 100, roStatus: 'complete',
    sduLevel: 'none', sduDetails: '', replacedFrom: null, gwaOverride: null,
  },
  {
    id: 'S2023-002', name: 'Santos, Juan', program: 'BS Business Admin', scholarship: 'TDP', gwa: 1.78, status: 'Active', roPct: 75, roStatus: 'progress',
    sduLevel: 'minor', sduDetails: 'Minor offense: Tardiness during mandatory assembly. Noted by Guidance Office Oct 2025.',
    replacedFrom: null, gwaOverride: null,
  },
  {
    id: 'S2023-003', name: 'Reyes, Ana', program: 'BS Engineering', scholarship: 'TES', gwa: 2.15, status: 'At Risk', roPct: 50, roStatus: 'progress',
    sduLevel: 'none', sduDetails: '',
    replacedFrom: null,
    gwaOverride: {
      originalGwa: 2.15, adjustedGwa: 2.15, reason: 'GWA slightly above cutoff of 2.00. Benefactor (Kaizen) agreed to allow continuation for one semester pending improvement.',
      approvedBy: 'Ma\'am Mangdolor', benefactor: 'Kaizen', date: 'Nov 5, 2025',
    },
  },
  {
    id: 'S2023-004', name: 'Garcia, Pedro', program: 'BS Education', scholarship: 'Private', gwa: 1.62, status: 'Active', roPct: 100, roStatus: 'complete',
    sduLevel: 'none', sduDetails: '',
    replacedFrom: {
      replacedBy: 'S2023-006', replacedName: 'Martinez, Carlos',
      reason: 'Existing LGU sports scholarship — disqualified from Private assistance',
      sem: '1st', ay: '2025-2026',
    },
    gwaOverride: null,
  },
  {
    id: 'S2023-005', name: 'Lopez, Rosa', program: 'BS Nursing', scholarship: 'TES', gwa: 1.55, status: 'Active', roPct: 80, roStatus: 'progress',
    sduLevel: 'none', sduDetails: '', replacedFrom: null, gwaOverride: null,
  },
  {
    id: 'S2023-006', name: 'Martinez, Carlos', program: 'BS Computer Science', scholarship: 'TDP', gwa: 2.35, status: 'At Risk', roPct: 25, roStatus: 'behind',
    sduLevel: 'major', sduDetails: 'Major offense: Academic dishonesty. Case forwarded to SDO. Pending final ruling.',
    replacedFrom: null,
    gwaOverride: null,
  },
  {
    id: 'S2023-007', name: 'Fernandez, Lisa', program: 'BS Psychology', scholarship: 'TES', gwa: 1.42, status: 'Active', roPct: 100, roStatus: 'complete',
    sduLevel: 'none', sduDetails: '', replacedFrom: null, gwaOverride: null,
  },
  {
    id: 'S2023-008', name: 'Torres, Miguel', program: 'BS Architecture', scholarship: 'Private', gwa: 1.88, status: 'Active', roPct: 90, roStatus: 'progress',
    sduLevel: 'none', sduDetails: '', replacedFrom: null,
    gwaOverride: {
      originalGwa: 2.02, adjustedGwa: 1.88, reason: 'GWA recalculated after grade correction submitted by registrar. No override needed — updated to corrected value.',
      approvedBy: 'Ma\'am Mangdolor', benefactor: 'Genmart', date: 'Oct 28, 2025',
    },
  },
  {
    id: 'S2023-009', name: 'Villanueva, Sofia', program: 'BS Accountancy', scholarship: 'TES', gwa: 1.35, status: 'Active', roPct: 100, roStatus: 'complete',
    sduLevel: 'none', sduDetails: '', replacedFrom: null, gwaOverride: null,
  },
  {
    id: 'S2023-010', name: 'Ramos, Daniel', program: 'BS Engineering', scholarship: 'TDP', gwa: 2.05, status: 'At Risk', roPct: 60, roStatus: 'progress',
    sduLevel: 'none', sduDetails: '', replacedFrom: null,
    gwaOverride: {
      originalGwa: 2.05, adjustedGwa: 2.05, reason: 'GWA at 2.05, just above cutoff. Kaizen benefactor allows up to 2.10 per their updated policy. Approved for continuation.',
      approvedBy: 'Ma\'am Mangdolor', benefactor: 'Kaizen', date: 'Nov 1, 2025',
    },
  },
];

const PROGRAMS = ['All Programs', 'Computer Science', 'Engineering', 'Business Admin', 'Education', 'Nursing', 'Psychology', 'Architecture', 'Accountancy'];
const SCHOLARSHIPS = ['All Scholarships', 'TES', 'TDP', 'Private'];
const PAGE_SIZE = 10;

const SUMMARY_STATS = [
  { label: 'Total Scholars', value: '1,280', color: C.blue },
  { label: 'Active', value: '1,103', color: C.green },
  { label: 'At Risk', value: '177', color: C.red },
  { label: 'Average GWA', value: '1.68', color: C.orange },
];

const SDU_STYLE: Record<SDULevel, { label: string; color: string; bg: string }> = {
  none: { label: 'Clear', color: C.green, bg: C.greenSoft },
  minor: { label: 'Minor SDU', color: C.orange, bg: C.orangeSoft },
  major: { label: 'Major SDU', color: C.red, bg: C.redSoft },
};

function gwaColor(gwa: number) {
  if (gwa >= 2.0) return C.red;
  if (gwa >= 1.75) return C.orange;
  return C.green;
}

// ─── GWA Override Modal ───────────────────────────────────────
function GWAOverrideModal({
  scholar, onSave, onClose,
}: { scholar: Scholar; onSave: (id: string, o: GWAOverride) => void; onClose: () => void }) {
  const existing = scholar.gwaOverride;
  const [adjGwa, setAdjGwa] = useState(existing?.adjustedGwa.toString() ?? scholar.gwa.toFixed(2));
  const [reason, setReason] = useState(existing?.reason ?? '');
  const [approvedBy, setApprovedBy] = useState(existing?.approvedBy ?? '');
  const [benefactor, setBenefactor] = useState(existing?.benefactor ?? '');

  function handleSave() {
    if (!reason || !approvedBy || !benefactor) return;
    onSave(scholar.id, {
      originalGwa: scholar.gwa,
      adjustedGwa: parseFloat(adjGwa) || scholar.gwa,
      reason, approvedBy, benefactor,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: C.white }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: BD, background: C.orangeSoft }}>
          <div>
            <p className="text-sm font-bold" style={{ color: C.orange }}>GWA Override / Adjustment</p>
            <p className="text-xs mt-0.5" style={{ color: C.orange }}>{scholar.name} · {scholar.id}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: C.orange }} /></button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Current GWA */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: C.bg }}>
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Current GWA</p>
              <p className="text-xl font-bold" style={{ color: gwaColor(scholar.gwa) }}>{scholar.gwa.toFixed(2)}</p>
            </div>
            <div className="text-lg" style={{ color: C.muted }}>→</div>
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: C.muted }}>Adjusted GWA</p>
              <input
                type="number" step="0.01" min="1.00" max="5.00"
                value={adjGwa}
                onChange={e => setAdjGwa(e.target.value)}
                className="text-xl font-bold text-center w-20 rounded-lg px-2 py-0.5 border focus:outline-none"
                style={{ border: BD, color: C.blue }}
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
              Benefactor
            </label>
            <Input className="h-9 text-sm rounded-xl bg-gray-50"
              placeholder="e.g. Kaizen, Genmart…"
              value={benefactor} onChange={e => setBenefactor(e.target.value)} />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
              Approving Officer
            </label>
            <Input className="h-9 text-sm rounded-xl bg-gray-50"
              placeholder="e.g. Ma'am Mangdolor"
              value={approvedBy} onChange={e => setApprovedBy(e.target.value)} />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
              Reason / Justification
            </label>
            <textarea
              rows={3}
              className="w-full text-sm rounded-xl px-3 py-2.5 border resize-none focus:outline-none"
              style={{ border: BD, background: C.bg, color: C.text }}
              placeholder="State the reason for the GWA adjustment…"
              value={reason} onChange={e => setReason(e.target.value)}
            />
          </div>
        </div>

        <div className="px-5 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-9 rounded-xl text-xs font-semibold border"
            style={{ borderColor: C.border, color: C.muted, background: C.white }}>Cancel</button>
          <button onClick={handleSave} disabled={!reason || !approvedBy || !benefactor}
            className="px-4 h-9 rounded-xl text-xs font-bold text-white disabled:opacity-40"
            style={{ background: C.orange }}>
            Save Override
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SDU Detail Modal ─────────────────────────────────────────
function SDUModal({ scholar, onClose }: { scholar: Scholar; onClose: () => void }) {
  const s = SDU_STYLE[scholar.sduLevel];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: C.white }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: BD, background: s.bg }}>
          <div>
            <p className="text-sm font-bold" style={{ color: s.color }}>Discipline Record (SDU)</p>
            <p className="text-xs mt-0.5" style={{ color: s.color }}>{scholar.name} · {scholar.id}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: s.color }} /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: s.bg }}>
            <Shield className="w-5 h-5 shrink-0" style={{ color: s.color }} />
            <div>
              <p className="text-xs font-bold" style={{ color: s.color }}>{s.label}</p>
              <p className="text-[11px] mt-0.5" style={{ color: s.color }}>
                {scholar.sduLevel === 'none'
                  ? 'No disciplinary records on file.'
                  : scholar.sduLevel === 'minor'
                    ? 'Minor offense — noted by Guidance. Does not directly disqualify.'
                    : 'Major offense — forwarded to SDO. May affect scholarship eligibility.'}
              </p>
            </div>
          </div>
          {scholar.sduDetails && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: C.muted }}>Details</p>
              <p className="text-sm leading-relaxed" style={{ color: C.text }}>{scholar.sduDetails}</p>
            </div>
          )}
          <div className="px-4 py-3 rounded-xl text-xs leading-relaxed" style={{ background: C.bg, color: C.muted }}>
            <strong style={{ color: C.text }}>Policy:</strong> Minor SDU — noted, no immediate action. Major SDU — case forwarded to SDO; scholarship may be suspended pending ruling.
          </div>
        </div>
        <div className="px-5 pb-5 flex justify-end">
          <button onClick={onClose} className="px-4 h-9 rounded-xl text-xs font-semibold border"
            style={{ borderColor: C.border, color: C.muted, background: C.white }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Replacement History Modal ────────────────────────────────
function ReplacementModal({ scholar, onClose }: { scholar: Scholar; onClose: () => void }) {
  const r = scholar.replacedFrom!;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: C.white }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: BD, background: C.blueSoft }}>
          <div>
            <p className="text-sm font-bold" style={{ color: C.blue }}>Replacement History</p>
            <p className="text-xs mt-0.5" style={{ color: C.blue }}>{scholar.name} · {scholar.id}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: C.blue }} /></button>
        </div>
        <div className="px-5 py-5 space-y-4">
          <p className="text-xs" style={{ color: C.muted }}>
            This scholar was promoted from the replacement queue to fill a vacated slot.
          </p>
          {/* Timeline */}
          <div className="relative pl-6">
            <div className="absolute left-2 top-2 bottom-2 w-px" style={{ background: C.border }} />

            <div className="relative mb-5">
              <div className="absolute -left-4 top-1 w-3 h-3 rounded-full border-2 flex-shrink-0"
                style={{ background: C.redSoft, borderColor: C.red }} />
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: C.red }}>Disqualified Scholar</p>
              <div className="px-3 py-2.5 rounded-xl" style={{ background: C.redSoft }}>
                <p className="text-sm font-semibold" style={{ color: C.text }}>{r.replacedName}</p>
                <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>ID: {r.replacedBy}</p>
                <p className="text-[11px] mt-1 font-medium" style={{ color: C.red }}>Reason: {r.reason}</p>
                <p className="text-[10px] mt-1" style={{ color: C.muted }}>{r.sem} Semester · AY {r.ay}</p>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-4 top-1 w-3 h-3 rounded-full border-2 flex-shrink-0"
                style={{ background: C.greenSoft, borderColor: C.green }} />
              <p className="text-[11px] font-bold uppercase tracking-wider mb-1" style={{ color: C.green }}>Replacement Scholar</p>
              <div className="px-3 py-2.5 rounded-xl" style={{ background: C.greenSoft }}>
                <p className="text-sm font-semibold" style={{ color: C.text }}>{scholar.name}</p>
                <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>ID: {scholar.id} · Promoted from waitlist</p>
                <p className="text-[10px] mt-1" style={{ color: C.muted }}>{r.sem} Semester · AY {r.ay}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 pb-5 flex justify-end">
          <button onClick={onClose} className="px-4 h-9 rounded-xl text-xs font-semibold border"
            style={{ borderColor: C.border, color: C.muted, background: C.white }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function ScholarMonitoring() {
  const navigate = useNavigate();

  const [scholars, setScholars] = useState<Scholar[]>(INIT_SCHOLARS);
  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [scholarship, setScholarship] = useState('All Scholarships');
  const [status, setStatus] = useState('All Statuses');
  const [page, setPage] = useState(1);

  // Modals
  const [gwaModal, setGwaModal] = useState<Scholar | null>(null);
  const [sduModal, setSduModal] = useState<Scholar | null>(null);
  const [replModal, setReplModal] = useState<Scholar | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return scholars.filter(s => {
      const matchSearch = !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      const matchProgram = program === 'All Programs' || s.program.includes(program);
      const matchScholarship = scholarship === 'All Scholarships' || s.scholarship === scholarship;
      const matchStatus = status === 'All Statuses' || s.status === status;
      return matchSearch && matchProgram && matchScholarship && matchStatus;
    });
  }, [scholars, search, program, scholarship, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage() { setPage(1); }

  function saveGWAOverride(id: string, override: GWAOverride) {
    setScholars(prev => prev.map(s => s.id === id ? { ...s, gwaOverride: override } : s));
  }

  return (
    <div className="space-y-5 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>

      {/* Modals */}
      {gwaModal && <GWAOverrideModal scholar={gwaModal} onSave={saveGWAOverride} onClose={() => setGwaModal(null)} />}
      {sduModal && <SDUModal scholar={sduModal} onClose={() => setSduModal(null)} />}
      {replModal && <ReplacementModal scholar={replModal} onClose={() => setReplModal(null)} />}

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {SUMMARY_STATS.map(s => (
          <div key={s.label} style={CARD} className="p-5">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs font-medium mt-1" style={{ color: C.muted }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: C.text }}>Scholars</h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>{filtered.length} results · AY 2025–2026</p>
        </div>
        <Button size="sm"
          className="flex items-center gap-1.5 text-white text-xs font-semibold rounded-xl px-4"
          style={{ background: C.blue, border: 'none', height: 36 }}>
          <Download className="w-3.5 h-3.5" /> Export
        </Button>
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {['All Statuses', 'Active', 'At Risk'].map(s => {
          const color = s === 'Active' ? C.green : s === 'At Risk' ? C.red : C.muted;
          const soft = s === 'Active' ? C.greenSoft : s === 'At Risk' ? C.redSoft : C.bg;
          const isActive = status === s;
          return (
            <button key={s} onClick={() => { setStatus(s); resetPage(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
              style={{ background: isActive ? soft : C.white, borderColor: isActive ? color : C.border, color: isActive ? color : C.muted }}>
              {s !== 'All Statuses' && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />}
              {s}
              {s !== 'All Statuses' && (
                <span className="font-bold ml-0.5">{scholars.filter(sc => sc.status === s).length}</span>
              )}
            </button>
          );
        })}
        {/* SDU quick-filter */}
        <button onClick={() => { }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ml-1"
          style={{ background: C.redSoft, borderColor: C.red, color: C.red }}>
          <Shield className="w-3 h-3" />
          SDU Flagged
          <span className="font-bold">{scholars.filter(s => s.sduLevel !== 'none').length}</span>
        </button>
      </div>

      {/* Filter bar */}
      <div style={CARD} className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input placeholder="Search name or ID…" value={search}
              onChange={e => { setSearch(e.target.value); resetPage(); }}
              className="pl-9 h-9 text-sm rounded-xl border-gray-200 bg-gray-50 focus:bg-white" />
          </div>
          <Select value={program} onValueChange={v => { setProgram(v); resetPage(); }}>
            <SelectTrigger className="h-9 w-[180px] text-sm rounded-xl border-gray-200 bg-gray-50"><SelectValue /></SelectTrigger>
            <SelectContent>{PROGRAMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={scholarship} onValueChange={v => { setScholarship(v); resetPage(); }}>
            <SelectTrigger className="h-9 w-[170px] text-sm rounded-xl border-gray-200 bg-gray-50"><SelectValue /></SelectTrigger>
            <SelectContent>{['All Scholarships', 'TES', 'TDP', 'Private'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div style={{ ...CARD, overflow: 'hidden' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: C.bg, borderBottom: BD }}>
                {['Scholar ID', 'Name', 'Program', 'Scholarship', 'GWA', 'Status', 'SDU', 'RO Progress', ''].map((h, i) => (
                  <th key={i}
                    className={'px-4 py-3 text-[11px] font-bold uppercase tracking-wider ' + (i === 8 ? 'text-right pr-5' : 'text-left')}
                    style={{ color: C.muted }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-sm" style={{ color: C.muted }}>
                  No scholars match the current filters.
                </td></tr>
              ) : pageData.map((s, i) => {
                const isAtRisk = s.gwa >= 2.0;
                const schStyle = SCHOLARSHIP_STYLE[s.scholarship] ?? { bg: C.bg, color: C.muted };
                const roColor = RO_COLOR[s.roStatus];
                const sduStyle = SDU_STYLE[s.sduLevel];
                const rowBg = isAtRisk ? '#fff7f7' : i % 2 === 0 ? C.white : C.bg;

                return (
                  <tr key={s.id}
                    style={{ borderBottom: BD, background: rowBg, transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isAtRisk ? '#fee2e2' : '#f0f9ff'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = rowBg}>

                    {/* ID */}
                    <td className="px-4 py-3.5 text-xs font-mono" style={{ color: C.muted }}>{s.id}</td>

                    {/* Name + indicators */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold" style={{ color: C.text }}>{s.name}</span>
                        {isAtRisk && <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: C.red }} />}
                        {/* Replacement history badge */}
                        {s.replacedFrom && (
                          <button onClick={() => setReplModal(s)}
                            className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-colors"
                            style={{ background: C.blueSoft, color: C.blue }}
                            title="View replacement history">
                            <History className="w-3 h-3" /> Replaced
                          </button>
                        )}
                        {/* GWA override badge */}
                        {s.gwaOverride && (
                          <button onClick={() => setGwaModal(s)}
                            className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md transition-colors"
                            style={{ background: C.orangeSoft, color: C.orange }}
                            title="View GWA override">
                            <SlidersHorizontal className="w-3 h-3" /> GWA Adj.
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Program */}
                    <td className="px-4 py-3.5 text-xs max-w-[160px]" style={{ color: C.muted }}>
                      <span className="truncate block">{s.program}</span>
                    </td>

                    {/* Scholarship */}
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                        style={{ background: schStyle.bg, color: schStyle.color }}>
                        {s.scholarship}
                      </span>
                    </td>

                    {/* GWA */}
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-bold tabular-nums" style={{ color: gwaColor(s.gwa) }}>
                        {s.gwa.toFixed(2)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                        style={{
                          background: s.status === 'Active' ? C.greenSoft : C.redSoft,
                          color: s.status === 'Active' ? C.green : C.red,
                        }}>
                        <span className="w-1.5 h-1.5 rounded-full"
                          style={{ background: s.status === 'Active' ? C.green : C.red }} />
                        {s.status}
                      </span>
                    </td>

                    {/* SDU — clickable */}
                    <td className="px-4 py-3.5">
                      <button onClick={() => setSduModal(s)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border transition-all"
                        style={{
                          background: sduStyle.bg,
                          color: sduStyle.color,
                          borderColor: s.sduLevel === 'none' ? C.border : sduStyle.color,
                        }}
                        title="View SDU record">
                        <Shield className="w-3 h-3" />
                        {sduStyle.label}
                      </button>
                    </td>

                    {/* RO Progress */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: C.border }}>
                          <div className="h-1.5 rounded-full transition-all"
                            style={{ width: s.roPct + '%', background: roColor }} />
                        </div>
                        <span className="text-[11px] font-semibold tabular-nums w-8 text-right"
                          style={{ color: roColor }}>
                          {s.roPct}%
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 pr-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* GWA Override button */}
                        <button onClick={() => setGwaModal(s)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                          style={{ borderColor: C.border, color: C.orange, background: C.white }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.orangeSoft)}
                          onMouseLeave={e => (e.currentTarget.style.background = C.white)}
                          title="Log GWA override">
                          <Plus className="w-3 h-3" />
                          GWA
                        </button>
                        {/* View profile */}
                        <button onClick={() => navigate('/admin/scholars/' + s.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                          style={{ borderColor: C.border, color: C.blue, background: C.white }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.blueSoft)}
                          onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
                          <Eye className="w-3.5 h-3.5" /> View
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: BD }}>
          <p className="text-xs" style={{ color: C.muted }}>
            Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border disabled:opacity-40"
              style={{ borderColor: C.border, background: C.white }}
              onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
              <ChevronLeft className="w-4 h-4" style={{ color: C.muted }} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
              <button key={n} onClick={() => setPage(n)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold border transition-all"
                style={{
                  background: page === n ? C.blue : C.white,
                  color: page === n ? C.white : C.muted,
                  borderColor: page === n ? C.blue : C.border,
                }}>
                {n}
              </button>
            ))}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border disabled:opacity-40"
              style={{ borderColor: C.border, background: C.white }}
              onMouseEnter={e => (e.currentTarget.style.background = C.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
              <ChevronRight className="w-4 h-4" style={{ color: C.muted }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}