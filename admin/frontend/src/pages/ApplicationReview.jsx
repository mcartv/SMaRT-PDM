import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';

// --- SHADCN UI COMPONENTS (Matching Dashboard Pattern) ---
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// --- ICONS ---
import {
  Search, Download, Eye, ChevronLeft, ChevronRight,
  SlidersHorizontal, AlertTriangle, UserMinus, UserPlus,
  FileText, X, Users, CheckCircle2, Clock, AlertCircle,
} from 'lucide-react';

// ─── Palette (SMaRT PDM Industry Theme) ─────────────────────────
const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  brownLight: '#92500f',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  yellow: '#fbbf24',
  yellowSoft: '#fef3c7',
  sand: '#faf7f2',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  blue: '#1E3A8A',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  border: '#e8d5b7',
  muted: '#a0785a',
  text: '#3b1f0a',
  bg: '#faf7f2',
  white: '#FFFFFF',
};

// ─── Configs ─────────────────────────────────────────────────
const STATUS_MAP = {
  ready: { label: 'Documents Ready', bg: C.greenSoft, color: C.green },
  missing: { label: 'Missing Docs', bg: C.redSoft, color: C.red },
  review: { label: 'Under Review', bg: C.amberSoft, color: C.amber },
  approved: { label: 'Approved', bg: C.blueSoft, color: C.blueMid },
};

const SD_MAP = {
  ok: { label: 'OK', color: C.green, bg: C.greenSoft },
  sd: { label: 'SD', color: C.red, bg: C.redSoft },
  incomplete: { label: 'Incomplete', color: C.amber, bg: C.amberSoft },
};

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
  { id: '2025-001', name: 'Dela Cruz, Juan', program: 'TES', submitted: 'Oct 20, 2025', status: 'ready', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'Maintaining a GWA of 1.45...' },
  { id: '2025-002', name: 'Santos, Maria', program: 'TDP', submitted: 'Oct 21, 2025', status: 'missing', deficiency: 'sd', disqualified: false, disqReason: '', loi: 'Financial situation critical...' },
  { id: '2025-003', name: 'Reyes, Ana', program: 'TES', submitted: 'Oct 19, 2025', status: 'review', deficiency: 'incomplete', disqualified: false, disqReason: '', loi: 'Focus on my studies...' },
  { id: '2025-004', name: 'Garcia, Pedro', program: 'Private', submitted: 'Oct 22, 2025', status: 'approved', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'Consistent performance...' },
  { id: '2025-005', name: 'Lopez, Rosa', program: 'TES', submitted: 'Oct 18, 2025', status: 'ready', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'Underprivileged family...' },
  { id: '2025-006', name: 'Martinez, Carlos', program: 'TDP', submitted: 'Oct 23, 2025', status: 'missing', deficiency: 'sd', disqualified: true, disqReason: 'Existing LGU scholarship', loi: '' },
  { id: '2025-007', name: 'Fernandez, Lisa', program: 'TES', submitted: 'Oct 17, 2025', status: 'review', deficiency: 'incomplete', disqualified: false, disqReason: '', loi: 'Required community service...' },
  { id: '2025-008', name: 'Torres, Miguel', program: 'TES', submitted: 'Oct 24, 2025', status: 'ready', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'Financial constraints...' },
  { id: '2025-009', name: 'Villanueva, Sofia', program: 'Private', submitted: 'Oct 16, 2025', status: 'review', deficiency: 'incomplete', disqualified: false, disqReason: '', loi: 'Fully dedicate myself...' },
  { id: '2025-010', name: 'Ramos, Daniel', program: 'TDP', submitted: 'Oct 25, 2025', status: 'approved', deficiency: 'ok', disqualified: false, disqReason: '', loi: 'Community service excellence...' },
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

// ─── Sub-Components ──────────────────────────────────────────

function LOIModal({ app, onClose }) {
  const [verdict, setVerdict] = useState('pending');
  const VERDICT_STYLE = {
    pending: { label: 'Awaiting Verdict', color: C.amber, bg: C.amberSoft },
    valid: { label: 'Validated', color: C.green, bg: C.greenSoft },
    redo: { label: 'Redo Required', color: C.red, bg: C.redSoft },
  };
  const vs = VERDICT_STYLE[verdict];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-stone-900/40" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl overflow-hidden shadow-2xl flex flex-col bg-stone-950 border border-stone-800" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Document Review: LOI</h3>
            <p className="text-[10px] text-stone-500 font-bold mt-0.5">{app.name} · {app.id}</p>
          </div>
          <Badge className="text-[9px] font-black border-none" style={{ background: vs.bg, color: vs.color }}>{vs.label}</Badge>
        </div>
        <div className="p-6">
          <div className="aspect-[4/3] rounded-xl bg-stone-50 relative flex flex-col items-center justify-center border-2 border-dashed border-stone-200">
            <FileText className="w-12 h-12 text-stone-200 mb-3" />
            <p className="text-xs font-black text-stone-400 uppercase tracking-widest italic">Preview Processing...</p>
          </div>
        </div>
        <div className="p-6 bg-stone-900/50 border-t border-stone-800 space-y-4">
          <div className="flex gap-3">
            <button onClick={() => setVerdict('valid')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${verdict === 'valid' ? 'bg-green-500/10 border-green-500 text-green-400' : 'border-stone-700 text-stone-500'}`}>✓ Accept</button>
            <button onClick={() => setVerdict('redo')} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${verdict === 'redo' ? 'bg-red-500/10 border-red-500 text-red-400' : 'border-stone-700 text-stone-500'}`}>✕ Reject</button>
          </div>
          <Button disabled={verdict === 'pending'} onClick={onClose} className="w-full py-6 rounded-xl bg-white text-black font-black text-[10px] uppercase tracking-widest hover:bg-stone-200">Commit Verdict</Button>
        </div>
      </div>
    </div>
  );
}

function DisqModal({ app, onDisqualify, onClose }) {
  const [reason, setReason] = useState('');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-red-950/20" onClick={onClose}>
      <Card className="w-full max-w-md shadow-2xl border-none overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-red-100" style={{ background: C.redSoft }}>
          <h3 className="text-xs font-black uppercase tracking-widest" style={{ color: C.red }}>Disqualification Record</h3>
          <p className="text-[10px] font-bold mt-0.5 text-stone-500">{app.name} · {app.id}</p>
        </div>
        <CardContent className="p-6 space-y-3">
          {DISQ_REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all border ${reason === r ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-stone-200 text-stone-600'}`}>{r}</button>
          ))}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</Button>
            <Button disabled={!reason} onClick={() => { onDisqualify(app.id, reason); onClose(); }} className="flex-1 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Confirm</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

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
    return apps.filter(a => {
      const matchSearch = !q || a.name.toLowerCase().includes(q) || a.id.includes(q);
      const matchProgram = program === 'All Programs' || a.program === program;
      const matchStatus = status === 'all' || a.status === status;
      return matchSearch && matchProgram && matchStatus;
    });
  }, [apps, search, program, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allSel = pageData.length > 0 && pageData.every(a => selected.has(a.id));

  const handleDisqualify = (id, reason) => {
    setApps(prev => prev.map(a => a.id === id ? { ...a, disqualified: true, disqReason: reason, status: 'missing' } : a));
  };

  const STATS = [
    { label: 'Total Applications', value: String(apps.length), icon: Users, accent: C.brown, soft: C.amberSoft },
    { label: 'Documents Ready', value: String(apps.filter(a => a.status === 'ready').length), icon: CheckCircle2, accent: C.green, soft: C.greenSoft },
    { label: 'Under Review', value: String(apps.filter(a => a.status === 'review').length), icon: Clock, accent: C.amber, soft: C.yellowSoft },
    { label: 'SD Flagged', value: String(apps.filter(a => a.deficiency === 'sd').length), icon: AlertTriangle, accent: C.red, soft: C.redSoft },
  ];

  return (
    <div className="space-y-8 py-2 px-1 animate-in fade-in duration-500" style={{ background: C.bg }}>
      {loiApp && <LOIModal app={loiApp} onClose={() => setLoiApp(null)} />}
      {disqApp && <DisqModal app={disqApp} onDisqualify={handleDisqualify} onClose={() => setDisqApp(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: C.text }}>Applications</h1>
          <p className="text-sm font-medium text-stone-400 mt-1 uppercase tracking-widest">{filtered.length} total records · 2025–2026</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowRepl(!showRepl)} className={`rounded-xl border-stone-200 font-black text-[10px] uppercase tracking-widest ${showRepl ? 'border-amber-400 bg-amber-50 text-amber-700' : ''}`}>
            <UserPlus className="mr-2 h-4 w-4" /> Replacement Queue
          </Button>
          <Button className="rounded-xl shadow-md text-white border-none" style={{ background: C.brownMid }}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Grid (Matches Dashboard Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map(s => (
          <Card key={s.label} className="border-stone-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner" style={{ background: s.soft }}>
                <s.icon className="w-5 h-5" style={{ color: s.accent }} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tighter" style={{ color: C.text }}>{s.value}</div>
              <p className="text-[11px] font-bold text-stone-500 uppercase tracking-widest mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Replacement Queue (Matches Dashboard Enrollment Trends layout) */}
      {showRepl && (
        <Card className="border-stone-200 overflow-hidden animate-in slide-in-from-top duration-300">
          <CardHeader className="bg-stone-50/40 border-b border-stone-100 pb-4">
            <CardTitle className="text-base font-bold text-stone-800">Scholar Replacement Queue</CardTitle>
            <CardDescription className="text-xs">Ranked waitlist — promoted when a slot becomes available</CardDescription>
          </CardHeader>
          <Table>
            <TableHeader className="bg-stone-50/80">
              <TableRow className="border-stone-100 hover:bg-transparent">
                <TableHead className="font-black text-[10px] uppercase tracking-widest py-3 px-6">Rank</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest py-3">Candidate</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest py-3 text-center">GWA</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-widest py-3 text-right px-6">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {REPLACEMENTS.map(r => (
                <TableRow key={r.id} className="border-stone-100 hover:bg-amber-50/20">
                  <TableCell className="px-6 py-4 font-black text-amber-600">#0{r.rank}</TableCell>
                  <TableCell className="py-4 font-bold text-stone-800">{r.name}</TableCell>
                  <TableCell className="py-4 text-center font-mono font-bold text-xs">{r.gwa}</TableCell>
                  <TableCell className="py-4 px-6 text-right"><Button size="sm" className="h-7 rounded-lg bg-amber-600 text-white font-black text-[9px] uppercase tracking-widest shadow-md">Promote</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Filter Bar (Matches Dashboard Tabs Container logic) */}
      <Card className="border-stone-200 shadow-sm overflow-visible">
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-300" />
            <Input placeholder="Search by name or ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 h-11 bg-stone-50/50 rounded-xl border-stone-200 font-medium" />
          </div>
          <Select value={program} onValueChange={setProgram}>
            <SelectTrigger className="w-[160px] h-11 rounded-xl bg-stone-50/50 font-bold text-xs uppercase tracking-wider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>{PROGRAMS.map(p => <SelectItem key={p} value={p} className="text-xs font-bold">{p}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setShowAdv(!showAdv)} className={`h-11 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest ${showAdv ? 'bg-stone-100' : 'text-stone-500'}`}>
            <SlidersHorizontal className="w-4 h-4 mr-2" /> Filters
          </Button>
        </CardContent>
      </Card>

      {/* Main Registry Table */}
      <Card className="border-stone-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-stone-50/40 pb-4 border-b border-stone-100">
          <CardTitle className="text-base font-bold text-stone-800">Application Registry</CardTitle>
          <CardDescription className="text-xs">Integrated scholarship management ledger</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader className="bg-stone-50/80">
            <TableRow className="border-stone-100 hover:bg-transparent">
              <TableHead className="w-12 px-6 py-4"><input type="checkbox" checked={allSel} className="rounded-sm accent-stone-900" onChange={() => { }} /></TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest py-4">Student Profile</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 text-center">Status</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 text-center">LOI</TableHead>
              <TableHead className="font-black text-[10px] uppercase tracking-widest py-4 text-right px-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.map(app => (
              <TableRow key={app.id} className={`border-stone-100 transition-colors ${app.disqualified ? 'bg-red-50/30' : 'hover:bg-amber-50/20'}`}>
                <TableCell className="px-6 py-5"><input type="checkbox" checked={selected.has(app.id)} className="accent-stone-900" onChange={() => { }} /></TableCell>
                <TableCell className="py-5">
                  <div className="font-black text-stone-800 text-sm leading-tight">{app.name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-stone-400">{app.id}</span>
                    {app.disqualified && <Badge className="bg-red-50 text-red-600 border-red-100 text-[8px] font-black uppercase tracking-tighter h-4">Disqualified</Badge>}
                  </div>
                </TableCell>
                <TableCell className="py-5 text-center">
                  <Badge variant="outline" className="border-none px-3 py-1 font-black text-[9px] uppercase tracking-widest" style={{ background: STATUS_MAP[app.status]?.bg, color: STATUS_MAP[app.status]?.color }}>{STATUS_MAP[app.status]?.label}</Badge>
                </TableCell>
                <TableCell className="py-5 text-center">
                  <button onClick={() => setLoiApp(app)} className="inline-flex items-center justify-center p-2 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-900 hover:text-white transition-all shadow-sm"><FileText className="w-4 h-4" /></button>
                </TableCell>
                <TableCell className="py-5 px-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" onClick={() => navigate('/admin/applications/' + app.id)} className="h-8 rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 font-black text-[9px] uppercase tracking-widest px-3 shadow-none"><Eye className="w-3.5 h-3.5 mr-1.5" /> View</Button>
                    {!app.disqualified && <Button size="sm" onClick={() => setDisqApp(app)} className="h-8 rounded-lg bg-white border border-red-100 text-red-600 hover:bg-red-50 font-black text-[9px] uppercase tracking-widest px-3 shadow-none"><UserMinus className="w-3.5 h-3.5" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="px-6 py-4 bg-stone-50/50 border-t border-stone-100 flex items-center justify-between">
          <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest italic">Secure Central Registry Interface</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg"><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-[10px] font-black px-3 py-1 bg-white border border-stone-200 rounded-lg">Page {page} of {totalPages}</span>
            <Button size="sm" variant="outline" className="h-8 w-8 p-0 rounded-lg"><ChevronRight className="w-4 h-4" /></Button>
          </div>
        </div>
      </Card>

      {/* Footer (Matches Dashboard) */}
      <footer className="pt-10 pb-6 border-t border-stone-100">
        <p className="text-center text-[10px] font-black text-stone-300 uppercase tracking-widest">SMaRT PDM Secure Registry · Application Management Layer</p>
      </footer>
    </div>
  );
}