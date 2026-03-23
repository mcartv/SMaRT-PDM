import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  Search, Download, Eye, ChevronLeft, ChevronRight,
  SlidersHorizontal, AlertTriangle, UserMinus, UserPlus,
  FileText, X, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Palette ─────────────────────────────────────────────────
const C = {
  blue: '#1E3A8A',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  border: '#E5E7EB',
  muted: '#6B7280',
  text: '#111827',
  bg: '#F9FAFB',
  white: '#FFFFFF',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  orange: '#d97706',
  orangeSft: '#FFF7ED',
  red: '#dc2626',
  redSoft: '#FEF2F2',
} as const;

const BD = '1px solid ' + C.border;

const CARD: React.CSSProperties = {
  background: C.white,
  border: BD,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

// ─── Status config ────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  ready: { label: 'Documents Ready', bg: C.greenSoft, color: C.green },
  missing: { label: 'Missing Docs', bg: C.redSoft, color: C.red },
  review: { label: 'Under Review', bg: C.orangeSft, color: C.orange },
  approved: { label: 'Approved', bg: C.blueSoft, color: C.blueMid },
};

// ─── SD / Deficiency flags ────────────────────────────────────
const SD_MAP: Record<string, { label: string; color: string; bg: string }> = {
  ok: { label: 'OK', color: C.green, bg: C.greenSoft },
  sd: { label: 'SD', color: C.red, bg: C.redSoft },
  incomplete: { label: 'Incomplete', color: C.orange, bg: C.orangeSft },
};

// ─── Disqualification reasons ─────────────────────────────────
const DISQ_REASONS = [
  'Failed GWA requirement',
  'AWOL / No contact',
  'SDU (Scholar Disciplinary Unit)',
  'Existing LGU / Sports scholarship',
  'Failed to complete RO',
  'Voluntarily withdrew',
  'Other',
];

// ─── Data ────────────────────────────────────────────────────
type App = {
  id: string; name: string; program: string; submitted: string;
  status: string; deficiency: string; disqualified: boolean;
  disqReason: string; loi: string;
};

const INIT_APPS: App[] = [
  { id: '2025-001', name: 'Dela Cruz, Juan', program: 'TES', submitted: 'Oct 20, 2025', status: 'ready', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'I am writing to express my sincere interest in the TES scholarship. As a second-year student maintaining a GWA of 1.45, I believe I qualify and am committed to fulfilling all obligations...' },
  { id: '2025-002', name: 'Santos, Maria', program: 'TDP', submitted: 'Oct 21, 2025', status: 'missing', deficiency: 'sd', disqualified: false, disqReason: '', loi: 'I humbly request consideration for the TDP scholarship. My family\'s financial situation makes this opportunity critical for my continued education...' },
  { id: '2025-003', name: 'Reyes, Ana', program: 'TES', submitted: 'Oct 19, 2025', status: 'review', deficiency: 'incomplete', disqualified: false, disqReason: '', loi: 'This scholarship will allow me to focus on my studies and contribute back to the community through the required service obligations...' },
  { id: '2025-004', name: 'Garcia, Pedro', program: 'Private', submitted: 'Oct 22, 2025', status: 'approved', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'I am a deserving scholar who has maintained consistent academic performance and active involvement in community affairs...' },
  { id: '2025-005', name: 'Lopez, Rosa', program: 'TES', submitted: 'Oct 18, 2025', status: 'ready', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'Being from an underprivileged family, this scholarship represents my only means of pursuing higher education without burdening my parents...' },
  { id: '2025-006', name: 'Martinez, Carlos', program: 'TDP', submitted: 'Oct 23, 2025', status: 'missing', deficiency: 'sd', disqualified: true, disqReason: 'Existing LGU / Sports scholarship', loi: '' },
  { id: '2025-007', name: 'Fernandez, Lisa', program: 'TES', submitted: 'Oct 17, 2025', status: 'review', deficiency: 'incomplete', disqualified: false, disqReason: '', loi: 'I pledge to maintain my academic standing and render the required community service hours as part of my scholarship obligations...' },
  { id: '2025-008', name: 'Torres, Miguel', program: 'TES', submitted: 'Oct 24, 2025', status: 'ready', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'As an aspiring engineer, financial constraints have been my greatest challenge. This scholarship will bridge the gap between my potential and my circumstances...' },
  { id: '2025-009', name: 'Villanueva, Sofia', program: 'Private', submitted: 'Oct 16, 2025', status: 'review', deficiency: 'incomplete', disqualified: false, disqReason: '', loi: 'I am confident that with this scholarship, I can fully dedicate myself to my studies and graduate within the prescribed curriculum period...' },
  { id: '2025-010', name: 'Ramos, Daniel', program: 'TDP', submitted: 'Oct 25, 2025', status: 'approved', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'My commitment to academic excellence and community service makes me an ideal candidate for this program...' },
];

// Replacement waitlist (from transcript — replacement scholar queue)
const REPLACEMENTS = [
  { id: 'R-001', name: 'Bautista, Liza', program: 'TDP', gwa: '1.82', rank: 1 },
  { id: 'R-002', name: 'Cruz, Andrei', program: 'TES', gwa: '1.90', rank: 2 },
  { id: 'R-003', name: 'Mendoza, Patricia', program: 'Private', gwa: '1.95', rank: 3 },
  { id: 'R-004', name: 'Aquino, Ben', program: 'TDP', gwa: '2.00', rank: 4 },
];

const PROGRAMS = ['All Programs', 'TES', 'TDP', 'Private'];
const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'ready', label: 'Documents Ready' },
  { value: 'missing', label: 'Missing Docs' },
  { value: 'review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
];

const PAGE_SIZE = 10;

// ─── Sub-components ───────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, bg: C.bg, color: C.muted };
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

function DeficiencyBadge({ flag }: { flag: string }) {
  const d = SD_MAP[flag] ?? { label: flag, color: C.muted, bg: C.bg };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold"
      style={{ background: d.bg, color: d.color }}>
      {flag === 'sd' && <AlertTriangle className="w-3 h-3" />}
      {d.label}
    </span>
  );
}


// ─── LOI Modal ───────────────────────────────────────────────
type LOIVerdict = 'pending' | 'valid' | 'redo';

function LOIModal({ app, onClose }: { app: App; onClose: () => void }) {
  const [verdict, setVerdict] = useState<LOIVerdict>('pending');
  const [note, setNote] = useState('');

  const VERDICT_STYLE: Record<LOIVerdict, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pending Review', color: '#d97706', bg: '#FFF7ED' },
    valid: { label: 'Marked Valid', color: '#16a34a', bg: '#F0FDF4' },
    redo: { label: 'Requested Redo', color: '#dc2626', bg: '#FEF2F2' },
  };

  const vs = VERDICT_STYLE[verdict];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.65)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: '#1c1c1e', maxWidth: 540, maxHeight: '92vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0"
          style={{ borderBottom: '1px solid #2c2c2e' }}>
          <div>
            <p className="text-sm font-bold text-white">Letter of Intent</p>
            <p className="text-xs mt-0.5" style={{ color: '#8e8e93' }}>
              {app.name} · {app.id} · Submitted {app.submitted}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: vs.bg, color: vs.color }}>{vs.label}</span>
            <button onClick={onClose}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
              style={{ background: '#2c2c2e' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#3a3a3c')}
              onMouseLeave={e => (e.currentTarget.style.background = '#2c2c2e')}>
              <X className="w-4 h-4" style={{ color: '#8e8e93' }} />
            </button>
          </div>
        </div>

        {/* 4:3 document viewer */}
        <div className="px-5 pt-5 shrink-0">
          <div style={{
            position: 'relative', width: '100%', paddingTop: '75%',
            borderRadius: 8, overflow: 'hidden',
            boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.06)',
            background: '#faf8f3',
          }}>
            <div style={{ position: 'absolute', inset: 0 }}>
              {/* Scan line texture */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
                background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.018) 0px, rgba(0,0,0,0.018) 1px, transparent 1px, transparent 3px)',
              }} />
              {/* Edge vignette */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
                background: 'radial-gradient(ellipse at center, transparent 60%, rgba(0,0,0,0.10) 100%)',
              }} />
              {/* Simulated letter content */}
              <div style={{ position: 'absolute', inset: 0, padding: '5% 7%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', border: '2px solid #c8b89a', background: '#e8e0cc', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 7, background: '#a89878', borderRadius: 2, marginBottom: 4, width: '65%' }} />
                    <div style={{ height: 5, background: '#c8b89a', borderRadius: 2, width: '45%' }} />
                  </div>
                </div>
                <div style={{ height: 1.5, background: '#b8a888', marginBottom: 12 }} />
                <div style={{ height: 5, background: '#d4c8b0', borderRadius: 2, width: '30%', marginBottom: 10 }} />
                {[55, 42, 38].map((w, i) => <div key={i} style={{ height: 5, background: '#c8b89a', borderRadius: 2, width: w + '%', marginBottom: 5 }} />)}
                <div style={{ height: 8 }} />
                <div style={{ height: 6, background: '#a89878', borderRadius: 2, width: '50%', marginBottom: 10 }} />
                <div style={{ height: 5, background: '#d4c8b0', borderRadius: 2, width: '25%', marginBottom: 10 }} />
                {[100, 97, 99, 94, 98, 88, 95, 72].map((w, i) => <div key={i} style={{ height: 4.5, background: '#cec0a8', borderRadius: 2, width: w + '%', marginBottom: 5.5 }} />)}
                <div style={{ height: 8 }} />
                {[100, 96, 99, 91, 97, 85, 60].map((w, i) => <div key={i} style={{ height: 4.5, background: '#cec0a8', borderRadius: 2, width: w + '%', marginBottom: 5.5 }} />)}
                <div style={{ height: 8 }} />
                <div style={{ height: 4.5, background: '#d4c8b0', borderRadius: 2, width: '28%', marginBottom: 16 }} />
                <div>
                  <div style={{ height: 18, width: 80, borderBottom: '1.5px solid #a89878', marginBottom: 4, borderRadius: '0 8px 0 0' }} />
                  <div style={{ height: 4.5, background: '#b8a888', borderRadius: 2, width: '32%', marginBottom: 4 }} />
                  <div style={{ height: 4, background: '#cec0a8', borderRadius: 2, width: '24%' }} />
                </div>
              </div>
              {/* Awaiting upload overlay */}
              <div style={{
                position: 'absolute', inset: 0, zIndex: 5,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(250,248,243,0.82)', backdropFilter: 'blur(2px)',
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'rgba(0,0,0,0.05)', border: '1.5px dashed #b8a888',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
                }}>
                  <FileText style={{ width: 22, height: 22, color: '#9c8c6e' }} />
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#5a4a32', marginBottom: 3 }}>
                  Awaiting Document Upload
                </p>
                <p style={{ fontSize: 10, color: '#8a7a62', textAlign: 'center', maxWidth: 180, lineHeight: 1.5 }}>
                  Student has not yet uploaded their signed LOI scan
                </p>
              </div>
            </div>
          </div>
          {/* Meta */}
          <div className="flex items-center justify-between mt-2 px-0.5" style={{ color: '#6e6e73', fontSize: 11 }}>
            <span>LOI · {app.program} · {app.id}</span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ background: '#2c2c2e', color: '#ffd60a' }}>
              ● Pending upload
            </span>
          </div>
        </div>

        {/* Admin validation section */}
        <div className="px-5 pt-4 pb-5 space-y-3 shrink-0" style={{ borderTop: '1px solid #2c2c2e', marginTop: 14 }}>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#6e6e73' }}>
            Admin Verdict
          </p>
          <div className="flex gap-2">
            <button onClick={() => setVerdict('valid')}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all"
              style={{
                borderColor: verdict === 'valid' ? '#16a34a' : '#2c2c2e',
                background: verdict === 'valid' ? 'rgba(22,163,74,0.15)' : '#2c2c2e',
                color: verdict === 'valid' ? '#4ade80' : '#6e6e73',
              }}>
              ✓ Mark as Valid
            </button>
            <button onClick={() => setVerdict('redo')}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all"
              style={{
                borderColor: verdict === 'redo' ? '#dc2626' : '#2c2c2e',
                background: verdict === 'redo' ? 'rgba(220,38,38,0.15)' : '#2c2c2e',
                color: verdict === 'redo' ? '#f87171' : '#6e6e73',
              }}>
              ✕ Request Redo
            </button>
          </div>
          {verdict === 'redo' && (
            <textarea
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="Reason for requesting a redo (e.g. signature missing, content insufficient)…"
              rows={2}
              className="w-full text-xs rounded-xl px-3 py-2.5 resize-none focus:outline-none"
              style={{ background: '#2c2c2e', border: '1px solid #3a3a3c', color: '#e5e5ea', lineHeight: 1.5 }}
            />
          )}
          <button onClick={onClose} disabled={verdict === 'pending'}
            className="w-full py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-30"
            style={{
              background: verdict === 'valid' ? '#16a34a' : verdict === 'redo' ? '#dc2626' : '#3a3a3c',
              color: '#fff',
            }}>
            {verdict === 'pending' ? 'Select a verdict above' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Disqualification Modal ───────────────────────────────────
function DisqModal({ app, onDisqualify, onClose }: {
  app: App; onDisqualify: (id: string, reason: string) => void; onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: C.white }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: BD, background: C.redSoft }}>
          <div>
            <p className="text-sm font-bold" style={{ color: C.red }}>Disqualify Scholar</p>
            <p className="text-xs mt-0.5" style={{ color: C.red }}>{app.name} · {app.id}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4" style={{ color: C.red }} /></button>
        </div>
        <div className="px-5 py-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.muted }}>
            Reason for Disqualification
          </p>
          <div className="space-y-2">
            {DISQ_REASONS.map(r => (
              <button key={r} onClick={() => setReason(r)}
                className="w-full text-left text-sm px-3 py-2.5 rounded-xl border transition-all"
                style={{
                  background: reason === r ? C.redSoft : C.white,
                  borderColor: reason === r ? C.red : C.border,
                  color: reason === r ? C.red : C.text,
                  fontWeight: reason === r ? 600 : 400,
                }}>
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button onClick={onClose}
            className="px-4 h-9 rounded-xl text-xs font-semibold border"
            style={{ borderColor: C.border, color: C.muted, background: C.white }}>
            Cancel
          </button>
          <button
            onClick={() => { if (reason) { onDisqualify(app.id, reason); onClose(); } }}
            disabled={!reason}
            className="px-4 h-9 rounded-xl text-xs font-bold text-white disabled:opacity-40"
            style={{ background: C.red }}>
            Confirm Disqualification
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function ApplicationReview() {
  const navigate = useNavigate();

  const [apps, setApps] = useState<App[]>(INIT_APPS);
  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdv, setShowAdv] = useState(false);
  const [showRepl, setShowRepl] = useState(false);

  // Modals
  const [loiApp, setLoiApp] = useState<App | null>(null);
  const [disqApp, setDisqApp] = useState<App | null>(null);

  // Filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return apps.filter((a) => {
      const matchSearch = !q || a.name.toLowerCase().includes(q) || a.id.includes(q);
      const matchProgram = program === 'All Programs' || a.program === program;
      const matchStatus = status === 'all' || a.status === status;
      return matchSearch && matchProgram && matchStatus;
    });
  }, [apps, search, program, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const allSelected = pageData.length > 0 && pageData.every(a => selected.has(a.id));
  const someSelected = pageData.some(a => selected.has(a.id));

  function toggleAll() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) pageData.forEach(a => next.delete(a.id));
      else pageData.forEach(a => next.add(a.id));
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function clearSelection() { setSelected(new Set()); }

  function handleDisqualify(id: string, reason: string) {
    setApps(prev => prev.map(a => a.id === id ? { ...a, disqualified: true, disqReason: reason, status: 'missing' } : a));
  }

  function handleDeficiencyChange(id: string, flag: string) {
    setApps(prev => prev.map(a => a.id === id ? { ...a, deficiency: flag } : a));
  }

  const counts = useMemo(() =>
    Object.fromEntries(Object.keys(STATUS_MAP).map(k => [k, apps.filter(a => a.status === k).length])),
    [apps]);

  const disqualifiedCount = apps.filter(a => a.disqualified).length;

  return (
    <div className="space-y-5 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>

      {/* Modals */}
      {loiApp && <LOIModal app={loiApp} onClose={() => setLoiApp(null)} />}
      {disqApp && <DisqModal app={disqApp} onDisqualify={handleDisqualify} onClose={() => setDisqApp(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: C.text }}>Applications</h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>{filtered.length} results · AY 2025–2026</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Replacement queue toggle */}
          <button
            onClick={() => setShowRepl(v => !v)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-semibold border transition-all"
            style={{
              borderColor: showRepl ? C.orange : C.border,
              color: showRepl ? C.orange : C.muted,
              background: showRepl ? C.orangeSft : C.white,
            }}>
            <UserPlus className="w-3.5 h-3.5" />
            Replacement Queue
            {disqualifiedCount > 0 && (
              <span className="font-bold px-1.5 py-0.5 rounded-full text-[10px]"
                style={{ background: C.redSoft, color: C.red }}>{disqualifiedCount}</span>
            )}
          </button>
          <button
            className="flex items-center gap-1.5 text-white text-xs font-semibold rounded-xl px-4 h-9"
            style={{ background: C.blue }}>
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      {/* Replacement Scholar Queue Panel */}
      {showRepl && (
        <div style={CARD} className="overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between"
            style={{ borderBottom: BD, background: C.orangeSft }}>
            <div>
              <p className="text-sm font-bold" style={{ color: C.orange }}>Replacement Scholar Queue</p>
              <p className="text-xs mt-0.5" style={{ color: C.orange }}>
                Ranked waitlist — pulled when a scholar is disqualified
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: C.orangeSft, color: C.orange, border: '1px solid #fed7aa' }}>
              {REPLACEMENTS.length} on queue
            </span>
          </div>

          {/* Disqualified scholars needing replacement */}
          {disqualifiedCount > 0 && (
            <div className="px-5 py-3" style={{ borderBottom: BD, background: C.redSoft }}>
              <p className="text-xs font-semibold mb-2" style={{ color: C.red }}>
                {disqualifiedCount} scholar(s) disqualified — slots available
              </p>
              {apps.filter(a => a.disqualified).map(a => (
                <div key={a.id} className="flex items-center justify-between py-1.5">
                  <div>
                    <span className="text-xs font-semibold" style={{ color: C.text }}>{a.name}</span>
                    <span className="text-[11px] ml-2" style={{ color: C.muted }}>· {a.disqReason}</span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md"
                    style={{ background: C.redSoft, color: C.red, border: '1px solid #fecaca' }}>
                    Slot Open
                  </span>
                </div>
              ))}
            </div>
          )}

          <table className="w-full">
            <thead>
              <tr style={{ background: C.bg, borderBottom: BD }}>
                {['Rank', 'Name', 'Program', 'GWA', ''].map((h, i) => (
                  <th key={i} className={'px-5 py-3 text-[11px] font-bold uppercase tracking-wider ' + (i === 0 ? 'text-center' : i === 4 ? 'text-right' : 'text-left')}
                    style={{ color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {REPLACEMENTS.map((r, i) => (
                <tr key={r.id} style={{ borderBottom: BD, background: i % 2 === 0 ? C.white : C.bg }}>
                  <td className="px-5 py-3 text-center">
                    <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center mx-auto"
                      style={{ background: C.orangeSft, color: C.orange }}>
                      {r.rank}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm font-semibold" style={{ color: C.text }}>{r.name}</td>
                  <td className="px-5 py-3">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                      style={{ background: C.bg, color: C.muted, border: BD }}>{r.program}</span>
                  </td>
                  <td className="px-5 py-3 text-sm font-mono" style={{ color: C.text }}>{r.gwa}</td>
                  <td className="px-5 py-3 pr-5 text-right">
                    <button className="text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors"
                      style={{ borderColor: C.orange, color: C.orange, background: C.white }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.orangeSft)}
                      onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
                      Promote to Scholar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Status summary pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(STATUS_MAP).map(([key, s]) => (
          <button key={key}
            onClick={() => { setStatus(status === key ? 'all' : key); setPage(1); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
            style={{
              background: status === key ? s.bg : C.white,
              borderColor: status === key ? s.color : C.border,
              color: status === key ? s.color : C.muted,
            }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
            {s.label}
            <span className="ml-0.5 font-bold">{counts[key]}</span>
          </button>
        ))}
        {/* SD quick filter */}
        <button
          onClick={() => { }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ml-1"
          style={{ background: C.redSoft, borderColor: C.red, color: C.red }}>
          <AlertTriangle className="w-3 h-3" />
          SD Flag
          <span className="font-bold">{apps.filter(a => a.deficiency === 'sd').length}</span>
        </button>
      </div>

      {/* Filter bar */}
      <div style={CARD} className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search name or ID…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 text-sm rounded-xl border-gray-200 bg-gray-50 focus:bg-white"
            />
          </div>
          <Select value={program} onValueChange={v => { setProgram(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[150px] text-sm rounded-xl border-gray-200 bg-gray-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROGRAMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[160px] text-sm rounded-xl border-gray-200 bg-gray-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <button
            onClick={() => setShowAdv(v => !v)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-medium border transition-colors"
            style={{
              borderColor: showAdv ? C.blue : C.border,
              color: showAdv ? C.blue : C.muted,
              background: showAdv ? C.blueSoft : C.white,
            }}>
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>
        </div>
        {showAdv && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 pt-3" style={{ borderTop: BD }}>
            <Select>
              <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50">
                <SelectValue placeholder="Year Level" />
              </SelectTrigger>
              <SelectContent>
                {['1st Year', '2nd Year', '3rd Year', '4th Year'].map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50">
                <SelectValue placeholder="SD / Deficiency Flag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Flags</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="sd">SD (Scholar on Deficiency)</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="GWA range (e.g. 1.0–2.0)" className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50" />
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ ...CARD, overflow: 'hidden' }}>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between px-5 py-3"
            style={{ background: C.blueSoft, borderBottom: '1px solid #bfdbfe' }}>
            <span className="text-sm font-medium" style={{ color: C.blue }}>{selected.size} selected</span>
            <div className="flex items-center gap-2">
              <button className="text-xs font-semibold px-3 h-8 rounded-lg text-white"
                style={{ background: C.green }}>Approve</button>
              <button className="text-xs font-semibold px-3 h-8 rounded-lg border"
                style={{ background: C.white, borderColor: C.border, color: C.orange }}>Request Changes</button>
              <button className="text-xs font-semibold px-3 h-8 rounded-lg border"
                style={{ background: C.white, borderColor: C.border, color: C.muted }}
                onClick={clearSelection}>Clear</button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: C.bg, borderBottom: BD }}>
                <th className="pl-5 pr-3 py-3">
                  <input type="checkbox" checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    style={{ accentColor: C.blue }} />
                </th>
                {['Student Name', 'ID', 'Program', 'Submitted', 'Status', 'SD Flag', 'LOI', ''].map((h, i) => (
                  <th key={i}
                    className={'px-4 py-3 text-[11px] font-bold uppercase tracking-wider ' + (i === 7 ? 'text-right pr-5' : 'text-left')}
                    style={{ color: C.muted }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center text-sm" style={{ color: C.muted }}>
                    No applications match the current filters.
                  </td>
                </tr>
              ) : pageData.map((app, i) => {
                const isSelected = selected.has(app.id);
                const rowBg = app.disqualified
                  ? '#fff7f7'
                  : isSelected ? C.blueSoft
                    : i % 2 === 0 ? C.white : C.bg;

                return (
                  <tr key={app.id}
                    style={{ borderBottom: BD, background: rowBg, transition: 'background 0.1s' }}
                    onMouseEnter={e => { if (!isSelected && !app.disqualified) (e.currentTarget as HTMLElement).style.background = '#f0f9ff'; }}
                    onMouseLeave={e => { if (!isSelected && !app.disqualified) (e.currentTarget as HTMLElement).style.background = rowBg; }}
                  >
                    <td className="pl-5 pr-3 py-3.5">
                      <input type="checkbox" checked={isSelected} onChange={() => toggleOne(app.id)}
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                        style={{ accentColor: C.blue }} />
                    </td>

                    {/* Name + disqualified badge */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold" style={{ color: app.disqualified ? C.muted : C.text }}>
                          {app.name}
                        </span>
                        {app.disqualified && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1"
                            style={{ background: C.redSoft, color: C.red }}>
                            <UserMinus className="w-3 h-3" />
                            Disqualified
                          </span>
                        )}
                      </div>
                      {app.disqualified && (
                        <p className="text-[11px] mt-0.5" style={{ color: C.red }}>{app.disqReason}</p>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-sm font-mono" style={{ color: C.muted }}>{app.id}</td>

                    <td className="px-4 py-3.5">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{ background: C.bg, color: C.muted, border: BD }}>
                        {app.program}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-sm" style={{ color: C.muted }}>{app.submitted}</td>

                    <td className="px-4 py-3.5"><StatusBadge status={app.status} /></td>

                    {/* SD / Deficiency Flag — inline editable */}
                    <td className="px-4 py-3.5">
                      <select
                        value={app.deficiency}
                        onChange={e => handleDeficiencyChange(app.id, e.target.value)}
                        className="text-[11px] font-bold rounded-md px-2 py-1 border cursor-pointer"
                        style={{
                          background: SD_MAP[app.deficiency]?.bg ?? C.bg,
                          color: SD_MAP[app.deficiency]?.color ?? C.muted,
                          borderColor: SD_MAP[app.deficiency]?.color ?? C.border,
                        }}>
                        {Object.entries(SD_MAP).map(([val, s]) => (
                          <option key={val} value={val}>{s.label}</option>
                        ))}
                      </select>
                    </td>

                    {/* LOI viewer button */}
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => setLoiApp(app)}
                        disabled={!app.loi}
                        className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-30"
                        style={{ borderColor: C.border, color: C.blue, background: C.white }}
                        onMouseEnter={e => { if (app.loi) (e.currentTarget.style.background = C.blueSoft); }}
                        onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
                        <FileText className="w-3.5 h-3.5" />
                        LOI
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 pr-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => navigate('/admin/applications/' + app.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                          style={{ borderColor: C.border, color: C.blue, background: C.white }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.blueSoft)}
                          onMouseLeave={e => (e.currentTarget.style.background = C.white)}>
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </button>
                        {!app.disqualified && (
                          <button
                            onClick={() => setDisqApp(app)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                            style={{ borderColor: '#fecaca', color: C.red, background: C.redSoft }}
                            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.95)')}
                            onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}>
                            <UserMinus className="w-3.5 h-3.5" />
                          </button>
                        )}
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