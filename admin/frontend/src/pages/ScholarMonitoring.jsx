import { useListPage } from '../hooks/useListPage';
// SMaRT-PDM: Scholars — Scholar Monitoring (admin frontend page); loads data, handles page actions, and renders the admin view.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useSocketEvent } from '@/hooks/useSocket';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';
import ProfilePhotoPreviewDialog from '@/components/profile/ProfilePhotoPreviewDialog';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import ScholarIdentity from '@/components/profile/ScholarIdentity';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
  SlidersHorizontal,
  X,
  Mail,
  Phone,
  CalendarDays,
  ShieldAlert,
  ShieldCheck,
  FileCheck2,
  History,
  Clock3,
  CheckCircle2,
  BookOpen,
  MapPin,
} from 'lucide-react';

import { buildApiUrl } from '@/api';

const C = {
  brown: 'var(--portal-base)',
  brownMid: 'var(--portal-base)',
  amber: '#d97706',
  amberSoft: '#fff7ed',
  green: '#16a34a',
  greenSoft: '#f0fdf4',
  red: '#dc2626',
  redSoft: '#fef2f2',
  blue: '#2563eb',
  blueSoft: '#eff6ff',
  purple: '#7c3aed',
  purpleSoft: '#f5f3ff',
  text: '#1c1917',
  bg: '#faf7f2',
  muted: '#78716c',
};

const PAGE_SIZE = 10;

const REMOVAL_REASONS = [
  'Failed GWA Requirement',
  'SDO/Disciplinary Case',
  'Failed RO Compliance',
  'Voluntary Withdrawal',
  'Transferred Out',
  'Graduated',
  'Duplicate / Invalid Record',
  'Other',
];

// getAuthHeaders: reads and returns get auth headers for the Scholars flow.
function getAuthHeaders() {
  const token = sessionStorage.getItem('adminToken');

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };
}

// normalizeText: normalizes normalize text for the Scholars flow.
function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

// normalizeRenewalStatus: normalizes normalize renewal status for the Scholars flow.
function normalizeRenewalStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

// getInitials: reads and returns get initials for the Scholars flow.
function getInitials(name = '') {
  return (name || 'NA')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// formatDate: formats format date for the Scholars flow.
function formatDate(value, fallback = 'Not available') {
  if (!value) return fallback;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// formatDateTime: formats format date time for the Scholars flow.
function formatDateTime(value, fallback = 'N/A') {
  if (!value) return fallback;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);

  return parsed.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// formatMinutes: formats format minutes for the Scholars flow.
function formatMinutes(value) {
  const minutes = Math.max(0, Number(value || 0));
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours <= 0) return `${mins}m`;
  if (mins <= 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// clampPercent: handles clamp percent for the Scholars flow.
function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(Number(value || 0))));
}

// getScholarshipStatusMeta: reads and returns get scholarship status meta for the Scholars flow.
function getScholarshipStatusMeta(value) {
  const normalized = normalizeText(value);

  if (normalized === 'active') {
    return {
      label: 'Active Scholar',
      shortLabel: 'Active',
      color: C.green,
      bg: C.greenSoft,
      border: '#bbf7d0',
    };
  }

  if (normalized === 'on hold') {
    return {
      label: 'Scholarship On Hold',
      shortLabel: 'On Hold',
      color: C.amber,
      bg: C.amberSoft,
      border: '#fed7aa',
    };
  }

  if (normalized === 'removed') {
    return {
      label: 'Scholar Privilege Removed',
      shortLabel: 'Removed',
      color: C.red,
      bg: C.redSoft,
      border: '#fecaca',
    };
  }

  if (normalized === 'inactive') {
    return {
      label: 'Inactive Scholar',
      shortLabel: 'Inactive',
      color: C.muted,
      bg: '#f5f5f4',
      border: '#e7e5e4',
    };
  }

  return {
    label: value || 'Unknown Status',
    shortLabel: value || 'Unknown',
    color: C.muted,
    bg: '#f5f5f4',
    border: '#e7e5e4',
  };
}

// getRoHistoryStatusMeta: reads and returns get ro history status meta for the Scholars flow.
function getRoHistoryStatusMeta(item = {}) {
  const assignment = normalizeText(
    item.assignment_status || item.assignmentStatus
  );
  const progress = normalizeText(
    item.progress_status || item.progressStatus
  );
  const roStatus = normalizeText(item.ro_status || item.roStatus);

  if (
    item.is_cleared === true ||
    item.isCleared === true ||
    assignment === 'cleared' ||
    roStatus === 'cleared'
  ) {
    return {
      label: 'Cleared',
      color: C.green,
      bg: C.greenSoft,
      border: '#bbf7d0',
    };
  }

  if (assignment === 'conflict reported') {
    return {
      label: 'Conflict',
      color: C.red,
      bg: C.redSoft,
      border: '#fecaca',
    };
  }

  if (assignment === 'for validation' || progress === 'for validation') {
    return {
      label: 'For Validation',
      color: C.blue,
      bg: C.blueSoft,
      border: '#bfdbfe',
    };
  }

  if (assignment === 'in progress' || progress === 'in progress') {
    return {
      label: 'In Progress',
      color: C.purple,
      bg: C.purpleSoft,
      border: '#ddd6fe',
    };
  }

  if (
    assignment === 'pending coordinator approval' ||
    assignment === 'assigned' ||
    assignment === 'acknowledged'
  ) {
    return {
      label: 'Assigned',
      color: C.amber,
      bg: C.amberSoft,
      border: '#fed7aa',
    };
  }

  return {
    label: 'Unassigned',
    color: C.muted,
    bg: '#f5f5f4',
    border: '#e7e5e4',
  };
}

// getRenewalStatusMeta: reads and returns get renewal status meta for the Scholars flow.
function getRenewalStatusMeta(raw) {
  const key = normalizeRenewalStatus(raw);

  const styles = {
    pending_submission: { label: 'Pending', color: C.muted, bg: '#f5f5f4' },
    submitted: { label: 'Submitted', color: C.blue, bg: C.blueSoft },
    under_review: { label: 'Under Review', color: C.amber, bg: C.amberSoft },
    approved: { label: 'Approved', color: C.green, bg: C.greenSoft },
    needs_reupload: { label: 'Needs Re-upload', color: C.red, bg: C.redSoft },
    rejected: { label: 'Rejected', color: C.red, bg: C.redSoft },
    flagged: { label: 'Flagged', color: C.red, bg: C.redSoft },
    failed: { label: 'Failed', color: C.red, bg: C.redSoft },
  };

  return (
    styles[key] || {
      label: String(raw || 'Pending'),
      color: C.muted,
      bg: '#f5f5f4',
    }
  );
}

// getRenewalDocumentStatusMeta: reads and returns get renewal document status meta for the Scholars flow.
function getRenewalDocumentStatusMeta(raw) {
  const value = normalizeText(raw);

  if (value.includes('verified')) {
    return { color: C.green, bg: C.greenSoft };
  }

  if (
    value.includes('rejected') ||
    value.includes('reupload') ||
    value.includes('missing')
  ) {
    return { color: C.red, bg: C.redSoft };
  }

  if (
    value.includes('uploaded') ||
    value.includes('review') ||
    value.includes('flagged')
  ) {
    return { color: C.amber, bg: C.amberSoft };
  }

  return { color: C.muted, bg: '#f5f5f4' };
}

// StatusPill: handles status pill for the Scholars flow.
function StatusPill({ meta, compact = false }) {
  return (
    <span
      className={`inline-flex max-w-full items-center justify-center whitespace-normal break-words text-center leading-4 rounded-full font-semibold ${compact ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
        }`}
      style={{
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border || meta.bg}`,
      }}
    >
      {compact && meta.shortLabel ? meta.shortLabel : meta.label}
    </span>
  );
}

// InfoItem: handles info item for the Scholars flow.
function InfoItem({ icon: Icon, label, value, wide = false }) {
  return (
    <div
      className={`rounded-xl border border-stone-200 bg-white px-3.5 py-3 ${wide ? 'md:col-span-2' : ''
        }`}
    >
      <div className="mb-1.5 flex items-center gap-2 text-stone-400">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="break-words text-sm font-medium leading-5 text-stone-800">
        {value || 'Not available'}
      </p>
    </div>
  );
}

// MetricCard: handles metric card for the Scholars flow.
function MetricCard({ label, value, helper, meta, icon: Icon }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">
            {label}
          </p>
          <p
            className="mt-1.5 text-sm font-black text-stone-800"
            style={meta ? { color: meta.color } : undefined}
          >
            {value}
          </p>
        </div>

        {Icon ? (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{
              color: meta?.color || C.brownMid,
              background: meta?.bg || '#f5f5f4',
            }}
          >
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>

      {helper ? (
        <p className="mt-2 text-[10px] leading-4 text-stone-400">{helper}</p>
      ) : null}
    </div>
  );
}

// FilterModal: handles filter modal for the Scholars flow.
function FilterModal({
  open,
  onClose,
  programOptions,
  yearOptions,
  semesterOptions,
  statusOptions,
  sortOptions,
  draftProgram,
  setDraftProgram,
  draftYear,
  setDraftYear,
  draftSemester,
  setDraftSemester,
  draftStatus,
  setDraftStatus,
  draftSortBy,
  setDraftSortBy,
  onApply,
  onClear,
  sectionMode,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md overflow-hidden border-stone-200 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-stone-800">
              Filter Records
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Refine {sectionMode === 'renewals' ? 'renewal' : sectionMode === 'removed' ? 'removed scholar' : 'scholar'} records
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Program
            </label>
            <Select value={draftProgram} onValueChange={setDraftProgram}>
              <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {programOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Academic Year
            </label>
            <Select value={draftYear} onValueChange={setDraftYear}>
              <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {yearOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {sectionMode !== 'renewals' ? (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                Semester
              </label>
              <Select value={draftSemester} onValueChange={setDraftSemester}>
                <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[100]">
                  {semesterOptions.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Status
            </label>
            <Select value={draftStatus} onValueChange={setDraftStatus}>
              <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {statusOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Sort By
            </label>
            <Select value={draftSortBy} onValueChange={setDraftSortBy}>
              <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {sortOptions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClear}
              className="h-9 rounded-lg border-stone-200 text-xs"
            >
              Clear
            </Button>
            <Button
              type="button"
              onClick={onApply}
              className="h-9 rounded-lg border-none text-xs text-white"
              style={{ background: C.brownMid }}
            >
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ProgramHistoryPanel: handles program history panel for the Scholars flow.
function ProgramHistoryPanel({
  history = [],
  currentApplicationId = null,
  currentPeriodId = null,
}) {
  const rows = Array.isArray(history) ? history : [];
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="overflow-hidden rounded-2xl border-stone-200 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-14 w-full flex-wrap items-center gap-3 bg-stone-50/70 px-4 py-3.5 text-left transition hover:bg-stone-100/80"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-stone-800 sm:text-base">
              Scholarship Program History
            </h4>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Scholarship records by academic period
            </p>
          </div>
        </div>

        <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-500 shadow-sm">
          {rows.length} record{rows.length === 1 ? '' : 's'}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded ? <CardContent className="border-t border-stone-100 p-3 sm:p-4">
        {rows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-center">
            <BookOpen className="mx-auto mb-2 h-5 w-5 text-stone-300" />
            <p className="text-sm font-medium text-stone-500">
              No scholarship application history has been recorded yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((item) => {
              const isCurrent =
                String(item.application_id || '') ===
                  String(currentApplicationId || '') ||
                (
                  currentPeriodId &&
                  String(item.period_id || '') === String(currentPeriodId)
                );

              const period = [
                item.semester,
                item.academic_year ? `AY ${item.academic_year}` : '',
              ].filter(Boolean).join(' · ');

              const status = item.history_status || item.application_status || 'Applied';
              const tone = getProfileStatusTone(status);

              return (
                <div
                  key={item.application_id}
                  className="min-w-0 rounded-xl border border-stone-200 bg-white px-3.5 py-3 transition"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-stone-800">
                          {item.program_name || 'Scholarship Program'}
                        </p>

                        {isCurrent ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Current
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-xs leading-5 text-stone-500">
                        {period || 'Academic period not recorded'}
                      </p>

                      {item.opening_title ? (
                        <p className="mt-0.5 text-[11px] text-stone-400">
                          {item.opening_title}
                        </p>
                      ) : null}

                      {item.activated_at ? (
                        <p className="mt-1 text-[11px] font-medium text-blue-700">
                          Activated {formatDate(item.activated_at, '—')}
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0 text-left sm:text-right">
                      <span className={`inline-flex max-w-full items-center gap-1.5 break-words rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                        {status}
                      </span>

                      <p className="mt-1.5 text-[11px] text-stone-400">
                        Applied {formatDate(item.applied_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent> : null}
    </Card>
  );
}

// SMART_PDM_SCHOLAR_PROFILE_PROGRAM_HISTORY_V1

function ObligationHistoryPanel({ studentId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedRoId, setExpandedRoId] = useState(null);
  const [sectionExpanded, setSectionExpanded] = useState(false);

  useEffect(() => {
    if (!studentId) {
      setHistory([]);
      setError('');
      return;
    }

    let cancelled = false;

    // loadHistory: loads and returns load history for the Scholars flow.
    const loadHistory = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(
          buildApiUrl(`/api/ro/scholars/${studentId}/history`),
          {
            headers: getAuthHeaders(),
          }
        );

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload?.error ||
            payload?.message ||
            'Unable to load obligation history.'
          );
        }

        if (!cancelled) {
          setHistory(
            Array.isArray(payload?.history) ? payload.history : []
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Unable to load obligation history.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
    };
  }, [studentId]);

  return (
    <Card className="overflow-hidden rounded-2xl border-stone-200 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={sectionExpanded}
        onClick={() => setSectionExpanded((value) => !value)}
        className="flex min-h-14 w-full flex-wrap items-center gap-3 bg-stone-50/70 px-4 py-3.5 text-left transition hover:bg-stone-100/80"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
            <History className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-stone-800 sm:text-base">
              Obligation History
            </h4>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Semester-by-semester Return of Obligation record
            </p>
          </div>
        </div>

        {!loading && !error ? (
          <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-500 shadow-sm">
            {history.length} cycle{history.length === 1 ? '' : 's'}
          </span>
        ) : null}
        <ChevronDown className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ${sectionExpanded ? 'rotate-180' : ''}`} />
      </button>

      {sectionExpanded ? <CardContent className="border-t border-stone-100 p-3 sm:p-4">
        {loading ? (
          <div className="flex min-h-[120px] items-center justify-center gap-2 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading obligation history...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-6 text-center">
            <History className="mx-auto mb-2 h-5 w-5 text-stone-300" />
            <p className="text-sm font-medium text-stone-500">
              No obligation cycle has been recorded yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((item) => {
              const roId = item.ro_id || item.roId;
              const expanded = expandedRoId === roId;
              const meta = getRoHistoryStatusMeta(item);

              const requiredMinutes = Number(
                item.required_minutes ??
                item.requiredMinutes ??
                Number(item.required_hours || item.requiredHours || 0) * 60
              );

              const submittedMinutes = Number(
                item.submitted_minutes ?? item.submittedMinutes ?? 0
              );

              const validatedMinutes = Number(
                item.validated_minutes ?? item.validatedMinutes ?? 0
              );

              const progress = clampPercent(
                item.is_cleared === true || item.isCleared === true
                  ? 100
                  : item.validated_progress ??
                  item.validatedProgress ??
                  item.ro_progress ??
                  (requiredMinutes > 0
                    ? (validatedMinutes / requiredMinutes) * 100
                    : 0)
              );

              const logs = Array.isArray(item.logs) ? item.logs : [];
              const proofCount = Number(
                item.proof_count ??
                item.proofCount ??
                logs.reduce(
                  (sum, log) =>
                    sum +
                    (Array.isArray(log.proofs) ? log.proofs.length : 0),
                  0
                )
              );

              const cycle = [
                item.semester || 'Semester not set',
                item.academic_year || item.academicYear
                  ? `AY ${item.academic_year || item.academicYear}`
                  : '',
              ]
                .filter(Boolean)
                .join(' · ');

              const department =
                item.assigned_area ||
                item.assignedArea ||
                'No department assigned';

              return (
                <div
                  key={roId}
                  className="overflow-hidden rounded-xl border border-stone-200 bg-white"
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={`obligation-history-${roId}`}
                    onClick={() =>
                      setExpandedRoId(expanded ? null : roId)
                    }
                    className="flex w-full flex-wrap items-center gap-3 px-3.5 py-3 text-left transition hover:bg-stone-50 sm:flex-nowrap"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ color: meta.color, background: meta.bg }}
                    >
                      {meta.label === 'Cleared' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Clock3 className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-stone-800">
                          {cycle}
                        </p>

                        {item.is_current_period === true ||
                          item.isCurrentPeriod === true ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                            Current
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 truncate text-xs text-stone-500">
                        {department}
                      </p>
                    </div>

                    <div className="order-4 ml-12 flex w-[calc(100%-3rem)] shrink-0 items-center justify-between gap-2 text-left sm:order-none sm:ml-0 sm:block sm:w-auto sm:text-right">
                      <StatusPill meta={meta} compact />
                      <p className="mt-1.5 text-xs font-medium text-stone-500">
                        {progress}% · {formatMinutes(validatedMinutes)} /{' '}
                        {formatMinutes(requiredMinutes)}
                      </p>
                    </div>

                    {expanded ? (
                      <ChevronUp className="h-4 w-4 shrink-0 text-stone-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-stone-400" />
                    )}
                  </button>

                  {expanded ? (
                    <div id={`obligation-history-${roId}`} className="border-t border-stone-100 bg-stone-50/60 p-3.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <HistoryMetric
                          label="Required"
                          value={formatMinutes(requiredMinutes)}
                        />
                        <HistoryMetric
                          label="Submitted"
                          value={formatMinutes(submittedMinutes)}
                        />
                        <HistoryMetric
                          label="Validated"
                          value={formatMinutes(validatedMinutes)}
                        />
                        <HistoryMetric
                          label="Progress"
                          value={`${progress}%`}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                        <HistoryMetric
                          label="Attendance Logs"
                          value={String(logs.length)}
                        />
                        <HistoryMetric
                          label="Proof Images"
                          value={String(proofCount)}
                        />
                        <HistoryMetric
                          label="Cleared"
                          value={
                            item.cleared_at || item.clearedAt
                              ? formatDate(item.cleared_at || item.clearedAt)
                              : 'Not yet'
                          }
                        />
                      </div>

                      {logs.length > 0 ? (
                        <div className="mt-4">
                          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-500">
                            Recent Attendance
                          </p>

                          <div className="space-y-2">
                            {logs.slice(0, 5).map((log, index) => {
                              const logId = log.log_id || log.logId || index;
                              const logStatus =
                                log.validation_status ||
                                log.validationStatus ||
                                log.department_validation_status ||
                                log.departmentValidationStatus ||
                                'Pending';

                              return (
                                <div
                                  key={logId}
                                  className="flex flex-col gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div>
                                    <p className="text-sm font-medium text-stone-700">
                                      {formatDateTime(
                                        log.time_in_at || log.timeInAt
                                      )}
                                    </p>
                                    <p className="mt-0.5 text-xs leading-5 text-stone-500">
                                      Time out:{' '}
                                      {formatDateTime(
                                        log.time_out_at || log.timeOutAt,
                                        'Still timed in'
                                      )}
                                    </p>
                                  </div>

                                  <div className="text-left sm:text-right">
                                    <p className="text-xs font-medium text-stone-600">
                                      {formatMinutes(
                                        log.validated_minutes ??
                                        log.validatedMinutes ??
                                        0
                                      )}{' '}
                                      validated
                                    </p>
                                    <p className="mt-0.5 text-xs text-stone-500">
                                      {logStatus}
                                      {log.auto_timed_out === true ||
                                        log.autoTimedOut === true
                                        ? ' · Auto timed out'
                                        : ''}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </CardContent> : null}
    </Card>
  );
}

// HistoryMetric: handles history metric for the Scholars flow.
function HistoryMetric({ label, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-stone-200 bg-white px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-medium leading-5 text-stone-800">{value}</p>
    </div>
  );
}

// ScholarProfileModal: handles scholar profile modal for the Scholars flow.
function ScholarProfileModal({ scholar, loading, onClose }) {
  const s = useMemo(() => scholar || {}, [scholar]);
  const scholarshipMeta = getScholarshipStatusMeta(s.status);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const profileScrollRef = useRef(null);

  useEffect(() => {
    const scrollArea = profileScrollRef.current;
    if (!scrollArea) return;

    // measure: handles measure for the Scholars flow.
    const measure = () => {
      scrollArea.style.setProperty('--profile-scroll-height', `${scrollArea.clientHeight}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(scrollArea);
    measure();
    return () => {
      observer.disconnect();
    };
  }, [loading, scholar]);

  const gwaNumber = Number(s.gwa);
  const hasGwa =
    Number.isFinite(gwaNumber) &&
    s.gwa !== null &&
    s.gwa !== '';

  const isAtRisk = hasGwa && gwaNumber >= 2.0;

  const standingMeta = !hasGwa
    ? null
    : isAtRisk
      ? {
      label: 'At Risk',
      color: C.red,
      bg: C.redSoft,
      border: '#fecaca',
      }
      : {
      label: 'Good Standing',
      color: C.green,
      bg: C.greenSoft,
      border: '#bbf7d0',
    };

  const currentPeriod = formatAcademicPeriod(s.semester, s.academic_year);
  const yearSection = [formatYearLevel(s.year_level), cleanDisplayValue(s.section, '')]
    .filter(Boolean)
    .join(' · ');
  const courseSummary = [cleanDisplayValue(s.course_code, ''), yearSection]
    .filter(Boolean)
    .join(' · ');
  const isSdoClear = normalizeText(s.sdo_status || 'Clear') === 'clear';
  const programHistory = Array.isArray(s.program_history) ? s.program_history : [];
  const oldestProgramRecord = programHistory.length ? programHistory[programHistory.length - 1] : null;
  const scholarshipSince = oldestProgramRecord
    ? formatAcademicPeriod(oldestProgramRecord.semester, oldestProgramRecord.academic_year)
    : '—';

  const statusEvents = useMemo(() => {
    const events = [];
    const history = Array.isArray(s.program_history) ? s.program_history : [];
    const renewals = Array.isArray(s.renewal_history) ? s.renewal_history : [];

    history.forEach((item) => {
      if (!item.activated_at) return;
      events.push({
        id: `activation-${item.application_id}`,
        date: item.activated_at,
        title: 'Scholarship activated',
        detail: [item.program_name, formatAcademicPeriod(item.semester, item.academic_year, '')].filter(Boolean).join(' · '),
      });
    });

    renewals.forEach((item) => {
      const status = normalizeText(item.status);
      if (!['approved', 'rejected'].includes(status)) return;
      events.push({
        id: `renewal-${item.renewal_id}`,
        date: item.reviewed_at || item.event_at,
        title: status === 'approved' ? 'Renewal approved' : 'Renewal rejected',
        detail: formatAcademicPeriod(item.semester, item.academic_year, ''),
      });
    });

    if (s.scholar_is_archived && s.scholar_archived_at) {
      events.push({
        id: `removed-${s.scholar_id || s.student_id}`,
        date: s.scholar_archived_at,
        title: 'Scholar privilege removed',
        detail: cleanDisplayValue(s.scholar_removal_reason, ''),
      });
    }

    return events.sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0));
  }, [s]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    // handleKeyDown: handles handle key down for the Scholars flow.
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
      };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  if (!scholar && !loading) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="scholar-profile-title"
        aria-describedby="scholar-profile-description"
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-[86rem] flex-col overflow-hidden rounded-none border-stone-200 bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-stone-100 bg-white px-4 py-3 sm:items-center sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h3 id="scholar-profile-title" className="text-base font-semibold text-stone-900 sm:text-lg">
              Scholar Profile
            </h3>
            <p id="scholar-profile-description" className="mt-1 text-xs leading-5 text-stone-500 sm:text-sm">
              Scholar information, current standing and scholarship history
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 focus:outline-none focus:ring-2 focus:ring-stone-300"
            aria-label="Close scholar profile"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[22rem] flex-1 flex-col items-center justify-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-stone-300" />
            <p className="text-xs font-semibold text-stone-400">
              Loading scholar profile...
            </p>
          </div>
        ) : (
          <div ref={profileScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-stone-50/45 pb-[env(safe-area-inset-bottom)]">
            <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,0.4fr)_minmax(0,0.6fr)]">
            <section className="min-w-0 border-b border-stone-200 bg-white p-3 sm:p-5 lg:border-b-0 lg:border-r lg:p-5">
              <div className="min-w-0 space-y-4 lg:sticky lg:top-5 lg:max-h-[calc(var(--profile-scroll-height)-2.5rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
                {s.scholar_is_archived ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-amber-900">Scholarship privilege removed</p>
                        <p className="mt-1 text-xs leading-5 text-amber-800">
                          {[s.scholar_removal_reason || 'No reason recorded', s.scholar_archived_at ? `Removed ${formatDateTime(s.scholar_archived_at)}` : '', s.scholar_removed_by_name ? `By ${s.scholar_removed_by_name}` : ''].filter(Boolean).join(' · ')}
                        </p>
                        {s.scholar_removal_notes ? <p className="mt-1 text-xs leading-5 text-amber-800">{s.scholar_removal_notes}</p> : null}
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_10px_30px_rgba(28,25,23,0.08)]">
                  <div className="relative h-12 overflow-hidden bg-[var(--portal-base)]">
                    <div className="absolute -right-8 -top-14 h-32 w-32 rounded-full bg-white/10" aria-hidden="true" />
                    <div className="absolute right-16 top-5 h-16 w-16 rounded-full bg-amber-200/10" aria-hidden="true" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/10 via-transparent to-white/5" aria-hidden="true" />
                  </div>

                  <div className="px-4 pb-4">
                    <div className="-mt-7 flex items-end justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => s.avatar_url && setAvatarPreviewOpen(true)}
                        disabled={!s.avatar_url}
                        className="shrink-0 rounded-full bg-white p-1.5 shadow-sm transition enabled:hover:-translate-y-0.5 enabled:hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--portal-base)] focus-visible:ring-offset-2 disabled:cursor-default"
                        aria-label={s.avatar_url ? `Enlarge ${s.student_name || 'scholar'} profile photo` : 'No profile photo available'}
                      >
                        <Avatar
                          className={`h-14 w-14 rounded-full border border-stone-200 sm:h-16 sm:w-16 ${s.avatar_url ? 'cursor-zoom-in' : ''}`}
                          style={{ background: C.amberSoft, color: C.brown }}
                        >
                          <AvatarImage src={s.avatar_url || undefined} alt="" className="rounded-full object-cover" />
                          <AvatarFallback className="rounded-full bg-transparent text-base font-medium">
                            {getInitials(s.student_name)}
                          </AvatarFallback>
                        </Avatar>
                      </button>

                      <div className="mb-1 shrink-0 rounded-full bg-white p-0.5 shadow-sm">
                        <StatusPill meta={scholarshipMeta} compact />
                      </div>
                    </div>

                    <div className="mt-2 min-w-0">
                      <h4 className="truncate text-lg font-semibold leading-6 tracking-tight text-stone-900">
                        {s.student_name || 'Unknown Scholar'}
                      </h4>
                      <p className="mt-1 truncate text-sm font-medium leading-5 text-stone-500">
                        {s.student_number || 'N/A'}
                      </p>
                    </div>

                    <div className="mt-3 flex min-w-0 items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/80 px-3 py-2.5">
                      <div className="flex min-w-0 items-start gap-2">
                        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-stone-500 shadow-sm ring-1 ring-stone-200/70">
                          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold leading-4 text-stone-700" title={courseSummary || undefined}>
                            {courseSummary || 'Course information unavailable'}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] leading-4 text-stone-500" title={cleanDisplayValue(s.course_name)}>
                            {cleanDisplayValue(s.course_name)}
                          </p>
                        </div>
                      </div>

                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold leading-4 ${isSdoClear ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                        {isSdoClear ? <ShieldCheck className="h-3 w-3" aria-hidden="true" /> : <ShieldAlert className="h-3 w-3" aria-hidden="true" />}
                        SDO {humanizeStatus(s.sdo_status || 'Clear')}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3">
                    <h5 className="text-base font-semibold text-stone-800">
                      Scholar Details
                    </h5>
                    <p className="mt-1 text-sm text-stone-500">
                      Academic and scholarship information
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <ProfileField label="Course" value={s.course_code || s.course_name} />
                    <ProfileField label="Year / Section" value={yearSection} />
                    <ProfileField label="Academic Period" value={currentPeriod} />
                    <ProfileField label="Current GWA" value={hasGwa ? gwaNumber.toFixed(2) : '—'} />
                    <ProfileField label="Date Awarded" value={formatDate(s.date_awarded, '—')} />
                    <ProfileField label="Scholarship Since" value={scholarshipSince} />
                  </div>
                </div>

                <div>
                  <div className="mb-3">
                    <h5 className="text-base font-semibold text-stone-800">Contact Information</h5>
                    <p className="mt-1 text-sm text-stone-500">Current scholar contact details</p>
                  </div>
                  <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white p-3.5">
                    <ContactRow icon={Mail} label="Email" value={s.email} breakAnywhere />
                    <ContactRow icon={Phone} label="Mobile Number" value={s.phone_number} />
                    <ContactRow icon={MapPin} label="Address" value={s.address_summary} />
                  </div>
                </div>

              </div>
            </section>

            <section className="min-w-0 bg-stone-50/45 p-3 sm:p-5 lg:p-5">
              <div className="space-y-4">
                <CurrentScholarshipPanel scholar={s} standingMeta={standingMeta} />

                <ProgramHistoryPanel
                  history={s.program_history}
                  currentApplicationId={s.application_id}
                  currentPeriodId={s.period_id}
                />

                <ObligationHistoryPanel
                  studentId={s.student_id || s.scholar_id}
                />

                <PayoutHistoryPanel history={s.payout_history} />

                <RenewalHistoryPanel history={s.renewal_history} />

                <ScholarStatusHistoryPanel events={statusEvents} />
              </div>
            </section>
            </div>
          </div>
        )}
      </Card>

      <ProfilePhotoPreviewDialog
        open={avatarPreviewOpen && Boolean(s.avatar_url)}
        onOpenChange={setAvatarPreviewOpen}
        src={s.avatar_url || ''}
        name={s.student_name || 'Scholar'}
      />
    </div>
  );
}

// ArchiveScholarModal: archives archive scholar modal for the Scholars flow.
function ArchiveScholarModal({ scholar, onClose, onConfirm, saving }) {
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (scholar) {
      setReason('');
      setNotes('');
    }
  }, [scholar]);

  if (!scholar) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-lg overflow-hidden border-stone-200 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-stone-800">
              Remove Scholar Privilege
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">
              {scholar.student_name} · {scholar.student_number}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">
              Scholarship Slot Will Be Released
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-700">
              Removing, graduating, or withdrawing this scholar releases one
              occupied slot. The next eligible waiting applicant may be promoted. The student account remains in the Student Registry and this scholarship history moves to Removed Scholars.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Removal Reason
            </label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="h-10 rounded-lg border-stone-200 text-sm">
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent className="z-[100]">
                {REMOVAL_REASONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Notes
            </label>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional admin note..."
              className="min-h-[100px] resize-none rounded-lg border-stone-200 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="h-9 rounded-lg border-stone-200 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() =>
                onConfirm({
                  reason,
                  notes,
                })
              }
              disabled={!reason || saving}
              className="h-9 rounded-lg border-none text-xs text-white disabled:opacity-50"
              style={{ background: C.red }}
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm Removal
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ScholarMonitoring() {
  const navigate = useNavigate();
  const location = useLocation();

  const [scholars, setScholars] = useState([]);
  const [_stats, setStats] = useState({
    total: 0,
    active: 0,
    at_risk: 0,
    avg_gwa: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [renewals, setRenewals] = useState([]);
  const [renewalsLoading, setRenewalsLoading] = useState(true);
  const [renewalsError, setRenewalsError] = useState('');
  const [removedScholars, setRemovedScholars] = useState([]);
  const [removedLoading, setRemovedLoading] = useState(true);
  const [removedError, setRemovedError] = useState('');

  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [academicYear, setAcademicYear] = useState('All Years');
  const [semester, setSemester] = useState('All Semesters');
  const [status, setStatus] = useState('All Statuses');
  const [sortBy, setSortBy] = useState('Name A-Z');

  const [selectedScholarId, setSelectedScholarId] = useState(null);
  const [selectedScholar, setSelectedScholar] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [archiveModalScholar, setArchiveModalScholar] = useState(null);
  const [archiveSaving, setArchiveSaving] = useState(false);

  const [sectionMode, setSectionMode] = useState(() => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab === 'renewals') return 'renewals';
    if (tab === 'removed') return 'removed';
    return 'registry';
  });

  const [filterOpen, setFilterOpen] = useState(false);
  const [draftProgram, setDraftProgram] = useState('All Programs');
  const [draftYear, setDraftYear] = useState('All Years');
  const [draftSemester, setDraftSemester] = useState('All Semesters');
  const [draftStatus, setDraftStatus] = useState('All Statuses');
  const [draftSortBy, setDraftSortBy] = useState('Name A-Z');

  const { page, setPage, query: listQuery, metadata: listMetadata, accept: acceptList, beginRequest } = useListPage({
    search, program, academicYear, semester, status: sectionMode === 'renewals' ? normalizeRenewalStatus(status).replace(/_/g, ' ') : status,
    sort: sortBy, tab: sectionMode,
  }, PAGE_SIZE);

  const loadScholars = useCallback(async ({ quiet = false } = {}) => {
    if (sectionMode !== 'registry') return;
    const isCurrent = beginRequest();
    if (!isCurrent()) return;
    try {
      if (!quiet) setLoading(true);
      setError('');

      const [scholarsRes, statsRes] = await Promise.all([
        fetch(buildApiUrl(`/api/scholars?${listQuery}`), {
          headers: getAuthHeaders(),
        }),
        fetch(buildApiUrl('/api/scholars/stats'), {
          headers: getAuthHeaders(),
        }),
      ]);

      const scholarsPayload = await scholarsRes.json().catch(() => []);
      const statsPayload = await statsRes.json().catch(() => ({}));

      if (!scholarsRes.ok) {
        throw new Error(
          scholarsPayload?.error ||
          scholarsPayload?.message ||
          'Failed to load scholars'
        );
      }

      if (!statsRes.ok) {
        throw new Error(
          statsPayload?.error ||
          statsPayload?.message ||
          'Failed to load scholar statistics'
        );
      }

      if (!isCurrent()) return;
      acceptList(scholarsPayload);
      setScholars(scholarsPayload.items || []);

      setStats({
        total: Number(statsPayload.total) || 0,
        active: Number(statsPayload.active) || 0,
        at_risk: Number(statsPayload.at_risk) || 0,
        avg_gwa: Number(statsPayload.avg_gwa) || 0,
      });
    } catch (err) {
      if (!isCurrent()) return;
      console.error('SCHOLAR LOAD ERROR:', err);
      if (!quiet) {
        setError(err?.message || 'Failed to load scholar data');
      }
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [sectionMode, listQuery, acceptList, beginRequest]);

  const loadRenewals = useCallback(async ({ quiet = false } = {}) => {
    if (sectionMode !== 'renewals') return;
    const isCurrent = beginRequest();
    if (!isCurrent()) return;
    try {
      if (!quiet) setRenewalsLoading(true);
      setRenewalsError('');

      const response = await fetch(buildApiUrl(`/api/renewals?${listQuery}`), {
        headers: getAuthHeaders(),
      });

      const payload = await response.json().catch(() => []);

      if (!response.ok) {
        throw new Error(
          payload?.error ||
          payload?.message ||
          'Failed to load renewal records'
        );
      }

      if (!isCurrent()) return;
      acceptList(payload);
      setRenewals(payload.items || []);
    } catch (err) {
      if (!isCurrent()) return;
      console.error('RENEWALS LOAD ERROR:', err);
      setRenewalsError(
        err?.message || 'Failed to load renewal records'
      );
    } finally {
      if (isCurrent()) setRenewalsLoading(false);
    }
  }, [sectionMode, listQuery, acceptList, beginRequest]);

  const loadRemovedScholars = useCallback(async ({ quiet = false } = {}) => {
    if (sectionMode !== 'removed') return;
    const isCurrent = beginRequest();
    if (!isCurrent()) return;
    try {
      if (!quiet) setRemovedLoading(true);
      setRemovedError('');
      const response = await fetch(buildApiUrl(`/api/scholars/removed?${listQuery}`), {
        headers: getAuthHeaders(),
      });
      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to load removed scholars');
      }
      if (!isCurrent()) return;
      acceptList(payload);
      setRemovedScholars(payload.items || []);
    } catch (err) {
      if (!isCurrent()) return;
      console.error('REMOVED SCHOLARS LOAD ERROR:', err);
      setRemovedError(err?.message || 'Failed to load removed scholars');
    } finally {
      if (isCurrent()) setRemovedLoading(false);
    }
  }, [sectionMode, listQuery, acceptList, beginRequest]);

  useEffect(() => {
    if (sectionMode === 'registry') loadScholars();
    else if (sectionMode === 'renewals') loadRenewals();
    else if (sectionMode === 'removed') loadRemovedScholars();
  }, [sectionMode, loadScholars, loadRenewals, loadRemovedScholars]);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab === 'renewals') setSectionMode('renewals');
    else if (tab === 'removed') setSectionMode('removed');
    else setSectionMode('registry');
  }, [location.search]);

  useSocketEvent(
    'renewal:updated',
    () => { if (sectionMode === 'renewals') loadRenewals({ quiet: true }); },
    [loadRenewals]
  );

  useSocketEvent(
    'renewal:approved',
    () => { if (sectionMode === 'renewals') loadRenewals({ quiet: true }); },
    [loadRenewals]
  );

  useSocketEvent(
    'scholar:updated',
    () => { if (sectionMode === 'registry') loadScholars({ quiet: true }); },
    [loadScholars]
  );

  useSocketEvent(
    'scholar:created',
    () => { if (sectionMode === 'registry') loadScholars({ quiet: true }); },
    [loadScholars]
  );

  useSocketEvent(
    'scholar:archived',
    () => {
      if (sectionMode === 'registry') loadScholars({ quiet: true });
      if (sectionMode === 'removed') loadRemovedScholars({ quiet: true });
    },
    [loadScholars, loadRemovedScholars]
  );

  useSocketEvent(
    'scholar:restored',
    () => {
      if (sectionMode === 'registry') loadScholars({ quiet: true });
      if (sectionMode === 'removed') loadRemovedScholars({ quiet: true });
    },
    [loadScholars, loadRemovedScholars]
  );

  const handleViewScholar = useCallback(async (scholarId) => {
    try {
      setSelectedScholarId(scholarId);
      setSelectedScholar(null);
      setProfileLoading(true);

      const response = await fetch(
        buildApiUrl(`/api/scholars/${scholarId}${sectionMode === 'removed' ? '?includeRemoved=true' : ''}`),
        {
          headers: getAuthHeaders(),
        }
      );

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.error ||
          payload?.message ||
          'Failed to fetch scholar profile'
        );
      }

      setSelectedScholar(payload);
    } catch (err) {
      console.error('SCHOLAR PROFILE FETCH ERROR:', err);
      window.alert(
        err?.message || 'Failed to fetch scholar profile'
      );
      setSelectedScholarId(null);
    } finally {
      setProfileLoading(false);
    }
  }, [sectionMode]);

  useEffect(() => {
    const requestedStudentId =
      new URLSearchParams(location.search).get('student');

    if (!requestedStudentId) return;

    void handleViewScholar(requestedStudentId);
  }, [handleViewScholar, location.search]);

  // handleArchiveScholar: handles handle archive scholar for the Scholars flow.
  const handleArchiveScholar = async (payload) => {
    if (!archiveModalScholar) return;

    try {
      setArchiveSaving(true);

      const response = await fetch(
        buildApiUrl(
          `/api/scholars/${archiveModalScholar.scholar_id}/archive`
        ),
        {
          method: 'PATCH',
          headers: getAuthHeaders(),
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data?.error ||
          data?.message ||
          'Failed to archive scholar'
        );
      }

      setArchiveModalScholar(null);

      if (selectedScholarId === archiveModalScholar.scholar_id) {
        setSelectedScholarId(null);
        setSelectedScholar(null);
      }

      await Promise.all([
        loadScholars({ quiet: true }),
        loadRemovedScholars({ quiet: true }),
      ]);

      toast.success('Scholarship privilege removed', {
        description:
          data?.message ||
          (data?.data?.promotion?.promoted
            ? `Scholar removed. ${data.data.promotion.applicant_name ||
            'The next waiting applicant'
            } was promoted automatically.`
            : 'Scholar removed and the scholarship slot was released.'),
      });
    } catch (err) {
      console.error('ARCHIVE SCHOLAR ERROR:', err);
      window.alert(
        err?.message || 'Failed to archive scholar'
      );
    } finally {
      setArchiveSaving(false);
    }
  };

  // handleSectionModeChange: handles handle section mode change for the Scholars flow.
  const handleSectionModeChange = (nextMode) => {
    const mode = ['registry', 'renewals', 'removed'].includes(nextMode)
      ? nextMode
      : 'registry';

    setSectionMode(mode);
    setSearch('');
    setProgram('All Programs');
    setAcademicYear('All Years');
    setSemester('All Semesters');
    setStatus('All Statuses');
    setSortBy('Name A-Z');
    setPage(1);

    const params = new URLSearchParams(location.search);

    if (mode === 'renewals') {
      params.set('tab', 'renewals');
    } else if (mode === 'removed') {
      params.set('tab', 'removed');
    } else {
      params.delete('tab');
    }

    const query = params.toString();

    navigate(
      {
        pathname: '/admin/scholars',
        search: query ? `?${query}` : '',
      },
      { replace: true }
    );
  };

  const filteredScholars = scholars;
  const filteredRenewals = renewals;
  const filteredRemovedScholars = removedScholars;

  const currentRows =
    sectionMode === 'registry'
      ? filteredScholars
      : sectionMode === 'removed'
        ? filteredRemovedScholars
        : filteredRenewals;

  const totalPages = listMetadata.pagination?.totalPages || 1;
  const total = listMetadata.pagination?.total || 0;
  const pageData = currentRows;
  const programOptions = ['All Programs', ...(listMetadata.filters?.programs || [])];
  const yearOptions = ['All Years', ...(listMetadata.filters?.years || [])];
  const semesterOptions = ['All Semesters', ...(listMetadata.filters?.semesters || [])];
  const statusOptions = ['All Statuses', ...(listMetadata.filters?.statuses || [])];

  const sortOptions = [
    'Name A-Z',
    'Name Z-A',
    'Year Newest',
    'Year Oldest',
  ];

  const hasActiveFilters =
    program !== 'All Programs' ||
    academicYear !== 'All Years' ||
    semester !== 'All Semesters' ||
    status !== 'All Statuses' ||
    sortBy !== 'Name A-Z';

  // openFilterModal: handles open filter modal for the Scholars flow.
  const openFilterModal = () => {
    setDraftProgram(program);
    setDraftYear(academicYear);
    setDraftSemester(semester);
    setDraftStatus(status);
    setDraftSortBy(sortBy);
    setFilterOpen(true);
  };

  // applyFilters: handles apply filters for the Scholars flow.
  const applyFilters = () => {
    setProgram(draftProgram);
    setAcademicYear(draftYear);
    setSemester(draftSemester);
    setStatus(draftStatus);
    setSortBy(draftSortBy);
    setFilterOpen(false);
    setPage(1);
  };

  // clearFilters: clears clear filters for the Scholars flow.
  const clearFilters = () => {
    setDraftProgram('All Programs');
    setDraftYear('All Years');
    setDraftSemester('All Semesters');
    setDraftStatus('All Statuses');
    setDraftSortBy('Name A-Z');

    setProgram('All Programs');
    setAcademicYear('All Years');
    setSemester('All Semesters');
    setStatus('All Statuses');
    setSortBy('Name A-Z');

    setFilterOpen(false);
    setPage(1);
  };

  if (loading) {
    return (
      <PageLoadingSkeleton
        label="Loading scholar monitoring"
        showStats
      />
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-red-400" />
        <p className="text-sm font-semibold text-red-800">
          Failed to load scholars
        </p>
        <p className="mt-1 text-xs text-red-600">{error}</p>
        <Button
          type="button"
          onClick={() => loadScholars()}
          variant="outline"
          size="sm"
          className="mt-4 border-red-200 text-xs text-red-600"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="dark-mode-route-canvas space-y-4 px-1 py-3" style={{ background: C.bg }}>
      {selectedScholarId ? (
        <ScholarProfileModal
          scholar={selectedScholar}
          loading={profileLoading}
          onClose={() => {
            setSelectedScholarId(null);
            setSelectedScholar(null);
          }}
        />
      ) : null}

      <ArchiveScholarModal
        scholar={archiveModalScholar}
        onClose={() => setArchiveModalScholar(null)}
        onConfirm={handleArchiveScholar}
        saving={archiveSaving}
      />

      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        programOptions={programOptions}
        yearOptions={yearOptions}
        semesterOptions={semesterOptions}
        statusOptions={statusOptions}
        sortOptions={sortOptions}
        draftProgram={draftProgram}
        setDraftProgram={setDraftProgram}
        draftYear={draftYear}
        setDraftYear={setDraftYear}
        draftSemester={draftSemester}
        setDraftSemester={setDraftSemester}
        draftStatus={draftStatus}
        setDraftStatus={setDraftStatus}
        draftSortBy={draftSortBy}
        setDraftSortBy={setDraftSortBy}
        onApply={applyFilters}
        onClear={clearFilters}
        sectionMode={sectionMode}
      />

      <section className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              placeholder={
                sectionMode === 'renewals'
                  ? 'Search renewal by scholar name or PDM ID...'
                  : sectionMode === 'removed'
                    ? 'Search removed scholar by name or PDM ID...'
                    : 'Search by scholar name or PDM ID...'
              }
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 rounded-xl border-stone-200 bg-stone-50 pl-10 text-sm"
            />
          </div>

          <div className="compact-toolbar-row flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="inline-flex w-full rounded-xl bg-stone-100 p-1 sm:w-auto">
              <button
                type="button"
                onClick={() =>
                  handleSectionModeChange('registry')
                }
                className={`inline-flex flex-1 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${sectionMode === 'registry'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600'
                  }`}
              >
                Registry
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSectionModeChange('renewals')
                }
                className={`inline-flex flex-1 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${sectionMode === 'renewals'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600'
                  }`}
              >
                Renewals
              </button>
              <button
                type="button"
                onClick={() => handleSectionModeChange('removed')}
                className={`inline-flex flex-1 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${sectionMode === 'removed'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600'
                  }`}
              >
                Archived
              </button>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={openFilterModal}
              className="h-10 rounded-xl border-stone-200 bg-white px-3 text-sm font-medium text-stone-700"
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filters
              {hasActiveFilters ? (
                <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                  Active
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-5 py-4">
          <h2 className="truncate text-sm font-semibold leading-5 text-stone-900">
            {sectionMode === 'registry'
              ? 'Scholar Registry'
              : sectionMode === 'removed'
                ? 'Archived'
                : 'Renewal Queue'}
          </h2>
          {sectionMode === 'renewals' ? (
            <p className="mt-1 text-sm text-stone-500">
              {`Canonical renewal records · ${total} result${total === 1 ? '' : 's'}`}
            </p>
          ) : null}
          {sectionMode === 'removed' ? (
            <p className="mt-1 text-sm text-stone-500">
              Historical scholarship relationships are preserved here; student registry accounts remain intact.
            </p>
          ) : null}
        </div>

        <CardContent className="p-4">
          {sectionMode === 'removed' && removedLoading ? (
            <div className="flex min-h-[220px] items-center justify-center gap-2 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading removed scholars...
            </div>
          ) : sectionMode === 'removed' && removedError ? (
            <div className="min-h-[220px] rounded-xl border border-red-100 bg-red-50 p-6 text-center">
              <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-red-400" />
              <p className="text-sm font-semibold text-red-800">Failed to load removed scholars</p>
              <p className="mt-1 text-xs text-red-600">{removedError}</p>
              <Button type="button" size="sm" variant="outline" className="mt-4 border-red-200 text-xs text-red-700" onClick={() => loadRemovedScholars()}>Retry</Button>
            </div>
          ) : sectionMode === 'renewals' && renewalsLoading ? (
            <div className="flex min-h-[220px] items-center justify-center gap-2 text-sm text-stone-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading renewal records...
            </div>
          ) : sectionMode === 'renewals' && renewalsError ? (
            <div className="min-h-[220px] rounded-xl border border-red-100 bg-red-50 p-6 text-center">
              <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-red-400" />
              <p className="text-sm font-semibold text-red-800">
                Failed to load renewal records
              </p>
              <p className="mt-1 text-xs text-red-600">
                {renewalsError}
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-4 border-red-200 text-xs text-red-700"
                onClick={() => loadRenewals()}
              >
                Retry
              </Button>
            </div>
          ) : pageData.length === 0 ? (
            <div className="py-16 text-center text-sm text-stone-400">
              No records match the current filters.
            </div>
          ) : sectionMode === 'renewals' ? (
            <RenewalTable rows={pageData} navigate={navigate} />
          ) : (
            <ScholarRegistryTable
              rows={pageData}
              onView={handleViewScholar}
              onRemove={setArchiveModalScholar}
              removedMode={sectionMode === 'removed'}
            />
          )}
        </CardContent>

        <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/70 px-5 py-3">
          <span className="text-xs text-stone-400">
            Showing{' '}
            {pageData.length === 0
              ? 0
              : (page - 1) * PAGE_SIZE + 1}
            –
            {Math.min(page * PAGE_SIZE, total)} of{' '}
            {total}
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-8 rounded-lg border-stone-200 p-0"
              onClick={() =>
                setPage((current) =>
                  Math.max(1, current - 1)
                )
              }
              disabled={page === 1}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <span className="px-2.5 text-xs font-medium text-stone-600">
              Page {page} / {totalPages}
            </span>

            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 w-8 rounded-lg border-stone-200 p-0"
              onClick={() =>
                setPage((current) =>
                  Math.min(totalPages, current + 1)
                )
              }
              disabled={page === totalPages}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

// ScholarRegistryTable: handles scholar registry table for the Scholars flow.
function ScholarRegistryTable({ rows, onView, onRemove, removedMode = false }) {
  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="hidden grid-cols-12 gap-2 border-b border-stone-200 bg-stone-50 px-3 py-3 xl:grid">
        <div className="col-span-3 text-xs font-semibold uppercase tracking-wide text-stone-700">Scholar</div>
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">Program</div>
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">{removedMode ? 'Removed On' : 'Current Semester'}</div>
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">Scholarship Status</div>
        <div className="col-span-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-700">Action</div>
      </div>

      <div className="divide-y divide-stone-100">
        {rows.map((scholar) => {
          const scholarshipMeta = getScholarshipStatusMeta(scholar.status);
          const cycle = [
            scholar.semester,
            scholar.academic_year ? `AY ${scholar.academic_year}` : '',
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <div
              key={scholar.scholar_id}
              className="grid min-w-0 grid-cols-1 gap-3 px-3 py-3 transition hover:bg-stone-50/70 sm:grid-cols-2 xl:grid-cols-12 xl:items-center xl:gap-2"
            >
              <div className="min-w-0 sm:col-span-2 xl:col-span-3">
                <ScholarIdentity
                  scholar={scholar}
                  name={scholar.student_name}
                  studentNumber={scholar.student_number}
                  nameClassName="xl:max-w-[240px]"
                />
              </div>

              <div className="min-w-0 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Program</p>
                <p className="break-words text-sm leading-5 text-stone-700">
                  {scholar.program_name || 'N/A'}
                </p>
              </div>

              <div className="min-w-0 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">{removedMode ? 'Removed On' : 'Current Semester'}</p>
                {removedMode ? (
                  <>
                    <p className="break-words text-sm font-semibold leading-5 text-stone-700">{formatDateTime(scholar.scholar_archived_at)}</p>
                    <p className="mt-0.5 break-words text-[10px] leading-4 text-stone-400">{scholar.scholar_removal_reason || 'Scholarship privilege removed'}</p>
                  </>
                ) : (
                  <>
                    <p className="break-words text-sm font-semibold leading-5 text-stone-700">{scholar.semester || 'Not set'}</p>
                    <p className="mt-0.5 break-words text-[10px] leading-4 text-stone-400">{scholar.academic_year ? `AY ${scholar.academic_year}` : cycle || 'No active period'}</p>
                  </>
                )}
              </div>

              <div className="min-w-0 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Scholarship Status</p>
                <StatusPill meta={scholarshipMeta} compact />
              </div>

              <div className="min-w-0 sm:col-span-2 xl:col-span-3">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Action</p>
                <div className="flex min-w-0 flex-wrap gap-2 xl:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onView(scholar.scholar_id)}
                    className="min-w-0 flex-1 rounded-lg border-stone-200 px-3 text-xs sm:flex-none"
                  >
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    View Profile
                  </Button>

                  {!removedMode ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onRemove(scholar)}
                      className="min-w-0 flex-1 rounded-lg border-red-200 px-3 text-xs text-red-700 hover:bg-red-50 sm:flex-none"
                    >
                      <ShieldAlert className="mr-1.5 h-3.5 w-3.5" />
                      Remove Privilege
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

// cleanDisplayValue: handles clean display value for the Scholars flow.
function cleanDisplayValue(value, fallback = '—') {
  const text = String(value ?? '').trim();
  if (!text || ['n/a', 'null', 'undefined'].includes(text.toLowerCase())) return fallback;
  return text;
}

// humanizeStatus: handles humanize status for the Scholars flow.
function humanizeStatus(value, fallback = '—') {
  const text = cleanDisplayValue(value, '');
  if (!text) return fallback;
  return text
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

// getProfileStatusTone: reads and returns get profile status tone for the Scholars flow.
function getProfileStatusTone(value) {
  const status = normalizeText(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  if (['approved', 'cleared', 'no offense', 'good moral standing', 'good scholastic standing', 'good standing'].includes(status)) {
    return { badge: 'border-green-200 bg-green-100 text-green-800', icon: 'bg-green-100 text-green-700', text: 'text-green-800' };
  }
  if (status === 'released') {
    return { badge: 'border-teal-200 bg-teal-100 text-teal-800', icon: 'bg-teal-100 text-teal-700', text: 'text-teal-800' };
  }
  if (['activated', 'active', 'submitted'].includes(status)) {
    return { badge: 'border-blue-200 bg-blue-100 text-blue-800', icon: 'bg-blue-100 text-blue-700', text: 'text-blue-800' };
  }
  if (['rejected', 'failed', 'removed', 'at risk', 'flagged'].includes(status)) {
    return { badge: 'border-red-200 bg-red-100 text-red-800', icon: 'bg-red-100 text-red-700', text: 'text-red-800' };
  }
  if (['pending', 'pending submission', 'under review', 'in progress', 'applied'].includes(status)) {
    return { badge: 'border-amber-200 bg-amber-100 text-amber-800', icon: 'bg-amber-100 text-amber-700', text: 'text-amber-800' };
  }
  return { badge: 'border-stone-200 bg-stone-50 text-stone-600', icon: 'bg-stone-100 text-stone-500', text: 'text-stone-700' };
}

// formatCurrency: formats format currency for the Scholars flow.
function formatCurrency(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(amount);
}

// formatAcademicPeriod: formats format academic period for the Scholars flow.
function formatAcademicPeriod(semester, academicYear, fallback = '—') {
  return [cleanDisplayValue(semester, ''), academicYear ? `AY ${academicYear}` : '']
    .filter(Boolean)
    .join(' · ') || fallback;
}

// formatYearLevel: formats format year level for the Scholars flow.
function formatYearLevel(value) {
  const raw = cleanDisplayValue(value, '');
  if (!raw) return '';
  if (/year/i.test(raw)) return raw;
  const numeric = Number(raw);
  if (!Number.isInteger(numeric)) return raw;
  const suffix = numeric === 1 ? 'st' : numeric === 2 ? 'nd' : numeric === 3 ? 'rd' : 'th';
  return `${numeric}${suffix} Year`;
}

// ProfileField: handles profile field for the Scholars flow.
function ProfileField({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl border border-stone-200 bg-white px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">{label}</p>
      <p className="mt-1 break-words text-sm font-medium leading-5 text-stone-800">
        {cleanDisplayValue(value)}
      </p>
    </div>
  );
}

// ContactRow: handles contact row for the Scholars flow.
function ContactRow({ icon: Icon, label, value, breakAnywhere = false }) {
  const iconTone = label === 'Email'
    ? 'bg-blue-100 text-blue-700'
    : label === 'Mobile Number'
      ? 'bg-teal-100 text-teal-700'
      : 'bg-rose-100 text-rose-700';
  return (
    <div className="flex min-w-0 gap-3 py-3 first:pt-0 last:pb-0">
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">{label}</p>
        <p className={`mt-1 text-sm font-medium leading-5 text-stone-700 ${breakAnywhere ? '[overflow-wrap:anywhere]' : 'break-words'}`}>
          {cleanDisplayValue(value)}
        </p>
      </div>
    </div>
  );
}

// CompactHistorySection: handles compact history section for the Scholars flow.
function CompactHistorySection({ title, subtitle, countLabel, icon: Icon, iconClassName = 'bg-amber-100 text-amber-700', defaultOpen = false, children }) {
  const [expanded, setExpanded] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden rounded-2xl border-stone-200 bg-white shadow-sm">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="flex min-h-14 w-full flex-wrap items-center gap-3 bg-stone-50/70 px-4 py-3.5 text-left transition hover:bg-stone-100/80"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-stone-800 sm:text-base">{title}</h4>
            <p className="mt-1 text-xs leading-5 text-stone-500">{subtitle}</p>
          </div>
        </div>
        {countLabel ? (
          <span className="ml-auto rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-500 shadow-sm">
            {countLabel}
          </span>
        ) : null}
        <ChevronDown className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded ? <div className="border-t border-stone-100 p-3 sm:p-4">{children}</div> : null}
    </Card>
  );
}

// CurrentScholarshipPanel: handles current scholarship panel for the Scholars flow.
function CurrentScholarshipPanel({ scholar, standingMeta }) {
  const programHistory = Array.isArray(scholar.program_history) ? scholar.program_history : [];
  const renewalHistory = Array.isArray(scholar.renewal_history) ? scholar.renewal_history : [];
  const currentRenewal = renewalHistory.find((item) => String(item.period_id || '') === String(scholar.period_id || ''));
  const statusItems = [
    { label: 'Standing', value: standingMeta?.label || '—' },
    { label: 'SDO', value: humanizeStatus(scholar.endorsement_sdo_status || scholar.sdo_status), icon: ShieldCheck },
    { label: 'GCO', value: humanizeStatus(scholar.guidance_status), icon: CheckCircle2 },
    { label: 'PD', value: humanizeStatus(scholar.pd_status), icon: BookOpen },
    { label: 'Renewal', value: humanizeStatus(currentRenewal?.status), icon: CalendarDays },
  ];
  const currentRecord = programHistory.find((item) => String(item.application_id || '') === String(scholar.application_id || ''));
  const awardedAt = scholar.date_awarded || currentRecord?.activated_at;
  const isActive = normalizeText(scholar.status) === 'active';

  return (
    <section className="min-w-0 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700">Current Scholarship</p>
          <h4 className="mt-1 break-words text-xl font-semibold leading-7 text-stone-900">
            {cleanDisplayValue(scholar.program_name, 'No current scholarship')}
          </h4>
          <p className="mt-1.5 break-words text-xs leading-5 text-stone-600">{formatAcademicPeriod(scholar.semester, scholar.academic_year)}</p>
        </div>
        <div className="shrink-0">
          {isActive ? (
            <span className="inline-flex rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">Active</span>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-stone-100 pt-3 text-xs">
        <p className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-stone-500">Standing</span>
          <span className="font-semibold" style={{ color: standingMeta?.color || C.muted }}>{standingMeta?.label || 'Not recorded'}</span>
        </p>
        <p className="flex min-w-0 flex-wrap items-center gap-1.5 text-stone-500">
          <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          Awarded <span className="font-medium text-stone-700">{formatDate(awardedAt, '—')}</span>
        </p>
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        {statusItems.slice(1).map((item) => {
          const Icon = item.icon;
          const hasValue = item.value && item.value !== '—';
          const tone = getProfileStatusTone(item.value);
          return (
            <div key={item.label} className="flex min-w-0 items-start gap-2.5 rounded-xl border border-stone-200 bg-white p-3">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone.icon}`}>
                <Icon aria-hidden="true" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <dt className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">{item.label}</dt>
                <dd className={`mt-1 break-words text-xs leading-5 ${hasValue ? `font-semibold ${tone.text}` : 'text-stone-500'}`}>
                  {hasValue ? item.value : 'Not recorded'}
                </dd>
              </div>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

// PayoutHistoryPanel: handles payout history panel for the Scholars flow.
function PayoutHistoryPanel({ history = [] }) {
  const rows = Array.isArray(history) ? history : [];
  return (
    <CompactHistorySection title="Payout History" subtitle="Release records" countLabel={`${rows.length} record${rows.length === 1 ? '' : 's'}`} icon={FileCheck2} iconClassName="bg-teal-100 text-teal-700">
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((item) => {
            const tone = getProfileStatusTone(item.status);
            return (
            <div key={item.payout_entry_id} className="min-w-0 rounded-xl border border-stone-200 bg-white px-3.5 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-stone-800">{formatAcademicPeriod(item.semester, item.academic_year)}</p>
                  <p className="mt-1 text-base font-semibold text-stone-900">{formatCurrency(item.amount)}</p>
                </div>
                <span className={`inline-flex max-w-full items-center gap-1.5 break-words rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                  <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                  {humanizeStatus(item.status)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
                {item.payout_code ? <span className="break-all">Code: {item.payout_code}</span> : null}
                <span>Released {formatDate(item.released_at || item.payout_date, '—')}</span>
                {item.proof_status ? <span>Proof: {humanizeStatus(item.proof_status)}</span> : null}
              </div>
            </div>
            );
          })}
        </div>
      ) : <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-center text-sm text-stone-500">No payout records yet.</p>}
    </CompactHistorySection>
  );
}

// RenewalHistoryPanel: handles renewal history panel for the Scholars flow.
function RenewalHistoryPanel({ history = [] }) {
  const rows = Array.isArray(history) ? history : [];
  return (
    <CompactHistorySection title="Renewal History" subtitle="Renewal decisions" countLabel={`${rows.length} record${rows.length === 1 ? '' : 's'}`} icon={CalendarDays} iconClassName="bg-green-100 text-green-700">
      {rows.length ? (
        <div className="space-y-2">
          {rows.map((item) => {
            const meta = getRenewalStatusMeta(item.status);
            const tone = getProfileStatusTone(meta.label);
            return (
              <div key={item.renewal_id} className="min-w-0 rounded-xl border border-stone-200 bg-white px-3.5 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-stone-800">{formatAcademicPeriod(item.semester, item.academic_year)}</p>
                    {item.program_name ? <p className="mt-1 break-words text-xs text-stone-500">{item.program_name}</p> : null}
                  </div>
                  <span className={`inline-flex max-w-full items-center gap-1.5 break-words rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone.badge}`}>
                    <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                    {meta.label}
                  </span>
                </div>
                <p className="mt-2 text-xs text-stone-500">{item.reviewed_at ? `Reviewed ${formatDate(item.reviewed_at, '—')}` : item.submitted_on ? `Submitted ${formatDate(item.submitted_on, '—')}` : `Deadline ${formatDate(item.deadline_date, '—')}`}</p>
              </div>
            );
          })}
        </div>
      ) : <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-center text-sm text-stone-500">No renewal records yet.</p>}
    </CompactHistorySection>
  );
}

// ScholarStatusHistoryPanel: handles scholar status history panel for the Scholars flow.
function ScholarStatusHistoryPanel({ events = [] }) {
  const rows = Array.isArray(events) ? events : [];
  return (
    <CompactHistorySection title="Scholar Status History" subtitle="Important changes to scholarship privilege and standing" countLabel={rows.length ? `${rows.length} event${rows.length === 1 ? '' : 's'}` : ''} icon={History}>
      {rows.length ? (
        <div className="space-y-0">
          {rows.map((item, index) => {
            const eventStatus = {
              'Scholarship activated': 'activated',
              'Renewal approved': 'approved',
              'Renewal rejected': 'rejected',
              'Scholar privilege removed': 'removed',
            }[item.title];
            const tone = getProfileStatusTone(eventStatus);
            return (
            <div key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
              <div className="relative flex w-3 shrink-0 justify-center">
                <span className={`mt-1.5 h-2.5 w-2.5 rounded-full border-2 ring-4 ring-white ${tone.badge}`} />
                {index < rows.length - 1 ? <span className="absolute bottom-0 top-4 w-px bg-stone-200" /> : null}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-stone-400">{formatDate(item.date, '—')}</p>
                <p className={`mt-0.5 text-sm font-semibold ${tone.text}`}>{item.title}</p>
                {item.detail ? <p className="mt-1 break-words text-xs leading-5 text-stone-500">{item.detail}</p> : null}
              </div>
            </div>
            );
          })}
        </div>
      ) : <p className="rounded-xl border border-dashed border-stone-200 bg-stone-50 px-4 py-5 text-center text-sm text-stone-500">No scholar lifecycle changes recorded yet.</p>}
    </CompactHistorySection>
  );
}

// RenewalTable: handles renewal table for the Scholars flow.
function RenewalTable({ rows, navigate }) {
  return (
    <div className="w-full min-w-0 overflow-hidden">
      <div className="hidden grid-cols-12 gap-2 border-b border-stone-200 bg-stone-50 px-3 py-3 xl:grid">
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">Scholar</div>
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">Program</div>
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">Cycle</div>
        <div className="col-span-2 text-xs font-semibold uppercase tracking-wide text-stone-700">Document Status</div>
        <div className="col-span-1 text-xs font-semibold uppercase tracking-wide text-stone-700">Renewal Status</div>
        <div className="col-span-1 text-xs font-semibold uppercase tracking-wide text-stone-700">Submitted</div>
        <div className="col-span-2 text-right text-xs font-semibold uppercase tracking-wide text-stone-700">Action</div>
      </div>

      <div className="divide-y divide-stone-100">
        {rows.map((renewal) => {
          const renewalMeta = getRenewalStatusMeta(renewal.renewal_status);
          const documentMeta = getRenewalDocumentStatusMeta(renewal.document_status);
          const cycle = [
            renewal.semester_label,
            renewal.school_year_label ? `AY ${renewal.school_year_label}` : '',
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <div
              key={`renewal-${renewal.renewal_id || renewal.id}`}
              className="grid min-w-0 grid-cols-1 gap-3 px-3 py-3 transition hover:bg-stone-50/70 sm:grid-cols-2 xl:grid-cols-12 xl:items-center xl:gap-2"
            >
              <div className="min-w-0 sm:col-span-2 xl:col-span-2">
                <p className="break-words text-sm font-medium leading-5 text-stone-800">
                  {renewal.student_name}
                </p>
                <p className="mt-0.5 break-all text-xs text-stone-400">
                  {renewal.student_number}
                </p>
              </div>

              <div className="min-w-0 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Program</p>
                <p className="break-words text-sm leading-5 text-stone-700">
                  {renewal.program_name || 'N/A'}
                </p>
              </div>

              <div className="min-w-0 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Cycle</p>
                <p className="break-words text-xs leading-5 text-stone-600">
                  {cycle || 'Current Period'}
                </p>
              </div>

              <div className="min-w-0 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Document Status</p>
                <span
                  className="inline-flex max-w-full whitespace-normal break-words rounded-full px-2.5 py-1 text-xs font-medium leading-4"
                  style={{ background: documentMeta.bg, color: documentMeta.color }}
                >
                  {renewal.document_status || 'Missing Docs'}
                </span>
              </div>

              <div className="min-w-0 xl:col-span-1">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Renewal Status</p>
                <span
                  className="inline-flex max-w-full whitespace-normal break-words rounded-full px-2.5 py-1 text-xs font-medium leading-4"
                  style={{ background: renewalMeta.bg, color: renewalMeta.color }}
                >
                  {renewalMeta.label}
                </span>
              </div>

              <div className="min-w-0 xl:col-span-1">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Submitted</p>
                <p className="break-words text-xs leading-5 text-stone-500">
                  {formatDate(renewal.submitted_at, 'Not yet submitted')}
                </p>
              </div>

              <div className="min-w-0 sm:col-span-2 xl:col-span-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-stone-400 xl:hidden">Action</p>
                <div className="flex min-w-0 flex-wrap xl:justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-w-0 max-w-full rounded-lg border-stone-200 px-3 text-xs"
                    onClick={() =>
                      navigate(
                        `/admin/scholars/renewals/${renewal.renewal_id || renewal.id}`
                      )
                    }
                  >
                    <FileCheck2 className="mr-1.5 h-3.5 w-3.5" />
                    Review Renewal
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
