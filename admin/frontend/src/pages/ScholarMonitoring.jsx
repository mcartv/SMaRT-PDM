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
  AlertTriangle, Users, CheckCircle2, Clock, Loader2,
  X, Mail, Phone, CalendarDays, ShieldAlert, FileText
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

const CONDITION_STYLE = {
  good: { label: 'Good Standing', color: C.green, bg: C.greenSoft },
  monitor: { label: 'Monitor', color: C.amber, bg: C.amberSoft },
  risk: { label: 'At Risk', color: C.red, bg: C.redSoft },
  critical: { label: 'Critical', color: '#991b1b', bg: '#fee2e2' },
};

function getScholarConditionMeta(gwa, sdu) {
  const g = Number(gwa);
  const level = sdu || 'none';

  if (!Number.isNaN(g) && g > 2.0 && level === 'major') {
    return CONDITION_STYLE.critical;
  }

  if (!Number.isNaN(g) && g > 2.0) {
    return CONDITION_STYLE.risk;
  }

  if (level === 'major') {
    return CONDITION_STYLE.risk;
  }

  if (level === 'minor') {
    return CONDITION_STYLE.monitor;
  }

  return CONDITION_STYLE.good;
}

const PAGE_SIZE = 10;

function ScholarProfileModal({ scholar, loading, onClose }) {
  if (!scholar && !loading) return null;

  const s = scholar || {};
  const gwaValue = Number(s.gwa);
  const sduStyle = SDU_STYLE[s.sdu_level || 'none'] || SDU_STYLE.none;
  const pct = Number(s.ro_progress || 0);
  const condition = getScholarConditionMeta(s.gwa, s.sdu_level);

  const roStatus =
    pct === 100 ? 'complete' :
      pct >= 50 ? 'progress' : 'behind';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden border-stone-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50">
          <div>
            <h3 className="text-base font-semibold text-stone-800">Scholar Profile</h3>
            <p className="text-xs text-stone-500 mt-0.5">
              Administrative profile, activity logs, and monitoring details
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-73px)] p-5 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center min-h-[320px] gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
              <p className="text-xs text-stone-400 uppercase tracking-widest">
                Loading scholar profile...
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <Card className="border-stone-200 shadow-none lg:col-span-1">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold"
                      style={{ background: C.amberSoft, color: C.brown }}
                    >
                      {(s.student_name || 'NA')
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>

                    <div>
                      <h4 className="text-base font-semibold text-stone-800">
                        {s.student_name || 'Unknown Scholar'}
                      </h4>
                      <p className="text-xs font-mono text-stone-400 mt-0.5">
                        {s.student_number || 'N/A'}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <Badge
                          variant="outline"
                          className="text-[10px] border-stone-200 text-stone-600 bg-white"
                        >
                          {s.program_name || 'No Program'}
                        </Badge>

                        <span
                          className="text-[10px] font-medium px-2 py-1 rounded-full"
                          style={{
                            background: s.status === 'Active' ? C.greenSoft : C.redSoft,
                            color: s.status === 'Active' ? C.green : C.red,
                          }}
                        >
                          {s.status || 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2 text-xs">
                    <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                      <span className="text-stone-500">Batch Year</span>
                      <span className="font-medium text-stone-800">{s.batch_year || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                      <span className="text-stone-500">Date Awarded</span>
                      <span className="font-medium text-stone-800">{s.date_awarded || 'N/A'}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                      <span className="text-stone-500">GWA</span>
                      <span
                        className="font-semibold"
                        style={{ color: gwaValue >= 2.0 ? C.red : C.green }}
                      >
                        {Number.isNaN(gwaValue) ? '—' : gwaValue.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                      <span className="text-stone-500">SDU Status</span>
                      <span
                        className="text-[10px] font-medium px-2 py-1 rounded-full"
                        style={{ background: sduStyle.bg, color: sduStyle.color }}
                      >
                        {sduStyle.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                      <span className="text-stone-500">Condition</span>
                      <span
                        className="text-[10px] font-medium px-2 py-1 rounded-full"
                        style={{ background: condition.bg, color: condition.color }}
                      >
                        {condition.label}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-stone-200 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-stone-700">RO Progress</p>
                      <span
                        className="text-[11px] font-semibold"
                        style={{ color: RO_COLOR[roStatus] }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-stone-200 overflow-hidden">
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${pct}%`,
                          background: RO_COLOR[roStatus],
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="lg:col-span-2 space-y-5">
                <Card className="border-stone-200 shadow-none">
                  <CardHeader className="pb-2">
                    <h4 className="text-sm font-semibold text-stone-800">Admin Information</h4>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-stone-200 px-3 py-3">
                      <div className="flex items-center gap-2 text-stone-500 mb-1">
                        <Mail size={13} />
                        <span>Email</span>
                      </div>
                      <p className="font-medium text-stone-800">{s.email || 'Not available'}</p>
                    </div>

                    <div className="rounded-lg border border-stone-200 px-3 py-3">
                      <div className="flex items-center gap-2 text-stone-500 mb-1">
                        <Phone size={13} />
                        <span>Phone</span>
                      </div>
                      <p className="font-medium text-stone-800">{s.phone_number || 'Not available'}</p>
                    </div>

                    <div className="rounded-lg border border-stone-200 px-3 py-3">
                      <div className="flex items-center gap-2 text-stone-500 mb-1">
                        <CalendarDays size={13} />
                        <span>Scholar ID</span>
                      </div>
                      <p className="font-medium text-stone-800">{s.scholar_id || 'N/A'}</p>
                    </div>

                    <div className="rounded-lg border border-stone-200 px-3 py-3">
                      <div className="flex items-center gap-2 text-stone-500 mb-1">
                        <ShieldAlert size={13} />
                        <span>Monitoring Flag</span>
                      </div>
                      <p className="font-medium text-stone-800">{condition.label}</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                  <CardHeader className="pb-2">
                    <h4 className="text-sm font-semibold text-stone-800">Activity Logs</h4>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {Array.isArray(s.activity_logs) && s.activity_logs.length > 0 ? (
                      s.activity_logs.map((log, index) => {
                        const title = log.action || log.title || 'Untitled activity';
                        const description = log.details || log.description || 'No details provided.';
                        const dateValue = log.created_at || log.date || null;

                        return (
                          <div
                            key={log.log_id || log.id || index}
                            className="rounded-xl border border-stone-200 p-3 bg-white"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-stone-800">{title}</p>
                                <p className="text-xs text-stone-500 mt-1">{description}</p>
                              </div>
                              <span className="text-[11px] text-stone-400 whitespace-nowrap">
                                {dateValue ? new Date(dateValue).toLocaleDateString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4">
                        <p className="text-xs text-stone-500">No activity logs available.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                  <CardHeader className="pb-2">
                    <h4 className="text-sm font-semibold text-stone-800">Admin Notes</h4>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4">
                      <div className="flex items-center gap-2 mb-2 text-stone-500">
                        <FileText size={14} />
                        <span className="text-xs font-medium">Internal remarks</span>
                      </div>
                      <p className="text-xs text-stone-600 leading-relaxed">
                        Use this section for important scholarship monitoring details such as
                        compliance follow-ups, academic intervention notes, SDU observations,
                        renewal concerns, and beneficiary communication history.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function ScholarMonitoring() {
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
  const [selectedScholarId, setSelectedScholarId] = useState(null);
  const [selectedScholar, setSelectedScholar] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [sduFilter, setSduFilter] = useState('All SDU');
  const [roFilter, setRoFilter] = useState('All RO');
  const [sortBy, setSortBy] = useState('Name A-Z');

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

  const handleViewScholar = async (scholarId) => {
    try {
      setSelectedScholarId(scholarId);
      setProfileLoading(true);
      setSelectedScholar(null);

      const res = await fetch(`http://localhost:5000/api/scholars/${scholarId}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
      });

      const rawText = await res.text();

      if (!res.ok) {
        console.error('Scholar profile response error:', res.status, rawText);
        throw new Error(`Failed to fetch scholar profile: ${res.status} ${rawText}`);
      }

      const data = rawText ? JSON.parse(rawText) : null;
      setSelectedScholar(data);
    } catch (err) {
      console.error('SCHOLAR PROFILE FETCH ERROR:', err);
      alert(err.message || 'Failed to fetch scholar profile');
      setSelectedScholarId(null);
    } finally {
      setProfileLoading(false);
    }
  };

  // ─── FILTERS ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const normalizedQ = q.replace(/[^a-z0-9]/g, '');

    let results = scholars.filter((s) => {
      const name = (s.student_name || '').toLowerCase();
      const studentNumber = String(s.student_number || '').toLowerCase();
      const normalizedStudentNumber = studentNumber.replace(/[^a-z0-9]/g, '');
      const programName = s.program_name || '';
      const batch = String(s.batch_year || '');
      const scholarStatus = s.status || '';
      const gwa = Number(s.gwa);
      const sduLevel = s.sdu_level || 'none';
      const roProgress = Number(s.ro_progress || 0);

      const nameParts = name
        .replace(',', ' ')
        .split(/\s+/)
        .filter(Boolean);

      const matchSearch =
        !q ||
        name.startsWith(q) ||
        nameParts.some((part) => part.startsWith(q)) ||
        studentNumber.startsWith(q) ||
        normalizedStudentNumber.startsWith(normalizedQ);

      const matchProgram =
        program === 'All Programs' || programName === program;

      const matchBatch =
        batchYear === 'All Years' || batch === String(batchYear);

      const matchStatus =
        status === 'All Statuses' || scholarStatus === status;

      const matchSdu =
        sduFilter === 'All SDU' ||
        (sduFilter === 'Clear' && sduLevel === 'none') ||
        (sduFilter === 'Minor' && sduLevel === 'minor') ||
        (sduFilter === 'Major' && sduLevel === 'major');

      let matchGwa = true;
      if (gwaFilter === 'Excellence (<1.5)') matchGwa = !Number.isNaN(gwa) && gwa < 1.5;
      else if (gwaFilter === 'Good (1.5-2.0)') matchGwa = !Number.isNaN(gwa) && gwa >= 1.5 && gwa <= 2.0;
      else if (gwaFilter === 'At Risk (>2.0)') matchGwa = !Number.isNaN(gwa) && gwa > 2.0;

      let matchRo = true;
      if (roFilter === 'Complete (100%)') matchRo = roProgress === 100;
      else if (roFilter === 'In Progress (50-99%)') matchRo = roProgress >= 50 && roProgress < 100;
      else if (roFilter === 'Behind (<50%)') matchRo = roProgress < 50;

      return (
        matchSearch &&
        matchProgram &&
        matchBatch &&
        matchStatus &&
        matchSdu &&
        matchGwa &&
        matchRo
      );
    });

    results = [...results].sort((a, b) => {
      const nameA = (a.student_name || '').toLowerCase();
      const nameB = (b.student_name || '').toLowerCase();
      const gwaA = Number(a.gwa);
      const gwaB = Number(b.gwa);
      const batchA = Number(String(a.batch_year || '').split('-')[0]) || 0;
      const batchB = Number(String(b.batch_year || '').split('-')[0]) || 0;
      const roA = Number(a.ro_progress || 0);
      const roB = Number(b.ro_progress || 0);

      switch (sortBy) {
        case 'Name Z-A':
          return nameB.localeCompare(nameA);
        case 'GWA Asc':
          return gwaA - gwaB;
        case 'GWA Desc':
          return gwaB - gwaA;
        case 'Batch Newest':
          return batchB - batchA;
        case 'Batch Oldest':
          return batchA - batchB;
        case 'RO Highest':
          return roB - roA;
        case 'RO Lowest':
          return roA - roB;
        case 'Name A-Z':
        default:
          return nameA.localeCompare(nameB);
      }
    });

    return results;
  }, [scholars, search, program, batchYear, status, gwaFilter, sduFilter, roFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, program, batchYear, status, gwaFilter, sduFilter, roFilter, sortBy]);

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

  const statusOptions = ['All Statuses', 'Active', 'At Risk', 'Inactive'];

  const sduOptions = ['All SDU', 'Clear', 'Minor', 'Major'];

  const roOptions = [
    'All RO',
    'Complete (100%)',
    'In Progress (50-99%)',
    'Behind (<50%)',
  ];

  const sortOptions = [
    'Name A-Z',
    'Name Z-A',
    'GWA Asc',
    'GWA Desc',
    'Batch Newest',
    'Batch Oldest',
    'RO Highest',
    'RO Lowest',
  ];

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
      {selectedScholarId && (
        <ScholarProfileModal
          scholar={selectedScholar}
          loading={profileLoading}
          onClose={() => {
            setSelectedScholarId(null);
            setSelectedScholar(null);
          }}
        />
      )}
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
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
          <Input
            placeholder="Search by scholar name or PDM ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-white rounded-lg border-stone-200"
          />
        </div>

        <Select value={program} onValueChange={setProgram}>
          <SelectTrigger className="w-[160px] h-9 rounded-lg border-stone-200 text-sm">
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
          <SelectTrigger className="w-[130px] h-9 rounded-lg border-stone-200 text-sm">
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
          <SelectTrigger className="w-[145px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((item) => (
              <SelectItem key={item} value={item} className="text-sm">
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sduFilter} onValueChange={setSduFilter}>
          <SelectTrigger className="w-[130px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sduOptions.map((item) => (
              <SelectItem key={item} value={item} className="text-sm">
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={gwaFilter} onValueChange={setGwaFilter}>
          <SelectTrigger className="w-[155px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All" className="text-sm">All GWA</SelectItem>
            <SelectItem value="Excellence (<1.5)" className="text-sm">Excellence</SelectItem>
            <SelectItem value="Good (1.5-2.0)" className="text-sm">Good</SelectItem>
            <SelectItem value="At Risk (>2.0)" className="text-sm">At Risk</SelectItem>
          </SelectContent>
        </Select>

        <Select value={roFilter} onValueChange={setRoFilter}>
          <SelectTrigger className="w-[165px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {roOptions.map((item) => (
              <SelectItem key={item} value={item} className="text-sm">
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[140px] h-9 rounded-lg border-stone-200 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((item) => (
              <SelectItem key={item} value={item} className="text-sm">
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(search ||
          program !== 'All Programs' ||
          batchYear !== 'All Years' ||
          status !== 'All Statuses' ||
          sduFilter !== 'All SDU' ||
          gwaFilter !== 'All' ||
          roFilter !== 'All RO' ||
          sortBy !== 'Name A-Z') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setProgram('All Programs');
                setBatchYear('All Years');
                setStatus('All Statuses');
                setSduFilter('All SDU');
                setGwaFilter('All');
                setRoFilter('All RO');
                setSortBy('Name A-Z');
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
              <TableHead className="text-xs font-medium text-stone-500 py-3 text-center">Condition</TableHead>
              <TableHead className="text-xs font-medium text-stone-500 py-3 text-center">RO Progress</TableHead>
              <TableHead className="text-xs font-medium text-stone-500 py-3 text-right pr-5">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-sm text-stone-400">
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
                      {(() => {
                        const condition = getScholarConditionMeta(s.gwa, s.sdu_level);
                        return (
                          <span
                            className="text-xs font-medium px-2.5 py-1 rounded-full"
                            style={{ background: condition.bg, color: condition.color }}
                          >
                            {condition.label}
                          </span>
                        );
                      })()}
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
                          onClick={() => handleViewScholar(s.scholar_id)}
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