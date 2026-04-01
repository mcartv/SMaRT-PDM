import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router';

// --- SHADCN UI COMPONENTS ---
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// --- ICONS ---
import {
  Search, Download, Eye, ChevronLeft, ChevronRight,
  AlertTriangle, Users, CheckCircle2, Clock, Loader2
} from 'lucide-react';

// ─── Theme ───────────────────────────────────────────────────────
const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  blueSoft: '#EFF6FF',
  text: '#1c1917',
  bg: '#faf7f2',
  muted: '#78716c',
};

// ─── Constants ───────────────────────────────────────────────────
const SDU_STYLE = {
  none: { label: 'Clear', color: C.green, bg: C.greenSoft },
  minor: { label: 'Minor', color: C.amber, bg: C.amberSoft },
  major: { label: 'Major', color: C.red, bg: C.redSoft },
};

const RO_COLOR = {
  complete: C.green,
  progress: C.amber,
  behind: C.red,
};

const PAGE_SIZE = 10;

export default function ScholarMonitoring() {
  const navigate = useNavigate();

  // ─── STATE ───────────────────────────────────────────────────
  const [scholars, setScholars] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    at_risk: 0,
    avg_gwa: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [batchYear, setBatchYear] = useState('All Years');
  const [status, setStatus] = useState('All Statuses');
  const [gwaFilter, setGwaFilter] = useState('All');
  const [page, setPage] = useState(1);

  // ─── FETCH ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchScholars = async () => {
      try {
        setLoading(true);

        const [scholarsRes, statsRes] = await Promise.all([
          fetch('http://localhost:5000/api/scholars', {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
              'Content-Type': 'application/json',
            },
          }),
          fetch('http://localhost:5000/api/scholars/stats', {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
              'Content-Type': 'application/json',
            },
          }),
        ]);

        if (!scholarsRes.ok) throw new Error('Failed to synchronize scholars');
        if (!statsRes.ok) throw new Error('Failed to synchronize scholar stats');

        const scholarsData = await scholarsRes.json();
        const statsData = await statsRes.json();

        setScholars(Array.isArray(scholarsData) ? scholarsData : []);
        setStats({
          total: Number(statsData.total) || 0,
          active: Number(statsData.active) || 0,
          at_risk: Number(statsData.at_risk) || 0,
          avg_gwa: Number(statsData.avg_gwa) || 0,
        });
      } catch (err) {
        console.error('Database Error:', err);
        setError(err.message || 'Failed to load scholar data');
      } finally {
        setLoading(false);
      }
    };

    fetchScholars();
  }, []);

  // ─── FILTERS ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    return scholars.filter((s) => {
      const name = (s.student_name || '').toLowerCase();
      const studentNumber = (s.student_number || '').toLowerCase();
      const programName = s.program_name || '';
      const batch = s.batch_year || '';
      const scholarStatus = s.status || '';
      const gwa = Number(s.gwa);

      const matchSearch =
        !q ||
        name.includes(q) ||
        studentNumber.includes(q);

      const matchProgram =
        program === 'All Programs' || programName === program;

      const matchBatch =
        batchYear === 'All Years' || batch === batchYear;

      const matchStatus =
        status === 'All Statuses' || scholarStatus === status;

      let matchGwa = true;
      if (gwaFilter === 'Excellence (<1.5)') matchGwa = gwa < 1.5;
      else if (gwaFilter === 'Good (1.5-2.0)') matchGwa = gwa >= 1.5 && gwa <= 2.0;
      else if (gwaFilter === 'At Risk (>2.0)') matchGwa = gwa > 2.0;

      return matchSearch && matchProgram && matchBatch && matchStatus && matchGwa;
    });
  }, [scholars, search, program, batchYear, status, gwaFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, program, batchYear, status, gwaFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const pageData = useMemo(() => {
    return filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filtered, page]);

  // ─── OPTIONS ────────────────────────────────────────────────
  const programOptions = useMemo(() => {
    return ['All Programs', ...new Set(scholars.map((s) => s.program_name).filter(Boolean))];
  }, [scholars]);

  const batchOptions = useMemo(() => {
    return ['All Years', ...new Set(scholars.map((s) => s.batch_year).filter(Boolean))];
  }, [scholars]);

  const statCards = useMemo(() => {
    return [
      {
        label: 'Total Scholars',
        value: stats.total,
        icon: Users,
        accent: C.brown,
        soft: C.amberSoft,
      },
      {
        label: 'Active Status',
        value: stats.active,
        icon: CheckCircle2,
        accent: C.green,
        soft: C.greenSoft,
      },
      {
        label: 'At Risk (GWA)',
        value: stats.at_risk,
        icon: AlertTriangle,
        accent: C.red,
        soft: C.redSoft,
      },
      {
        label: 'Avg GWA',
        value: Number(stats.avg_gwa || 0).toFixed(2),
        icon: Clock,
        accent: C.amber,
        soft: C.amberSoft,
      },
    ];
  }, [stats]);

  // ─── LOADING / ERROR ────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">
          Loading scholars...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <AlertTriangle className="w-7 h-7 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-800">Failed to load scholars</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <Button
          onClick={() => window.location.reload()}
          variant="outline"
          size="sm"
          className="mt-4 border-red-200 text-red-600 text-xs"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2" style={{ background: C.bg }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
            Scholars
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            {filtered.length} active records in registry
          </p>
        </div>

        <Button
          size="sm"
          className="rounded-lg text-white text-xs border-none"
          style={{ background: C.brownMid }}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((s) => (
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

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
          <Input
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white rounded-lg border-stone-200"
          />
        </div>

        <Select value={program} onValueChange={setProgram}>
          <SelectTrigger className="w-[150px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {programOptions.map((p) => (
              <SelectItem key={p} value={p} className="text-sm">
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={batchYear} onValueChange={setBatchYear}>
          <SelectTrigger className="w-[120px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {batchOptions.map((b) => (
              <SelectItem key={b} value={b} className="text-sm">
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All Statuses" className="text-sm">All Statuses</SelectItem>
            <SelectItem value="Active" className="text-sm">Active</SelectItem>
            <SelectItem value="At Risk" className="text-sm">At Risk</SelectItem>
            <SelectItem value="Inactive" className="text-sm">Inactive</SelectItem>
          </SelectContent>
        </Select>

        <Select value={gwaFilter} onValueChange={setGwaFilter}>
          <SelectTrigger className="w-[150px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All" className="text-sm">All Tiers</SelectItem>
            <SelectItem value="Excellence (<1.5)" className="text-sm">Excellence</SelectItem>
            <SelectItem value="Good (1.5-2.0)" className="text-sm">Good</SelectItem>
            <SelectItem value="At Risk (>2.0)" className="text-sm">At Risk</SelectItem>
          </SelectContent>
        </Select>

        {(search || program !== 'All Programs' || batchYear !== 'All Years' || status !== 'All Statuses' || gwaFilter !== 'All') && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('');
              setProgram('All Programs');
              setBatchYear('All Years');
              setStatus('All Statuses');
              setGwaFilter('All');
              setPage(1);
            }}
            className="h-9 rounded-lg text-xs border-stone-200"
          >
            Reset
          </Button>
        )}
      </div>

      {/* Table */}
      <Card className="border-stone-200 shadow-none overflow-hidden">
        <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
          <div>
            <h2 className="text-sm font-semibold text-stone-800">Scholar Registry</h2>
            <p className="text-xs text-stone-400">Integrated scholar monitoring ledger</p>
          </div>
        </CardHeader>

        <Table>
          <TableHeader className="bg-stone-50/80">
            <TableRow className="border-stone-100 hover:bg-transparent">
              <TableHead className="text-xs font-medium text-stone-500 py-3 px-5">Scholar Profile</TableHead>
              <TableHead className="text-xs font-medium text-stone-500 py-3 text-center">Batch</TableHead>
              <TableHead className="text-xs font-medium text-stone-500 py-3 text-center">GWA</TableHead>
              <TableHead className="text-xs font-medium text-stone-500 py-3 text-center">Status</TableHead>
              <TableHead className="text-xs font-medium text-stone-500 py-3 text-center">SDU</TableHead>
              <TableHead className="text-xs font-medium text-stone-500 py-3 text-center">RO Progress</TableHead>
              <TableHead className="text-xs font-medium text-stone-500 py-3 text-right pr-5">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-sm text-stone-400">
                  No scholars match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((s) => {
                const gwaValue = Number(s.gwa);
                const sduLevel = s.sdu_level || 'none';
                const sduStyle = SDU_STYLE[sduLevel] || SDU_STYLE.none;
                const pct = Number(s.ro_progress || 0);

                const roStatus =
                  pct === 100 ? 'complete' :
                    pct >= 50 ? 'progress' : 'behind';

                return (
                  <TableRow
                    key={s.scholar_id}
                    className="border-stone-100 hover:bg-amber-50/20 transition-colors"
                  >
                    <TableCell className="py-3.5 px-5">
                      <div className="font-medium text-stone-800 text-sm">{s.student_name}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs font-mono text-stone-400">{s.student_number}</span>
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium border-stone-200 text-stone-500 bg-white"
                        >
                          {s.program_name}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell className="py-3.5 text-center">
                      <span className="text-xs font-medium text-stone-600">
                        {s.batch_year}
                      </span>
                    </TableCell>

                    <TableCell className="py-3.5 text-center">
                      <span
                        className="font-semibold text-sm tabular-nums"
                        style={{ color: gwaValue >= 2.0 ? C.red : C.green }}
                      >
                        {Number.isNaN(gwaValue) ? '—' : gwaValue.toFixed(2)}
                      </span>
                    </TableCell>

                    <TableCell className="py-3.5 text-center">
                      <span
                        className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{
                          background: s.status === 'Active' ? C.greenSoft : C.redSoft,
                          color: s.status === 'Active' ? C.green : C.red,
                        }}
                      >
                        {s.status}
                      </span>
                    </TableCell>

                    <TableCell className="py-3.5 text-center">
                      <span
                        className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ background: sduStyle.bg, color: sduStyle.color }}
                      >
                        {sduStyle.label}
                      </span>
                    </TableCell>

                    <TableCell className="py-3.5 text-center">
                      <div className="flex items-center gap-2 justify-center min-w-[110px]">
                        <div className="flex-1 h-1.5 rounded-full bg-stone-200">
                          <div
                            className="h-1.5 rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: RO_COLOR[roStatus],
                            }}
                          />
                        </div>
                        <span
                          className="text-[10px] font-semibold w-8 text-right"
                          style={{ color: RO_COLOR[roStatus] }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3.5 pr-5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 rounded-lg bg-white border border-amber-200 text-amber-700 hover:bg-amber-50 text-xs shadow-none"
                          onClick={() => console.log('Override GWA:', s.scholar_id)}
                        >
                          GWA
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs shadow-none"
                          onClick={() => navigate(`/admin/scholars/${s.scholar_id}`)}
                        >
                          <Eye className="w-3 h-3 mr-1" />
                          View
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        <div className="px-5 py-3 bg-stone-50/50 border-t border-stone-100 flex items-center justify-between">
          <span className="text-xs text-stone-400">
            Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 rounded-lg border-stone-200"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>

            <span className="text-xs font-medium px-2.5 py-1 bg-white border border-stone-200 rounded-lg">
              {page} / {totalPages}
            </span>

            <Button
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0 rounded-lg border-stone-200"
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SMaRT PDM · Scholar Monitoring Layer
        </p>
      </footer>
    </div>
  );
}