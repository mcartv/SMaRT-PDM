import React, { useEffect, useMemo, useState } from 'react';

// --- SHADCN UI COMPONENTS ---
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// --- ICONS ---
import {
  Search,
  Eye,
  Save,
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
  Loader2,
  X,
  ShieldAlert,
  CalendarDays,
  GraduationCap,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { buildApiUrl } from '@/api';
const API_BASE = buildApiUrl('/api');const PAGE_SIZE = 10;

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
  blue: '#2563eb',
  blueSoft: '#EFF6FF',
  text: '#1c1917',
  bg: '#faf7f2',
  muted: '#78716c',
};

const SDO_STYLE = {
  none: { label: 'Clear', color: C.green, bg: C.greenSoft },
  minor: { label: 'Minor', color: C.amber, bg: C.amberSoft },
  major: { label: 'Major', color: C.red, bg: C.redSoft },
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All SDO' },
  { value: 'clear', label: 'Clear' },
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
];

const STATUS_OPTIONS = [
  { value: 'clear', label: 'Clear' },
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
];

function getToken() {
  return localStorage.getItem('sdoToken');
}

function getInitials(name = '') {
  return (name || 'NA')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function normalizeStatus(status) {
  if (status === 'minor') return 'Minor';
  if (status === 'major') return 'Major';
  return 'Clear';
}

function getEditableStatus(status) {
  return status === 'minor' || status === 'major' ? status : 'clear';
}

function getSdoStyle(status) {
  return SDO_STYLE[status || 'none'] || SDO_STYLE.none;
}

function formatDate(value) {
  if (!value) return 'N/A';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ScholarViewModal({ scholar, draft, onClose }) {
  if (!scholar) return null;

  const displayStatus = getSdoStyle(draft?.status || scholar.sdu_level);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
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
              Review scholar details before updating SDO probation status
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Card className="border-stone-200 shadow-none lg:col-span-1">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-start gap-3">
                  <div
                    className="w-12 h-12 rounded-2xl border border-stone-200 flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ background: C.amberSoft, color: C.brown }}
                  >
                    {getInitials(scholar.student_name)}
                  </div>

                  <div>
                    <h4 className="text-base font-semibold text-stone-800">
                      {scholar.student_name || 'Unknown Scholar'}
                    </h4>
                    <p className="text-xs font-mono text-stone-400 mt-0.5">
                      {scholar.student_number || 'N/A'}
                    </p>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <Badge
                        variant="outline"
                        className="text-[10px] border-stone-200 text-stone-600 bg-white"
                      >
                        {scholar.program_name || 'No Program'}
                      </Badge>

                      <span
                        className="text-[10px] font-medium px-2 py-1 rounded-full"
                        style={{
                          background: displayStatus.bg,
                          color: displayStatus.color,
                        }}
                      >
                        {displayStatus.label}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-xs">
                  <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                    <span className="text-stone-500">Batch Year</span>
                    <span className="font-medium text-stone-800">{scholar.batch_year || 'N/A'}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                    <span className="text-stone-500">Date Awarded</span>
                    <span className="font-medium text-stone-800">{formatDate(scholar.date_awarded)}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                    <span className="text-stone-500">Section</span>
                    <span className="font-medium text-stone-800">{scholar.section || 'N/A'}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-2">
                    <span className="text-stone-500">Current GWA</span>
                    <span
                      className="font-semibold"
                      style={{ color: Number(scholar.gwa) >= 2.0 ? C.red : C.green }}
                    >
                      {Number.isFinite(Number(scholar.gwa)) ? Number(scholar.gwa).toFixed(2) : '—'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-5">
              <Card className="border-stone-200 shadow-none">
                <CardHeader className="pb-2">
                  <h4 className="text-sm font-semibold text-stone-800">Profile Information</h4>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-lg border border-stone-200 px-3 py-3">
                    <div className="flex items-center gap-2 text-stone-500 mb-1">
                      <Users size={13} />
                      <span>Scholar</span>
                    </div>
                    <p className="font-medium text-stone-800">{scholar.student_name || 'Not available'}</p>
                  </div>

                  <div className="rounded-lg border border-stone-200 px-3 py-3">
                    <div className="flex items-center gap-2 text-stone-500 mb-1">
                      <ShieldAlert size={13} />
                      <span>Student ID</span>
                    </div>
                    <p className="font-medium text-stone-800">{scholar.student_number || 'Not available'}</p>
                  </div>

                  <div className="rounded-lg border border-stone-200 px-3 py-3">
                    <div className="flex items-center gap-2 text-stone-500 mb-1">
                      <GraduationCap size={13} />
                      <span>Program</span>
                    </div>
                    <p className="font-medium text-stone-800">{scholar.program_name || 'Not available'}</p>
                  </div>

                  <div className="rounded-lg border border-stone-200 px-3 py-3">
                    <div className="flex items-center gap-2 text-stone-500 mb-1">
                      <CalendarDays size={13} />
                      <span>Batch</span>
                    </div>
                    <p className="font-medium text-stone-800">{scholar.batch_year || 'Not available'}</p>
                  </div>

                  <div className="rounded-lg border border-stone-200 px-3 py-3">
                    <div className="flex items-center gap-2 text-stone-500 mb-1">
                      <ShieldAlert size={13} />
                      <span>Section</span>
                    </div>
                    <p className="font-medium text-stone-800">{scholar.section || 'Not available'}</p>
                  </div>

                  <div className="rounded-lg border border-stone-200 px-3 py-3">
                    <div className="flex items-center gap-2 text-stone-500 mb-1">
                      <ShieldAlert size={13} />
                      <span>Probation Status</span>
                    </div>
                    <p className="font-medium text-stone-800">{displayStatus.label}</p>
                  </div>

                  <div className="rounded-lg border border-stone-200 px-3 py-3 md:col-span-2">
                    <div className="flex items-center gap-2 text-stone-500 mb-1">
                      <Clock size={13} />
                      <span>Comment</span>
                    </div>
                    <p className="font-medium text-stone-800 whitespace-pre-wrap">
                      {(draft?.comment ?? scholar.sdo_comment ?? '').trim() || 'No comment provided.'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-stone-200 shadow-none">
                <CardHeader className="pb-2">
                  <h4 className="text-sm font-semibold text-stone-800">SDO Notes</h4>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-4">
                    <p className="text-xs text-stone-600 leading-relaxed">
                      Use this view to validate scholar identity, batch, section, program, and
                      existing probation notes before saving an SDO status update.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function SDOScholarList() {
  const [scholars, setScholars] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    clear: 0,
    minor: 0,
    major: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [batchYear, setBatchYear] = useState('All Years');
  const [probationFilter, setProbationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('Name A-Z');
  const [page, setPage] = useState(1);

  const [drafts, setDrafts] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [viewScholar, setViewScholar] = useState(null);

  const loadScholars = async ({ soft = false } = {}) => {
    try {
      if (soft) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError('');
      }

      const response = await fetch(`${API_BASE}/scholars`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load scholar list');
      }

      const rows = Array.isArray(data) ? data : [];
      setScholars(rows);

      const nextStats = rows.reduce(
        (acc, item) => {
          const level = getEditableStatus(item.sdu_level);
          acc.total += 1;
          if (level === 'clear') acc.clear += 1;
          if (level === 'minor') acc.minor += 1;
          if (level === 'major') acc.major += 1;
          return acc;
        },
        { total: 0, clear: 0, minor: 0, major: 0 }
      );

      setStats(nextStats);
    } catch (err) {
      setError(err.message || 'Failed to load scholar list.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadScholars();
  }, []);

  const programOptions = useMemo(() => {
    return ['All Programs', ...new Set(scholars.map((s) => s.program_name).filter(Boolean))];
  }, [scholars]);

  const batchOptions = useMemo(() => {
    return ['All Years', ...new Set(scholars.map((s) => s.batch_year).filter(Boolean))];
  }, [scholars]);

  const sortOptions = [
    'Name A-Z',
    'Name Z-A',
    'Batch Newest',
    'Batch Oldest',
    'Program A-Z',
    'Program Z-A',
  ];

  const filteredScholars = useMemo(() => {
    const q = search.trim().toLowerCase();

    let results = scholars.filter((scholar) => {
      const matchesSearch =
        !q ||
        (scholar.student_name || '').toLowerCase().includes(q) ||
        (scholar.student_number || '').toLowerCase().includes(q) ||
        (scholar.program_name || '').toLowerCase().includes(q) ||
        (scholar.batch_year || '').toLowerCase().includes(q) ||
        (scholar.section || '').toLowerCase().includes(q);

      const matchesProgram =
        program === 'All Programs' || scholar.program_name === program;

      const matchesBatch =
        batchYear === 'All Years' || String(scholar.batch_year || '') === String(batchYear);

      const scholarStatus = getEditableStatus(scholar.sdu_level);
      const matchesProbation =
        probationFilter === 'all' ? true : scholarStatus === probationFilter;

      return matchesSearch && matchesProgram && matchesBatch && matchesProbation;
    });

    results = [...results].sort((a, b) => {
      const nameA = (a.student_name || '').toLowerCase();
      const nameB = (b.student_name || '').toLowerCase();
      const batchA = String(a.batch_year || '');
      const batchB = String(b.batch_year || '');
      const programA = (a.program_name || '').toLowerCase();
      const programB = (b.program_name || '').toLowerCase();

      switch (sortBy) {
        case 'Name Z-A':
          return nameB.localeCompare(nameA);
        case 'Batch Newest':
          return batchB.localeCompare(batchA);
        case 'Batch Oldest':
          return batchA.localeCompare(batchB);
        case 'Program Z-A':
          return programB.localeCompare(programA);
        case 'Program A-Z':
          return programA.localeCompare(programB);
        case 'Name A-Z':
        default:
          return nameA.localeCompare(nameB);
      }
    });

    return results;
  }, [scholars, search, program, batchYear, probationFilter, sortBy]);

  useEffect(() => {
    setPage(1);
  }, [search, program, batchYear, probationFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredScholars.length / PAGE_SIZE));

  const pageData = useMemo(() => {
    return filteredScholars.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredScholars, page]);

  const handleDraftChange = (scholarId, field, value, scholar) => {
    setDrafts((current) => ({
      ...current,
      [scholarId]: {
        status: current[scholarId]?.status || getEditableStatus(scholar.sdu_level),
        comment: current[scholarId]?.comment ?? scholar.sdo_comment ?? '',
        [field]: value,
      },
    }));
  };

  const handleSave = async (scholar) => {
    const draft = drafts[scholar.scholar_id] || {
      status: getEditableStatus(scholar.sdu_level),
      comment: scholar.sdo_comment || '',
    };

    try {
      setSavingId(scholar.scholar_id);
      setFeedback('');
      setError('');

      const response = await fetch(`${API_BASE}/scholars/${scholar.scholar_id}/sdo-status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: draft.status,
          comment: draft.comment,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save scholar update');
      }

      setScholars((current) =>
        current.map((item) =>
          item.scholar_id === scholar.scholar_id
            ? {
                ...item,
                sdu_level: draft.status,
                sdo_comment: draft.comment,
              }
            : item
        )
      );

      setFeedback(`Updated ${scholar.student_name}'s probation status.`);
    } catch (err) {
      setError(err.message || 'Failed to save scholar update.');
    } finally {
      setSavingId(null);
    }
  };

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
        label: 'Clear',
        value: stats.clear,
        icon: CheckCircle2,
        accent: C.green,
        soft: C.greenSoft,
      },
      {
        label: 'Minor',
        value: stats.minor,
        icon: Clock,
        accent: C.amber,
        soft: C.amberSoft,
      },
      {
        label: 'Major',
        value: stats.major,
        icon: AlertTriangle,
        accent: C.red,
        soft: C.redSoft,
      },
    ];
  }, [stats]);

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

  if (error && !scholars.length) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <AlertTriangle className="w-7 h-7 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-800">Failed to load scholars</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <Button
          onClick={() => loadScholars()}
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
      {viewScholar && (
        <ScholarViewModal
          scholar={viewScholar}
          draft={drafts[viewScholar.scholar_id]}
          onClose={() => setViewScholar(null)}
        />
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
            Scholar Monitoring
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            Review scholar records and manage SDO probation updates.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadScholars({ soft: true })}
          className="rounded-lg text-xs border-stone-200 text-stone-600"
        >
          {refreshing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
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

      <Card className="border-stone-200 shadow-none overflow-hidden">
        <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-4 px-5">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search scholar, student ID, batch, program, or section"
                  className="h-10 rounded-lg border-stone-200 pl-9 text-sm bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 xl:w-auto">
                <Select value={program} onValueChange={setProgram}>
                  <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white text-sm min-w-[170px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {programOptions.map((option) => (
                      <SelectItem key={option} value={option} className="text-sm">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={batchYear} onValueChange={setBatchYear}>
                  <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white text-sm min-w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {batchOptions.map((option) => (
                      <SelectItem key={option} value={option} className="text-sm">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={probationFilter} onValueChange={setProbationFilter}>
                  <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white text-sm min-w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-sm">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white text-sm min-w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option} value={option} className="text-sm">
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {feedback && (
              <div className="rounded-lg px-4 py-3 text-sm border border-green-200 bg-green-50 text-green-700">
                {feedback}
              </div>
            )}

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm border border-red-200 bg-red-50 text-red-700">
                {error}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-stone-50/80">
              <TableRow className="border-stone-100 hover:bg-transparent">
                <TableHead className="text-xs font-medium text-stone-500 py-3 px-5">Scholar</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3">Student ID</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3">Batch</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3">Program</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3">Section</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3 w-[160px]">Probation Status</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3 min-w-[280px]">Comment</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3 text-right pr-5">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {pageData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-sm text-stone-400">
                    No scholars match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                pageData.map((scholar) => {
                  const draft = drafts[scholar.scholar_id] || {
                    status: getEditableStatus(scholar.sdu_level),
                    comment: scholar.sdo_comment || '',
                  };

                  return (
                    <TableRow
                      key={scholar.scholar_id}
                      className="border-stone-100 hover:bg-amber-50/20 transition-colors"
                    >
                      <TableCell className="py-3.5 px-5 align-top">
                        <div>
                          <p className="font-medium text-sm text-stone-800">
                            {scholar.student_name || 'Unknown Scholar'}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5 align-top text-sm text-stone-600">
                        {scholar.student_number || '—'}
                      </TableCell>

                      <TableCell className="py-3.5 align-top text-sm text-stone-600">
                        {scholar.batch_year || '—'}
                      </TableCell>

                      <TableCell className="py-3.5 align-top text-sm text-stone-600">
                        {scholar.program_name || '—'}
                      </TableCell>

                      <TableCell className="py-3.5 align-top text-sm text-stone-600">
                        {scholar.section || '—'}
                      </TableCell>

                      <TableCell className="py-3.5 align-top">
                        <Select
                          value={draft.status}
                          onValueChange={(value) =>
                            handleDraftChange(scholar.scholar_id, 'status', value, scholar)
                          }
                        >
                          <SelectTrigger className="h-9 rounded-lg border-stone-200 bg-white text-sm w-[120px]">
                            <SelectValue>{normalizeStatus(draft.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value} className="text-sm">
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>

                      <TableCell className="py-3.5 align-top">
                        <Textarea
                          value={draft.comment}
                          onChange={(e) =>
                            handleDraftChange(scholar.scholar_id, 'comment', e.target.value, scholar)
                          }
                          rows={3}
                          placeholder="Add disciplinary note or probation comment"
                          className="min-h-[88px] rounded-lg border-stone-200 text-sm resize-none bg-white"
                        />
                      </TableCell>

                      <TableCell className="py-3.5 pr-5 align-top">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setViewScholar(scholar)}
                            className="h-8 rounded-lg border-stone-200 text-xs"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1.5" />
                            View
                          </Button>

                          <Button
                            onClick={() => handleSave(scholar)}
                            disabled={savingId === scholar.scholar_id}
                            className="h-8 rounded-lg text-white text-xs px-4 border-none"
                            style={{ background: C.brownMid }}
                          >
                            {savingId === scholar.scholar_id ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                Saving
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5 mr-1.5" />
                                Save
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-stone-500">
          Showing {(page - 1) * PAGE_SIZE + (pageData.length ? 1 : 0)}–
          {(page - 1) * PAGE_SIZE + pageData.length} of {filteredScholars.length} scholars
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-stone-200 text-xs"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" />
            Prev
          </Button>

          <div className="px-3 text-xs text-stone-500">
            Page {page} of {totalPages}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-8 rounded-lg border-stone-200 text-xs"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
          >
            Next
            <ChevronRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}