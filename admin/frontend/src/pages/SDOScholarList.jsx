import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

// --- SHADCN UI COMPONENTS ---
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

// --- ICONS ---
import {
  Search,
  Eye,
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
  Loader2,
  X,
  ShieldAlert,
  CalendarDays,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

import { buildApiUrl } from '@/api';
import { toast } from 'sonner';
import { useSocketEvent } from '@/hooks/useSocket';
import usePortalTheme from '@/hooks/usePortalTheme';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';
import PreviewableProfileAvatar from '@/components/profile/PreviewableProfileAvatar';
import ScholarIdentity from '@/components/profile/ScholarIdentity';
const API_BASE = buildApiUrl('/api');const PAGE_SIZE = 10;

// ─── Theme ───────────────────────────────────────────────────────
const C = {
  brown: 'var(--portal-base)',
  brownMid: 'var(--portal-base)',
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
  { value: 'all', label: 'All Statuses' },
  { value: 'clear', label: 'Clear' },
  { value: 'minor', label: 'Minor Offense' },
  { value: 'major', label: 'Major Offense' },
];

const STATUS_OPTIONS = [
  { value: 'clear', label: 'Clear' },
  { value: 'minor', label: 'Minor' },
  { value: 'major', label: 'Major' },
];

function getToken() {
  return sessionStorage.getItem('sdoToken');
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
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'minor' || normalized === 'minor offense') return 'minor';
  if (normalized === 'major' || normalized === 'major offense') return 'major';
  return 'clear';
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

function ProfileDetail({ icon: Icon, label, children, wide = false }) {
  return (
    <div className={`rounded-xl border border-stone-200 bg-white px-4 py-3.5 ${wide ? 'sm:col-span-2' : ''}`}>
      <div className="mb-1.5 flex items-center gap-2 text-xs text-stone-500">
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <p className="whitespace-pre-wrap text-sm font-medium leading-5 text-stone-800">
        {children}
      </p>
    </div>
  );
}

function ScholarViewModal({ scholar, theme, onClose }) {
  useEffect(() => {
    if (!scholar) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [scholar]);

  if (!scholar || typeof document === 'undefined') return null;

  const displayStatus = getSdoStyle(getEditableStatus(scholar.sdu_level));

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] w-full items-center justify-center bg-black/45 p-0 backdrop-blur-[3px] sm:p-4"
      style={{
        '--portal-base': theme?.base || C.brown,
        '--portal-border': theme?.border || '#e7e5e4',
      }}
      onClick={onClose}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="sdo-scholar-profile-title"
        className="flex h-full max-h-[100dvh] w-full max-w-4xl flex-col overflow-hidden rounded-none border-stone-200 bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4 sm:px-6"
          style={{ background: theme?.accentSoft || '#fafaf9', borderColor: theme?.border }}
        >
          <div className="min-w-0">
            <h3 id="sdo-scholar-profile-title" className="text-lg font-semibold text-stone-900">
              Scholar Profile
            </h3>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Review scholarship and disciplinary information.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="-mr-1 rounded-lg p-2 text-stone-400 transition-colors hover:bg-white/70 hover:text-stone-700"
            aria-label="Close scholar profile"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-stone-50/50 p-4 sm:p-6">
          <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-stone-200 bg-white p-5">
              <ScholarIdentity
                scholar={scholar}
                name={scholar.student_name}
                studentNumber={scholar.student_number}
              />

              <div
                className="mt-5 rounded-xl border px-3.5 py-3"
                style={{ background: displayStatus.bg, borderColor: displayStatus.color }}
              >
                <p className="text-xs font-medium" style={{ color: displayStatus.color }}>
                  Disciplinary Standing
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: displayStatus.color }}>
                  {displayStatus.label}
                </p>
              </div>

              <div className="mt-4 divide-y divide-stone-100 rounded-xl border border-stone-200 px-3.5">
                {[
                  ['Scholarship Program', scholar.program_name || 'Not available'],
                  ['Course', scholar.course_code || scholar.course_name || 'Not available'],
                ].map(([label, value]) => (
                  <div key={label} className="py-3">
                    <p className="text-xs text-stone-500">{label}</p>
                    <p className="mt-1 text-sm font-medium leading-5 text-stone-800">{value}</p>
                  </div>
                ))}
              </div>
            </aside>

            <section className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-stone-900">Scholar Details</h4>
                <p className="mt-1 text-xs text-stone-500">Current scholarship and disciplinary record.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileDetail icon={GraduationCap} label="Scholarship Program">
                  {scholar.program_name || 'Not available'}
                </ProfileDetail>
                <ProfileDetail icon={ShieldAlert} label="Course">
                  {scholar.course_code || scholar.course_name || 'Not available'}
                </ProfileDetail>
                <ProfileDetail icon={CalendarDays} label="Batch Year">
                  {scholar.batch_year || 'Not available'}
                </ProfileDetail>
                <ProfileDetail icon={CalendarDays} label="Date Awarded">
                  {formatDate(scholar.date_awarded)}
                </ProfileDetail>
                <ProfileDetail icon={CheckCircle2} label="Disciplinary Standing">
                  {displayStatus.label}
                </ProfileDetail>
                <ProfileDetail icon={Users} label="Student ID">
                  {scholar.student_number || 'Not available'}
                </ProfileDetail>
                <ProfileDetail icon={Clock} label="SDO Comment" wide>
                  {(scholar.sdo_comment || '').trim() || 'No comment provided.'}
                </ProfileDetail>
              </div>
            </section>
          </div>
        </div>
      </Card>
    </div>,
    document.body
  );
}

function DisciplinaryStandingConfirmModal({
  action,
  remarks,
  onRemarksChange,
  saving,
  error,
  theme,
  onCancel,
  onConfirm,
}) {
  if (!action) return null;

  const status = getSdoStyle(action.status);
  const isMajor = action.status === 'major';
  const warning = isMajor
    ? 'This records a major disciplinary offense in the scholar’s official scholarship record. Review the selected standing carefully before confirming.'
    : action.status === 'minor'
      ? 'This records a minor disciplinary offense in the scholar’s official scholarship record.'
      : 'This records the scholar as clear of disciplinary offenses in the official scholarship record.';

  return (
    <AlertDialog open onOpenChange={(open) => !open && !saving && onCancel()}>
      <AlertDialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogMedia
            className={isMajor ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}
          >
            <ShieldAlert />
          </AlertDialogMedia>
          <AlertDialogTitle>Confirm disciplinary standing</AlertDialogTitle>
          <AlertDialogDescription>
            Update {action.scholar.student_name || 'this scholar'} to{' '}
            <span className="font-semibold" style={{ color: status.color }}>
              {status.label}
            </span>
            ?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div
            className={`rounded-xl border px-4 py-3 text-sm leading-5 ${
              isMajor
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {warning}
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-stone-700">
              Remarks or notes <span className="font-normal text-stone-400">(optional)</span>
            </span>
            <Textarea
              value={remarks}
              onChange={(event) => onRemarksChange(event.target.value)}
              rows={4}
              maxLength={500}
              disabled={saving}
              placeholder="Add optional disciplinary remarks or supporting notes"
              className="mt-2 min-h-24 resize-none rounded-xl border-stone-200 bg-white text-sm"
            />
            <span className="mt-1 block text-right text-[11px] text-stone-400">
              {remarks.length}/500
            </span>
          </label>

          {error ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            disabled={saving}
            onClick={onConfirm}
            className="border-none font-semibold text-white hover:brightness-95"
            style={{ background: theme.base }}
          >
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm Update
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Main Component ──────────────────────────────────────────────
export default function SDOScholarList() {
  const { theme } = usePortalTheme('sdo');
  const [scholars, setScholars] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    clear: 0,
    minor: 0,
    major: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [batchYear, setBatchYear] = useState('All Years');
  const [probationFilter, setProbationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('Name A-Z');
  const [page, setPage] = useState(1);

  const [savingId, setSavingId] = useState(null);
  const [viewScholar, setViewScholar] = useState(null);
  const [pendingStanding, setPendingStanding] = useState(null);
  const [confirmationRemarks, setConfirmationRemarks] = useState('');

  const loadScholars = async ({ soft = false } = {}) => {
    try {
      if (!soft) {
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
    }
  };

  useEffect(() => {
    loadScholars();
  }, []);

  useSocketEvent('scholar:updated', () => {
    loadScholars({ soft: true });
  }, []);

  useSocketEvent('scholar:created', () => {
    loadScholars({ soft: true });
  }, []);

  useSocketEvent('renewal:approved', () => {
    loadScholars({ soft: true });
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
        (scholar.course_code || '').toLowerCase().includes(q) ||
        (scholar.course_name || '').toLowerCase().includes(q);

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

  const requestStandingUpdate = (scholar, status) => {
    if (status === getEditableStatus(scholar.sdu_level)) return;
    setError('');
    setPendingStanding({ scholar, status });
    setConfirmationRemarks(scholar.sdo_comment || '');
  };

  const closeStandingConfirmation = () => {
    setPendingStanding(null);
    setConfirmationRemarks('');
    setError('');
  };

  const handleSave = async () => {
    if (!pendingStanding) return;

    const { scholar, status } = pendingStanding;
    const comment = confirmationRemarks.trim();

    try {
      setSavingId(scholar.scholar_id);
      setError('');

      const response = await fetch(`${API_BASE}/scholars/${scholar.scholar_id}/sdo-status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status,
          comment,
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
                sdu_level: status,
                sdo_comment: comment,
              }
            : item
        )
      );

      toast.success('Disciplinary standing updated', {
        description: `${scholar.student_name}'s disciplinary standing was saved.`,
      });
      setPendingStanding(null);
      setConfirmationRemarks('');
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
    return <PageLoadingSkeleton label="Loading SDO scholars" showStats />;
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
    <div className="space-y-5 py-2">
      {viewScholar && (
        <ScholarViewModal
          scholar={viewScholar}
          theme={theme}
          onClose={() => setViewScholar(null)}
        />
      )}

      <DisciplinaryStandingConfirmModal
        action={pendingStanding}
        remarks={confirmationRemarks}
        onRemarksChange={setConfirmationRemarks}
        saving={Boolean(pendingStanding && savingId === pendingStanding.scholar.scholar_id)}
        error={pendingStanding ? error : ''}
        theme={theme}
        onCancel={closeStandingConfirmation}
        onConfirm={handleSave}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((s) => (
          <Card key={s.label} className="rounded-[20px] border-stone-200 shadow-none">
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ background: s.soft }}
              >
                <s.icon className="w-4 h-4" style={{ color: s.accent }} />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                  {s.label}
                </p>
                <p className="mt-1 text-xl font-semibold text-stone-900">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden rounded-[22px] border-stone-200 shadow-none">
        <CardHeader className="border-b border-stone-100 bg-white p-4">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search scholar, student ID, batch, program, or course"
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

            {error && (
              <div className="rounded-lg px-4 py-3 text-sm border border-red-200 bg-red-50 text-red-700">
                {error}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader className="bg-stone-50/80">
              <TableRow className="border-stone-100 hover:bg-transparent">
                <TableHead className="text-xs font-medium text-stone-500 py-3 px-5">Scholar</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3">Student ID</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3">Course</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3 w-[160px]">Disciplinary Standing</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3 text-right pr-5">Action</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {pageData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-sm text-stone-400">
                    No scholars match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                pageData.map((scholar) => {
                  return (
                    <TableRow
                      key={scholar.scholar_id}
                      className="border-stone-100 hover:bg-amber-50/20 transition-colors"
                    >
                      <TableCell className="py-3.5 px-5 align-top">
                        <div className="flex min-w-0 items-center gap-3">
                          <PreviewableProfileAvatar
                            src={scholar.avatar_url || scholar.profile_photo_url || scholar.avatarUrl || ''}
                            name={`${scholar.student_name || 'Scholar'} profile photo`}
                            fallback={getInitials(scholar.student_name)}
                            avatarClassName="h-9 w-9 shrink-0 border border-stone-200"
                            imageClassName="object-cover"
                            fallbackClassName="bg-orange-50 text-xs font-bold text-[#5c2d0e]"
                          />
                          <p className="min-w-0 font-medium text-sm text-stone-800">
                            {scholar.student_name || 'Unknown Scholar'}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5 align-top text-sm text-stone-600">
                        {scholar.student_number || '—'}
                      </TableCell>

                      <TableCell className="py-3.5 align-top text-sm text-stone-600">
                        {scholar.course_code || scholar.course_name || '—'}
                      </TableCell>

                      <TableCell className="py-3.5 align-top">
                        <Select
                          value={getEditableStatus(scholar.sdu_level)}
                          onValueChange={(value) => requestStandingUpdate(scholar, value)}
                        >
                          <SelectTrigger className="h-9 rounded-lg border-stone-200 bg-white text-sm w-[120px]">
                            <SelectValue>{normalizeStatus(getEditableStatus(scholar.sdu_level))}</SelectValue>
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
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          </div>
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
