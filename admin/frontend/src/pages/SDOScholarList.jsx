import { useListPage } from '../hooks/useListPage';
import StudentRecordsPagination from '@/components/StudentRecordsPagination';
// SMaRT-PDM: Scholars — SDOScholar List (admin frontend page); loads data, handles page actions, and renders the admin view.
import React, { useCallback, useEffect, useState } from 'react';


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
  ShieldAlert,
} from 'lucide-react';

import { buildApiUrl } from '@/api';
import { toast } from 'sonner';
import { useSocketEvent } from '@/hooks/useSocket';
import usePortalTheme from '@/hooks/usePortalTheme';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';
import PreviewableProfileAvatar from '@/components/profile/PreviewableProfileAvatar';
import ScholarViewModal from '@/components/profile/SDOScholarProfile';
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
  none: { label: 'No Offense', color: C.green, bg: C.greenSoft },
  minor: { label: 'Minor Offense', color: C.amber, bg: C.amberSoft },
  major: { label: 'Major Offense', color: C.red, bg: C.redSoft },
};

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'clear', label: 'No Offense' },
  { value: 'minor', label: 'Minor Offense' },
  { value: 'major', label: 'Major Offense' },
];

const STATUS_OPTIONS = [
  { value: 'clear', label: 'No Offense' },
  { value: 'minor', label: 'Minor Offense' },
  { value: 'major', label: 'Major Offense' },
];

// getToken: reads and returns get token for the Scholars flow.
function getToken() {
  return sessionStorage.getItem('sdoToken');
}

// getInitials: reads and returns get initials for the Scholars flow.
function getInitials(name = '') {
  return (name || 'NA')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// getEditableStatus: reads and returns get editable status for the Scholars flow.
function getEditableStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (normalized === 'minor' || normalized === 'minor offense') return 'minor';
  if (normalized === 'major' || normalized === 'major offense') return 'major';
  return 'clear';
}

// getSdoStyle: reads and returns get sdo style for the Scholars flow.
function getSdoStyle(status) {
  return SDO_STYLE[status || 'none'] || SDO_STYLE.none;
}

// DisciplinaryStandingConfirmModal: handles disciplinary standing confirm modal for the Scholars flow.
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
export function SDOScholarSummary({ stats }) {
  const cards = [
    { label: 'Total Scholars', value: stats.total, icon: Users, accent: C.brown, soft: C.amberSoft },
    { label: 'No Offense', value: stats.clear, icon: CheckCircle2, accent: C.green, soft: C.greenSoft },
    { label: 'Minor Offense', value: stats.minor, icon: Clock, accent: C.amber, soft: C.amberSoft },
    { label: 'Major Offense', value: stats.major, icon: AlertTriangle, accent: C.red, soft: C.redSoft },
  ];
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    {cards.map(card => <Card key={card.label} className="rounded-[20px] border-stone-200 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: card.soft }}>
          <card.icon className="w-4 h-4" style={{ color: card.accent }} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-500">{card.label}</p>
          <p className="mt-1 text-xl font-semibold text-stone-900">{card.value}</p>
        </div>
      </CardContent>
    </Card>)}
  </div>;
}

export default function SDOScholarList({ embedded = false, searchValue = '', filtersOpen = true, onSummaryChange }) {
  const { theme } = usePortalTheme('sdo');
  const [scholars, setScholars] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    clear: 0,
    minor: 0,
    major: 0,
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => { onSummaryChange?.(stats); }, [stats, onSummaryChange]);
  const [error, setError] = useState('');

  const [localSearch, setSearch] = useState('');
  const search = embedded ? searchValue : localSearch;
  const [program, setProgram] = useState('All Programs');
  const [batchYear, setBatchYear] = useState('All Years');
  const [probationFilter, setProbationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('Name A-Z');

  const [savingId, setSavingId] = useState(null);
  const [viewScholar, setViewScholar] = useState(null);
  const [pendingStanding, setPendingStanding] = useState(null);
  const [confirmationRemarks, setConfirmationRemarks] = useState('');

  const { page, setPage, query: listQuery, metadata: listMetadata, accept: acceptList, beginRequest } = useListPage({
    search, program, academicYear: batchYear, probation: probationFilter, sort: sortBy, view: 'sdo',
  }, PAGE_SIZE);

  // loadScholars: loads and returns load scholars for the Scholars flow.
  const loadScholars = useCallback(async ({ soft = false } = {}) => {
    const isCurrent = beginRequest();
    if (!isCurrent()) return;
    try {
      if (!soft) {
        setLoading(true);
        setError('');
      }

      const response = await fetch(`${API_BASE}/scholars?${listQuery}`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load scholar list');
      }

      if (!isCurrent()) return;
      acceptList(data);
      setScholars(data.items || []);
      setStats(data.summary || { total: 0, clear: 0, minor: 0, major: 0 });
    } catch (err) {
      if (!isCurrent()) return;
      setError(err.message || 'Failed to load scholar list.');
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [listQuery, acceptList, beginRequest]);

  useEffect(() => { loadScholars({ soft: true }); }, [loadScholars]);
  useSocketEvent('scholar:updated', () => loadScholars({ soft: true }), [loadScholars]);
  useSocketEvent('scholar:created', () => loadScholars({ soft: true }), [loadScholars]);
  useSocketEvent('renewal:approved', () => loadScholars({ soft: true }), [loadScholars]);
  const programOptions = ['All Programs', ...(listMetadata.filters?.programs || [])];
  const batchOptions = ['All Years', ...(listMetadata.filters?.years || [])];

  const sortOptions = [
    'Name A-Z',
    'Name Z-A',
    'Batch Newest',
    'Batch Oldest',
    'Program A-Z',
    'Program Z-A',
  ];

  const totalPages = listMetadata.pagination?.totalPages || 1;
  const total = listMetadata.pagination?.total || 0;
  const pageData = scholars;

  // requestStandingUpdate: handles request standing update for the Scholars flow.
  const requestStandingUpdate = (scholar, status) => {
    if (status === getEditableStatus(scholar.sdu_level)) return;
    setError('');
    setPendingStanding({ scholar, status });
    setConfirmationRemarks(scholar.sdo_comment || '');
  };

  // closeStandingConfirmation: handles close standing confirmation for the Scholars flow.
  const closeStandingConfirmation = () => {
    setPendingStanding(null);
    setConfirmationRemarks('');
    setError('');
  };

  // handleSave: handles handle save for the Scholars flow.
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
    <div className="min-w-0 max-w-full space-y-5 py-2">
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

      {!embedded && <SDOScholarSummary stats={stats} />}

      <Card className="overflow-hidden rounded-[22px] border-stone-200 shadow-none">
        {(!embedded || filtersOpen || error) && <CardHeader id="scholars-filters" className="border-b border-stone-100 bg-white p-4">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row">
              {!embedded && <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search scholar, student ID, batch, program, or course"
                  className="h-10 rounded-lg border-stone-200 pl-9 text-sm bg-white"
                />
              </div>}

              <div style={embedded && !filtersOpen ? { display: 'none' } : undefined} className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Select value={program} onValueChange={setProgram}>
                  <SelectTrigger className="h-10 w-full min-w-0 rounded-lg border-stone-200 bg-white text-sm">
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
                  <SelectTrigger className="h-10 w-full min-w-0 rounded-lg border-stone-200 bg-white text-sm">
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
                  <SelectTrigger className="h-10 w-full min-w-0 rounded-lg border-stone-200 bg-white text-sm">
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
                  <SelectTrigger className="h-10 w-full min-w-0 rounded-lg border-stone-200 bg-white text-sm">
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
        </CardHeader>}

        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader className="bg-stone-50/80">
              <TableRow className="border-stone-100 hover:bg-transparent">
                <TableHead className="text-xs font-medium text-stone-500 py-3 px-5">Scholar</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3">Student ID</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3">Course</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3">Year Level</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3 w-[180px]">Disciplinary Standing</TableHead>
                <TableHead className="text-xs font-medium text-stone-500 py-3 text-right pr-5">Action</TableHead>
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

                      <TableCell className="py-3.5 align-top text-sm text-stone-600">
                        {scholar.year_level || '—'}
                      </TableCell>

                      <TableCell className="py-3.5 align-top">
                        <Select
                          value={getEditableStatus(scholar.sdu_level)}
                          onValueChange={(value) => requestStandingUpdate(scholar, value)}
                        >
                          <SelectTrigger className="h-9 w-[160px] rounded-lg border-stone-200 bg-white text-sm">
                            <SelectValue />
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
          {(page - 1) * PAGE_SIZE + pageData.length} of {total} scholars
        </p>

        <StudentRecordsPagination page={page} totalPages={totalPages} onPageChange={setPage} />
      </div>
    </div>
  );
}
