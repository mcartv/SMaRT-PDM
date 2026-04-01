import React, { useState, useMemo, useEffect } from 'react';
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
  FileText, X, Users, CheckCircle2, Clock, AlertCircle, Loader2
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

const PROGRAMS = ['All Programs', 'TES', 'TDP', 'Private'];
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
            <p className="text-[10px] text-stone-500 font-bold mt-0.5">{app.name || 'Unknown Student'} · {app.id || app.application_id}</p>
          </div>
          <Badge className="text-[9px] font-black border-none" style={{ background: vs.bg, color: vs.color }}>{vs.label}</Badge>
        </div>

        {/* --- UPDATED IMAGE PREVIEW SECTION --- */}
        <div className="p-6">
          <div className="aspect-[4/3] rounded-xl bg-stone-50 relative flex flex-col items-center justify-center border-2 border-dashed border-stone-200 overflow-hidden">
            {app.loi_content ? (
              <img
                src={app.loi_content}
                alt="Letter of Intent"
                className="w-full h-full object-contain bg-stone-200/50"
              />
            ) : (
              <>
                <FileText className="w-12 h-12 text-stone-200 mb-3" />
                <p className="text-xs font-black text-stone-400 uppercase tracking-widest italic">No LOI Uploaded</p>
              </>
            )}
          </div>
        </div>
        {/* ----------------------------------- */}

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
          <p className="text-[10px] font-bold mt-0.5 text-stone-500">{app.name || 'Unknown'} · {app.id || app.application_id}</p>
        </div>
        <CardContent className="p-6 space-y-3">
          {DISQ_REASONS.map(r => (
            <button key={r} onClick={() => setReason(r)} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all border ${reason === r ? 'bg-red-600 border-red-600 text-white' : 'bg-white border-stone-200 text-stone-600'}`}>{r}</button>
          ))}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl text-[10px] font-black uppercase tracking-widest">Cancel</Button>
            <Button disabled={!reason} onClick={() => { onDisqualify(app.application_id || app.id, reason); onClose(); }} className="flex-1 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest">Confirm</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────

export default function ApplicationReview() {
  const navigate = useNavigate();

  // ─── DATABASE STATE ───
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ─── UI STATE ───
  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(new Set());
  const [showAdv, setShowAdv] = useState(false);
  const [showRepl, setShowRepl] = useState(false);
  const [loiApp, setLoiApp] = useState(null);
  const [disqApp, setDisqApp] = useState(null);

  // ─── API FETCH ───
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:5000/api/applications', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) throw new Error('Failed to fetch applications from registry');

        const data = await response.json();
        setApps(data);
      } catch (err) {
        console.error("Database Error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  // ─── FILTER LOGIC ───
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return apps.filter(a => {
      const matchSearch = !q || a.student_name?.toLowerCase().includes(q) ||
        (a.application_id || a.id)?.toLowerCase().includes(q);

      const matchProgram = program === 'All Programs' || (a.program_name || a.program) === program;
      const matchStatus = status === 'all' || a.application_status === status || a.status === status;

      return matchSearch && matchProgram && matchStatus;
    });
  }, [apps, search, program, status]);

  useEffect(() => {
    setPage(1);
  }, [search, program, status]);

  // ─── DISQUALIFICATION ACTION (API CALL) ───
  const handleDisqualify = async (id, reason) => {
    try {
      const response = await fetch(`http://localhost:5000/api/applications/${id}/disqualify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });

      if (response.ok) {
        // Refresh local state
        setApps(prev => prev.map(a =>
          (a.application_id === id || a.id === id)
            ? { ...a, disqualified: true, is_disqualified: true, disqualification_reason: reason, status: 'missing' }
            : a
        ));
      }
    } catch (err) {
      alert("Failed to update database: " + err.message);
    }
  };

  // ─── LOADING/ERROR UI ───
  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <Loader2 className="w-8 h-8 animate-spin text-stone-400" />
      <p className="text-sm font-medium text-stone-500 uppercase tracking-widest">Syncing Application Ledger...</p>
    </div>
  );

  if (error) return (
    <div className="p-8 bg-red-50 border border-red-100 rounded-2xl text-center">
      <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
      <p className="text-red-800 font-bold">Ledger Connection Failed</p>
      <p className="text-red-600 text-sm mt-1">{error}</p>
      <Button onClick={() => window.location.reload()} variant="outline" className="mt-4 border-red-200 text-red-600">Retry Sync</Button>
    </div>
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allSel = pageData.length > 0 && pageData.every(a => selected.has(a.application_id || a.id));

  const STATS = [
    { label: 'Total Applications', value: String(apps.length), icon: Users, accent: C.brown, soft: C.amberSoft },
    { label: 'Documents Ready', value: String(apps.filter(a => a.status === 'ready' || a.application_status === 'ready').length), icon: CheckCircle2, accent: C.green, soft: C.greenSoft },
    { label: 'Under Review', value: String(apps.filter(a => a.status === 'review' || a.application_status === 'review').length), icon: Clock, accent: C.amber, soft: C.yellowSoft },
    { label: 'SD Flagged', value: String(apps.filter(a => a.deficiency === 'sd' || a.deficiency_status === 'sd').length), icon: AlertTriangle, accent: C.red, soft: C.redSoft },
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
          <Button className="rounded-xl shadow-md text-white border-none" style={{ background: C.brownMid }}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
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

      {/* Filter Bar */}
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
              <TableRow key={app.id || app.application_id} className={`border-stone-100 transition-colors ${app.disqualified || app.is_disqualified ? 'bg-red-50/30' : 'hover:bg-amber-50/20'}`}>
                <TableCell className="px-6 py-5"><input type="checkbox" checked={selected.has(app.id || app.application_id)} className="accent-stone-900" onChange={() => { }} /></TableCell>
                <TableCell className="py-5">
                  <div className="font-black text-stone-800 text-sm leading-tight">{app.name || app.student_name}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-mono text-stone-400">{app.id || app.application_id}</span>
                    {(app.disqualified || app.is_disqualified) && <Badge className="bg-red-50 text-red-600 border-red-100 text-[8px] font-black uppercase tracking-tighter h-4">Disqualified</Badge>}
                  </div>
                </TableCell>
                <TableCell className="py-5 text-center">
                  <Badge variant="outline" className="border-none px-3 py-1 font-black text-[9px] uppercase tracking-widest" style={{ background: STATUS_MAP[app.status || app.application_status]?.bg, color: STATUS_MAP[app.status || app.application_status]?.color }}>{STATUS_MAP[app.status || app.application_status]?.label || 'Pending'}</Badge>
                </TableCell>
                <TableCell className="py-5 text-center">
                  {/* --- THE LOI BUTTON TRIGGERS THE UPDATED MODAL --- */}
                  <button onClick={() => setLoiApp(app)} className="inline-flex items-center justify-center p-2 rounded-lg bg-stone-100 text-stone-500 hover:bg-stone-900 hover:text-white transition-all shadow-sm"><FileText className="w-4 h-4" /></button>
                </TableCell>
                <TableCell className="py-5 px-6 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Button size="sm" onClick={() => navigate('/admin/applications/' + (app.application_id || app.id))} className="h-8 rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 font-black text-[9px] uppercase tracking-widest px-3 shadow-none"><Eye className="w-3.5 h-3.5 mr-1.5" /> View</Button>
                    {!(app.disqualified || app.is_disqualified) && <Button size="sm" onClick={() => setDisqApp(app)} className="h-8 rounded-lg bg-white border border-red-100 text-red-600 hover:bg-red-50 font-black text-[9px] uppercase tracking-widest px-3 shadow-none"><UserMinus className="w-3.5 h-3.5" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="px-6 py-4 bg-stone-50/50 border-t border-stone-100 flex items-center justify-between">
          <span className="text-[10px] font-black text-stone-400 uppercase tracking-widest italic">Secure Central Registry Interface</span>
          <div className="flex items-center gap-2">
            {/* --- PREVIOUS PAGE BUTTON --- */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <span className="text-[10px] font-black px-3 py-1 bg-white border border-stone-200 rounded-lg">
              Page {page} of {totalPages}
            </span>

            {/* --- NEXT PAGE BUTTON --- */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Footer */}
      <footer className="pt-10 pb-6 border-t border-stone-100">
        <p className="text-center text-[10px] font-black text-stone-300 uppercase tracking-widest">SMaRT PDM Secure Registry · Application Management Layer</p>
      </footer>
    </div>
  );
}