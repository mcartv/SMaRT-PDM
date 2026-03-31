import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import {
  Search, Download, Eye, ChevronLeft, ChevronRight,
  SlidersHorizontal, AlertTriangle, UserMinus, UserPlus,
  FileText, X
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
};

const BD = '1px solid ' + C.border;

const CARD = {
  background: C.white,
  border: BD,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

// ─── Status config ────────────────────────────────────────────
const STATUS_MAP = {
  ready: { label: 'Documents Ready', bg: C.greenSoft, color: C.green },
  missing: { label: 'Missing Docs', bg: C.redSoft, color: C.red },
  review: { label: 'Under Review', bg: C.orangeSft, color: C.orange },
  approved: { label: 'Approved', bg: C.blueSoft, color: C.blueMid },
};

// ─── SD / Deficiency flags ────────────────────────────────────
const SD_MAP = {
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
const INIT_APPS = [
  { id: '2025-001', name: 'Dela Cruz, Juan', program: 'TES', submitted: 'Oct 20, 2025', status: 'ready', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'I am writing to express my sincere interest in the TES scholarship...' },
  { id: '2025-002', name: 'Santos, Maria', program: 'TDP', submitted: 'Oct 21, 2025', status: 'missing', deficiency: 'sd', disqualified: false, disqReason: '', loi: 'I humbly request consideration for the TDP scholarship...' },
  { id: '2025-003', name: 'Reyes, Ana', program: 'TES', submitted: 'Oct 19, 2025', status: 'review', deficiency: 'incomplete', disqualified: false, disqReason: '', loi: 'This scholarship will allow me to focus on my studies...' },
  { id: '2025-004', name: 'Garcia, Pedro', program: 'Private', submitted: 'Oct 22, 2025', status: 'approved', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'I am a deserving scholar who has maintained consistent academic performance...' },
  { id: '2025-005', name: 'Lopez, Rosa', program: 'TES', submitted: 'Oct 18, 2025', status: 'ready', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'Being from an underprivileged family, this scholarship represents my only means...' },
  { id: '2025-006', name: 'Martinez, Carlos', program: 'TDP', submitted: 'Oct 23, 2025', status: 'missing', deficiency: 'sd', disqualified: true, disqReason: 'Existing LGU / Sports scholarship', loi: '' },
  { id: '2025-007', name: 'Fernandez, Lisa', program: 'TES', submitted: 'Oct 17, 2025', status: 'review', deficiency: 'incomplete', disqualified: false, disqReason: '', loi: 'I pledge to maintain my academic standing...' },
  { id: '2025-008', name: 'Torres, Miguel', program: 'TES', submitted: 'Oct 24, 2025', status: 'ready', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'As an aspiring engineer, financial constraints have been my greatest challenge...' },
  { id: '2025-009', name: 'Villanueva, Sofia', program: 'Private', submitted: 'Oct 16, 2025', status: 'review', deficiency: 'incomplete', disqualified: false, disqReason: '', loi: 'I am confident that with this scholarship...' },
  { id: '2025-010', name: 'Ramos, Daniel', program: 'TDP', submitted: 'Oct 25, 2025', status: 'approved', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'My commitment to academic excellence and community service...' },
];

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
function StatusBadge({ status }) {
  const s = STATUS_MAP[status] ?? { label: status, bg: C.bg, color: C.muted };
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

function DeficiencyBadge({ flag }) {
  const d = SD_MAP[flag] ?? { label: flag, color: C.muted, bg: C.bg };
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold"
      style={{ background: d.bg, color: d.color }}>
      {flag === 'sd' && <AlertTriangle className="w-3 h-3" />}
      {d.label}
    </span>
  );
}

function LOIModal({ app, onClose }) {
  const [verdict, setVerdict] = useState('pending');
  const [note, setNote] = useState('');

  const VERDICT_STYLE = {
    pending: { label: 'Pending Review', color: '#d97706', bg: '#FFF7ED' },
    valid: { label: 'Marked Valid', color: '#16a34a', bg: '#F0FDF4' },
    redo: { label: 'Requested Redo', color: '#dc2626', bg: '#FEF2F2' },
  };

  const vs = VERDICT_STYLE[verdict];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }} onClick={onClose}>
      <div className="w-full rounded-2xl overflow-hidden shadow-2xl flex flex-col" style={{ background: '#1c1c1e', maxWidth: 540, maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderBottom: '1px solid #2c2c2e' }}>
          <div>
            <p className="text-sm font-bold text-white">Letter of Intent</p>
            <p className="text-xs mt-0.5" style={{ color: '#8e8e93' }}>{app.name} · {app.id} · Submitted {app.submitted}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full" style={{ background: vs.bg, color: vs.color }}>{vs.label}</span>
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors bg-[#2c2c2e] hover:bg-[#3a3a3c]">
              <X className="w-4 h-4 text-[#8e8e93]" />
            </button>
          </div>
        </div>
        <div className="px-5 pt-5 shrink-0">
          <div className="relative w-full pt-[75%] rounded-lg overflow-hidden bg-[#faf8f3]" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.06)' }}>
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#faf8f3]/80 backdrop-blur-[2px] z-10">
              <FileText className="w-12 h-12 text-[#9c8c6e] border-dashed border-2 border-[#b8a888] p-2 rounded-xl mb-2" />
              <p className="text-xs font-bold text-[#5a4a32]">Awaiting Document Upload</p>
            </div>
          </div>
        </div>
        <div className="px-5 pt-4 pb-5 space-y-3 shrink-0 border-t border-[#2c2c2e] mt-4">
          <div className="flex gap-2">
            <button onClick={() => setVerdict('valid')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${verdict === 'valid' ? 'border-[#16a34a] bg-[#16a34a]/15 text-[#4ade80]' : 'border-[#2c2c2e] bg-[#2c2c2e] text-[#6e6e73]'}`}>✓ Mark Valid</button>
            <button onClick={() => setVerdict('redo')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 transition-all ${verdict === 'redo' ? 'border-[#dc2626] bg-[#dc2626]/15 text-[#f87171]' : 'border-[#2c2c2e] bg-[#2c2c2e] text-[#6e6e73]'}`}>✕ Request Redo</button>
          </div>
          {verdict === 'redo' && (
            <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for redo..." rows={2} className="w-full text-xs rounded-xl px-3 py-2.5 bg-[#2c2c2e] border border-[#3a3a3c] text-[#e5e5ea] focus:outline-none" />
          )}
          <button onClick={onClose} disabled={verdict === 'pending'} className={`w-full py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-30 ${verdict === 'valid' ? 'bg-[#16a34a]' : verdict === 'redo' ? 'bg-[#dc2626]' : 'bg-[#3a3a3c]'}`}>
            {verdict === 'pending' ? 'Select a verdict' : 'Save & Close'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DisqModal({ app, onDisqualify, onClose }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl bg-white" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-red-50">
          <div>
            <p className="text-sm font-bold text-red-600">Disqualify Scholar</p>
            <p className="text-xs text-red-600">{app.name} · {app.id}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-red-600" /></button>
        </div>
        <div className="px-5 py-5 space-y-3">
          {DISQ_REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)} className={`w-full text-left text-sm px-3 py-2.5 rounded-xl border transition-all ${reason === r ? 'bg-red-50 border-red-600 text-red-600 font-bold' : 'bg-white border-gray-200 text-gray-900'}`}>{r}</button>
          ))}
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 h-9 rounded-xl text-xs font-semibold border border-gray-200 text-gray-500">Cancel</button>
          <button onClick={() => { if (reason) { onDisqualify(app.id, reason); onClose(); } }} disabled={!reason} className="px-4 h-9 rounded-xl text-xs font-bold text-white bg-red-600 disabled:opacity-40">Confirm</button>
        </div>
      </div>
    </div>
  );
}

export default function ApplicationReview() {
  const navigate = useNavigate();
  const [apps, setApps] = useState(INIT_APPS);
  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [showAdv, setShowAdv] = useState(false);
  const [showRepl, setShowRepl] = useState(false);
  const [loiApp, setLoiApp] = useState(null);
  const [disqApp, setDisqApp] = useState(null);

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
  function toggleOne(id) {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  function handleDisqualify(id, reason) {
    setApps(prev => prev.map(a => a.id === id ? { ...a, disqualified: true, disqReason: reason, status: 'missing' } : a));
  }

  function handleDeficiencyChange(id, flag) {
    setApps(prev => prev.map(a => a.id === id ? { ...a, deficiency: flag } : a));
  }

  return (
    <div className="space-y-5 py-1 text-gray-900">
      {loiApp && <LOIModal app={loiApp} onClose={() => setLoiApp(null)} />}
      {disqApp && <DisqModal app={disqApp} onDisqualify={handleDisqualify} onClose={() => setDisqApp(null)} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-sm text-gray-500">{filtered.length} results · AY 2025–2026</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowRepl(!showRepl)} className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-semibold border transition-all ${showRepl ? 'border-orange-600 bg-orange-50 text-orange-600' : 'bg-white border-gray-200 text-gray-500'}`}>
            <UserPlus className="w-3.5 h-3.5" />
            Replacement Queue
          </button>
          <button className="flex items-center gap-1.5 bg-blue-900 text-white text-xs font-semibold rounded-xl px-4 h-9">
            <Download className="w-3.5 h-3.5" />
            Export
          </button>
        </div>
      </div>

      <div style={CARD} className="p-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search name or ID…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="flex-1 min-w-50px" />
          <Select value={program} onValueChange={setProgram}>
            <SelectTrigger className="w-37.5"><SelectValue /></SelectTrigger>
            <SelectContent>{PROGRAMS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
          <button onClick={() => setShowAdv(!showAdv)} className="px-3 h-9 rounded-xl border border-gray-200 text-gray-500 text-xs font-medium"><SlidersHorizontal className="w-3.5 h-3.5 inline mr-1" />Filters</button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-[11px] font-bold uppercase text-gray-500 border-b border-gray-200">
            <tr>
              <th className="px-5 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
              <th className="px-4 py-3">Student Name</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Program</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">SD Flag</th>
              <th className="px-4 py-3 text-right pr-5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pageData.map((app) => (
              <tr key={app.id} className={selected.has(app.id) ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                <td className="px-5 py-3"><input type="checkbox" checked={selected.has(app.id)} onChange={() => toggleOne(app.id)} /></td>
                <td className="px-4 py-3">
                  <div className="font-semibold">{app.name}</div>
                  {app.disqualified && <div className="text-[10px] text-red-600 font-bold">Disqualified: {app.disqReason}</div>}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 font-mono">{app.id}</td>
                <td className="px-4 py-3 text-xs">{app.program}</td>
                <td className="px-4 py-3"><StatusBadge status={app.status} /></td>
                <td className="px-4 py-3">
                  <select value={app.deficiency} onChange={e => handleDeficiencyChange(app.id, e.target.value)} className="text-[10px] font-bold px-2 py-1 border rounded bg-white">
                    {Object.entries(SD_MAP).map(([val, s]) => <option key={val} value={val}>{s.label}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-right pr-5 space-x-2">
                  <button onClick={() => setLoiApp(app)} className="p-1.5 border rounded-lg hover:bg-gray-50"><FileText className="w-4 h-4 text-blue-600" /></button>
                  <button onClick={() => navigate('/admin/applications/' + app.id)} className="p-1.5 border rounded-lg hover:bg-gray-50"><Eye className="w-4 h-4 text-gray-500" /></button>
                  {!app.disqualified && <button onClick={() => setDisqApp(app)} className="p-1.5 border border-red-200 bg-red-50 rounded-lg"><UserMinus className="w-4 h-4 text-red-600" /></button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-5 py-3 border-t border-gray-200 text-xs text-gray-500">
          Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
        </div>
      </div>
    </div>
  );
}