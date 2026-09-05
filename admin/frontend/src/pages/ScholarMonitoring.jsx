import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

function getAuthHeaders() {
  const token = sessionStorage.getItem('adminToken');

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRenewalStatus(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
}

function getInitials(name = '') {
  return (name || 'NA')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

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

function formatMinutes(value) {
  const minutes = Math.max(0, Number(value || 0));
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours <= 0) return `${mins}m`;
  if (mins <= 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, Math.round(Number(value || 0))));
}

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

function getSdoStatusMeta(scholar = {}) {
  const level = normalizeText(scholar.sdu_level);
  const status = normalizeText(scholar.sdo_status);

  if (level === 'major' || status.includes('major')) {
    return {
      label: 'Major Offense',
      shortLabel: 'Major',
      color: C.red,
      bg: C.redSoft,
      border: '#fecaca',
      icon: ShieldAlert,
      description:
        'A major disciplinary offense is recorded for this scholar. Review the scholarship eligibility and any SDO decision before taking further action.',
    };
  }

  if (level === 'minor' || status.includes('minor')) {
    return {
      label: 'Minor Offense',
      shortLabel: 'Minor',
      color: C.amber,
      bg: C.amberSoft,
      border: '#fed7aa',
      icon: ShieldAlert,
      description:
        'A minor disciplinary offense is recorded for this scholar. The record remains visible for scholarship monitoring.',
    };
  }

  return {
    label: 'Clear',
    shortLabel: 'Clear',
    color: C.green,
    bg: C.greenSoft,
    border: '#bbf7d0',
    icon: ShieldCheck,
    description: 'No minor or major SDO offense is currently recorded for this scholar.',
  };
}

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

function ObligationHistoryPanel({ studentId }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedRoId, setExpandedRoId] = useState(null);

  useEffect(() => {
    if (!studentId) {
      setHistory([]);
      setError('');
      return;
    }

    let cancelled = false;

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
    <Card className="overflow-hidden border-stone-200 shadow-none">
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/70 px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-stone-600 shadow-sm">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-stone-800">
              Obligation History
            </h4>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              Semester-by-semester Return of Obligation record
            </p>
          </div>
        </div>

        {!loading && !error ? (
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-500 shadow-sm">
            {history.length} cycle{history.length === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>

      <CardContent className="p-4">
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
                    onClick={() =>
                      setExpandedRoId(expanded ? null : roId)
                    }
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-stone-50"
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

                    <div className="shrink-0 text-right">
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
                    <div className="border-t border-stone-100 bg-stone-50/60 p-3.5">
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
      </CardContent>
    </Card>
  );
}

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

function ScholarProfileModal({ scholar, loading, onClose }) {
  const s = scholar || {};
  const scholarshipMeta = getScholarshipStatusMeta(s.status);
  const sdoMeta = getSdoStatusMeta(s);
  const SdoIcon = sdoMeta.icon;
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);

  const gwaNumber = Number(s.gwa);
  const hasGwa =
    Number.isFinite(gwaNumber) &&
    s.gwa !== null &&
    s.gwa !== '';

  const isAtRisk = hasGwa && gwaNumber >= 2.0;

  const standingMeta = isAtRisk
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

  const currentPeriod = [
    s.semester,
    s.academic_year ? `AY ${s.academic_year}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  const semesterShort = (() => {
    const value = String(s.semester || '').trim();

    if (!value) return 'Semester not set';
    if (/first/i.test(value)) return '1st Sem';
    if (/second/i.test(value)) return '2nd Sem';
    if (/summer/i.test(value)) return 'Summer';

    return value;
  })();

  if (!scholar && !loading) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-3 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <Card
        className="flex h-[90vh] w-full max-w-[68rem] flex-col overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-stone-100 bg-white px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-stone-800">
              Scholar Profile
            </h3>
            <p className="mt-1 text-sm text-stone-500">
              Scholar information, current standing, and obligation history
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

        {loading ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-stone-300" />
            <p className="text-xs font-semibold text-stone-400">
              Loading scholar profile...
            </p>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <section className="min-h-0 overflow-y-auto border-b border-stone-100 bg-white p-4 sm:p-5 lg:border-b-0 lg:border-r lg:p-6">
              <div className="space-y-5">
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
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => s.avatar_url && setAvatarPreviewOpen(true)}
                    disabled={!s.avatar_url}
                    className="shrink-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--portal-base)] focus:ring-offset-2 disabled:cursor-default"
                    aria-label={s.avatar_url ? `Enlarge ${s.student_name || 'scholar'} profile photo` : 'No profile photo available'}
                  >
                    <Avatar
                      className={`h-16 w-16 rounded-2xl border border-stone-200 ${s.avatar_url ? 'cursor-zoom-in' : ''}`}
                      style={{ background: C.amberSoft, color: C.brown }}
                    >
                      <AvatarImage
                        src={s.avatar_url || undefined}
                        alt={s.student_name || 'Scholar'}
                        className="rounded-2xl"
                      />
                      <AvatarFallback className="rounded-2xl bg-transparent text-base font-medium">
                        {getInitials(s.student_name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>

                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-xl font-semibold text-stone-900">
                      {s.student_name || 'Unknown Scholar'}
                    </h4>

                    <p className="mt-1 font-mono text-xs text-stone-400">
                      {s.student_number || 'N/A'}
                    </p>

                    <p className="mt-2 text-sm font-medium text-stone-700">
                      {s.program_name || 'No scholarship program'}
                    </p>

                    <p className="mt-1 text-xs text-stone-500">
                      {currentPeriod || 'No active academic period'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-y border-stone-100 py-3">
                  <StatusPill meta={scholarshipMeta} compact />

                  <StatusPill meta={standingMeta} compact />

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600">
                    <CalendarDays className="h-3 w-3" />
                    {semesterShort}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-600">
                    <BookOpen className="h-3 w-3" />
                    GWA {hasGwa ? gwaNumber.toFixed(2) : '—'}
                  </span>

                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{
                      color: sdoMeta.color,
                      background: sdoMeta.bg,
                      border: `1px solid ${sdoMeta.border}`,
                    }}
                  >
                    <SdoIcon className="h-3 w-3" />
                    SDO {sdoMeta.shortLabel}
                  </span>
                </div>

                <div>
                  <div className="mb-3">
                    <h5 className="text-base font-semibold text-stone-800">
                      Important Information
                    </h5>
                    <p className="mt-1 text-sm text-stone-500">
                      Core scholarship and contact details
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <InfoItem
                      icon={BookOpen}
                      label="Scholarship Program"
                      value={s.program_name || 'Not available'}
                    />

                    <InfoItem
                      icon={BookOpen}
                      label="Course"
                      value={
                        [s.course_code, s.course_name]
                          .filter(Boolean)
                          .join(' — ') || 'Not available'
                      }
                    />

                    <InfoItem
                      icon={CalendarDays}
                      label="Academic Period"
                      value={currentPeriod || 'Not available'}
                    />

                    <InfoItem
                      icon={CalendarDays}
                      label="Date Awarded"
                      value={formatDate(s.date_awarded)}
                    />

                    <InfoItem
                      icon={Mail}
                      label="Email"
                      value={s.email || 'Not available'}
                    />

                    <InfoItem
                      icon={Phone}
                      label="Phone"
                      value={s.phone_number || 'Not available'}
                    />

                    <InfoItem
                      icon={MapPin}
                      label="Address"
                      value={s.address_summary || 'Not available'}
                      wide
                    />
                  </div>
                </div>

                <div
                  className="overflow-hidden rounded-xl border"
                  style={{ borderColor: sdoMeta.border }}
                >
                  <div
                    className="flex items-center justify-between gap-3 px-3.5 py-3"
                    style={{ background: sdoMeta.bg }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80"
                        style={{ color: sdoMeta.color }}
                      >
                        <SdoIcon className="h-4 w-4" />
                      </div>

                      <div>
                        <p
                          className="text-sm font-semibold"
                          style={{ color: sdoMeta.color }}
                        >
                          Student Disciplinary Office
                        </p>
                        <p
                          className="mt-0.5 text-xs font-medium"
                          style={{ color: sdoMeta.color }}
                        >
                          {sdoMeta.label}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white px-3.5 py-3">
                    <p className="text-sm leading-6 text-stone-600">
                      {sdoMeta.description}
                    </p>

                    {s.student_profile?.disciplinary_details ? (
                      <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2.5">
                        <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                          Disciplinary Details
                        </p>
                        <p className="mt-1 text-sm leading-6 text-stone-700">
                          {s.student_profile.disciplinary_details}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="min-h-0 overflow-y-auto bg-stone-50/45 p-4 sm:p-5 lg:p-6">
              <ObligationHistoryPanel
                studentId={s.student_id || s.scholar_id}
              />
            </section>
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
  const [page, setPage] = useState(1);

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

  const loadScholars = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setLoading(true);
      setError('');

      const [scholarsRes, statsRes] = await Promise.all([
        fetch(buildApiUrl('/api/scholars'), {
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

      setScholars(
        Array.isArray(scholarsPayload) ? scholarsPayload : []
      );

      setStats({
        total: Number(statsPayload.total) || 0,
        active: Number(statsPayload.active) || 0,
        at_risk: Number(statsPayload.at_risk) || 0,
        avg_gwa: Number(statsPayload.avg_gwa) || 0,
      });
    } catch (err) {
      console.error('SCHOLAR LOAD ERROR:', err);
      if (!quiet) {
        setError(err?.message || 'Failed to load scholar data');
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  const loadRenewals = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setRenewalsLoading(true);
      setRenewalsError('');

      const response = await fetch(buildApiUrl('/api/renewals'), {
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

      setRenewals(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error('RENEWALS LOAD ERROR:', err);
      setRenewalsError(
        err?.message || 'Failed to load renewal records'
      );
    } finally {
      if (!quiet) setRenewalsLoading(false);
    }
  }, []);

  const loadRemovedScholars = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setRemovedLoading(true);
      setRemovedError('');
      const response = await fetch(buildApiUrl('/api/scholars/removed'), {
        headers: getAuthHeaders(),
      });
      const payload = await response.json().catch(() => []);
      if (!response.ok) {
        throw new Error(payload?.error || payload?.message || 'Failed to load removed scholars');
      }
      setRemovedScholars(Array.isArray(payload) ? payload : []);
    } catch (err) {
      console.error('REMOVED SCHOLARS LOAD ERROR:', err);
      setRemovedError(err?.message || 'Failed to load removed scholars');
    } finally {
      if (!quiet) setRemovedLoading(false);
    }
  }, []);

  useEffect(() => {
    loadScholars();
  }, [loadScholars]);

  useEffect(() => {
    loadRenewals();
  }, [loadRenewals]);

  useEffect(() => {
    loadRemovedScholars();
  }, [loadRemovedScholars]);

  useEffect(() => {
    const tab = new URLSearchParams(location.search).get('tab');
    if (tab === 'renewals') setSectionMode('renewals');
    else if (tab === 'removed') setSectionMode('removed');
    else setSectionMode('registry');
  }, [location.search]);

  useSocketEvent(
    'renewal:updated',
    () => loadRenewals({ quiet: true }),
    [loadRenewals]
  );

  useSocketEvent(
    'renewal:approved',
    () => loadRenewals({ quiet: true }),
    [loadRenewals]
  );

  useSocketEvent(
    'scholar:updated',
    () => loadScholars({ quiet: true }),
    [loadScholars]
  );

  useSocketEvent(
    'scholar:created',
    () => loadScholars({ quiet: true }),
    [loadScholars]
  );

  useSocketEvent(
    'scholar:archived',
    () => {
      loadScholars({ quiet: true });
      loadRemovedScholars({ quiet: true });
    },
    [loadScholars, loadRemovedScholars]
  );

  useSocketEvent(
    'scholar:restored',
    () => loadScholars({ quiet: true }),
    [loadScholars]
  );

  const handleViewScholar = async (scholarId) => {
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
  };

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

      window.alert(
        data?.message ||
        (data?.promotion?.promoted
          ? `Scholar removed. ${data.promotion.applicant_name ||
          'The next waiting applicant'
          } was promoted automatically.`
          : 'Scholar removed and the scholarship slot was released.')
      );
    } catch (err) {
      console.error('ARCHIVE SCHOLAR ERROR:', err);
      window.alert(
        err?.message || 'Failed to archive scholar'
      );
    } finally {
      setArchiveSaving(false);
    }
  };

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

  const filteredScholars = useMemo(() => {
    const query = search.trim().toLowerCase();
    const normalizedQuery = query.replace(/[^a-z0-9]/g, '');

    const rows = scholars.filter((item) => {
      const name = String(item.student_name || '').toLowerCase();
      const studentNumber = String(
        item.student_number || ''
      ).toLowerCase();
      const normalizedStudentNumber =
        studentNumber.replace(/[^a-z0-9]/g, '');

      const matchSearch =
        !query ||
        name.includes(query) ||
        studentNumber.includes(query) ||
        (
          normalizedQuery.length > 0 &&
          normalizedStudentNumber.includes(normalizedQuery)
        );

      const matchProgram =
        program === 'All Programs' ||
        item.program_name === program;

      const matchYear =
        academicYear === 'All Years' ||
        String(item.academic_year || item.batch_year || '') ===
        String(academicYear);

      const matchSemester =
        semester === 'All Semesters' ||
        String(item.semester || '') === String(semester);

      const matchStatus =
        status === 'All Statuses' ||
        String(item.status || '') === status;

      return (
        matchSearch &&
        matchProgram &&
        matchYear &&
        matchSemester &&
        matchStatus
      );
    });

    return [...rows].sort((a, b) => {
      const nameA = String(a.student_name || '').toLowerCase();
      const nameB = String(b.student_name || '').toLowerCase();

      const yearA =
        Number(
          String(a.academic_year || a.batch_year || '').split('-')[0]
        ) || 0;

      const yearB =
        Number(
          String(b.academic_year || b.batch_year || '').split('-')[0]
        ) || 0;

      switch (sortBy) {
        case 'Name Z-A':
          return nameB.localeCompare(nameA);
        case 'Year Newest':
          return yearB - yearA;
        case 'Year Oldest':
          return yearA - yearB;
        case 'Name A-Z':
        default:
          return nameA.localeCompare(nameB);
      }
    });
  }, [scholars, search, program, academicYear, semester, status, sortBy]);

  const filteredRenewals = useMemo(() => {
    const query = search.trim().toLowerCase();
    const normalizedQuery = query.replace(/[^a-z0-9]/g, '');

    const rows = renewals.filter((item) => {
      const name = String(item.student_name || '').toLowerCase();
      const studentNumber = String(
        item.student_number || ''
      ).toLowerCase();
      const normalizedStudentNumber =
        studentNumber.replace(/[^a-z0-9]/g, '');

      const matchSearch =
        !query ||
        name.includes(query) ||
        studentNumber.includes(query) ||
        (
          normalizedQuery.length > 0 &&
          normalizedStudentNumber.includes(normalizedQuery)
        );

      const matchProgram =
        program === 'All Programs' ||
        item.program_name === program;

      const matchYear =
        academicYear === 'All Years' ||
        String(item.school_year_label || '') ===
        String(academicYear);

      const matchStatus =
        status === 'All Statuses' ||
        normalizeRenewalStatus(item.renewal_status) ===
        normalizeRenewalStatus(status);

      return (
        matchSearch &&
        matchProgram &&
        matchYear &&
        matchStatus
      );
    });

    return [...rows].sort((a, b) => {
      const nameA = String(a.student_name || '').toLowerCase();
      const nameB = String(b.student_name || '').toLowerCase();

      const yearA =
        Number(
          String(itemYear(a)).split('-')[0]
        ) || 0;

      const yearB =
        Number(
          String(itemYear(b)).split('-')[0]
        ) || 0;

      switch (sortBy) {
        case 'Name Z-A':
          return nameB.localeCompare(nameA);
        case 'Year Newest':
          return yearB - yearA;
        case 'Year Oldest':
          return yearA - yearB;
        case 'Name A-Z':
        default:
          return nameA.localeCompare(nameB);
      }
    });
  }, [renewals, search, program, academicYear, status, sortBy]);

  const filteredRemovedScholars = useMemo(() => {
    const query = search.trim().toLowerCase();
    const normalizedQuery = query.replace(/[^a-z0-9]/g, '');
    const rows = removedScholars.filter((item) => {
      const name = String(item.student_name || '').toLowerCase();
      const studentNumber = String(item.student_number || '').toLowerCase();
      const normalizedStudentNumber = studentNumber.replace(/[^a-z0-9]/g, '');
      const matchSearch = !query || name.includes(query) || studentNumber.includes(query) ||
        (normalizedQuery.length > 0 && normalizedStudentNumber.includes(normalizedQuery));
      const matchProgram = program === 'All Programs' || item.program_name === program;
      const matchYear = academicYear === 'All Years' || String(item.academic_year || item.batch_year || '') === String(academicYear);
      const matchStatus = status === 'All Statuses' || String(item.status || '') === status;
      return matchSearch && matchProgram && matchYear && matchStatus;
    });
    return [...rows].sort((a, b) => {
      if (sortBy === 'Name Z-A') return String(b.student_name || '').localeCompare(String(a.student_name || ''));
      if (sortBy === 'Year Newest') return new Date(b.scholar_archived_at || 0) - new Date(a.scholar_archived_at || 0);
      if (sortBy === 'Year Oldest') return new Date(a.scholar_archived_at || 0) - new Date(b.scholar_archived_at || 0);
      return String(a.student_name || '').localeCompare(String(b.student_name || ''));
    });
  }, [removedScholars, search, program, academicYear, status, sortBy]);

  const currentRows =
    sectionMode === 'registry'
      ? filteredScholars
      : sectionMode === 'removed'
        ? filteredRemovedScholars
        : filteredRenewals;

  useEffect(() => {
    setPage(1);
  }, [
    search,
    program,
    academicYear,
    semester,
    status,
    sortBy,
    sectionMode,
  ]);

  const totalPages = Math.max(
    1,
    Math.ceil(currentRows.length / PAGE_SIZE)
  );

  const pageData = currentRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  const programOptions = useMemo(() => {
    const source =
      sectionMode === 'registry'
        ? scholars
        : sectionMode === 'removed'
          ? removedScholars
          : renewals;

    return [
      'All Programs',
      ...new Set(
        source.map((item) => item.program_name).filter(Boolean)
      ),
    ];
  }, [scholars, removedScholars, renewals, sectionMode]);

  const yearOptions = useMemo(() => {
    const source =
      sectionMode === 'registry'
        ? scholars.map((item) => item.academic_year || item.batch_year)
        : sectionMode === 'removed'
          ? removedScholars.map((item) => item.academic_year || item.batch_year)
          : renewals.map((item) => item.school_year_label);

    return [
      'All Years',
      ...new Set(source.filter(Boolean)),
    ];
  }, [scholars, removedScholars, renewals, sectionMode]);

  const semesterOptions = useMemo(
    () => [
      'All Semesters',
      ...new Set(scholars.map((item) => item.semester).filter(Boolean)),
    ],
    [scholars]
  );

  const statusOptions = useMemo(() => {
    const source =
      sectionMode === 'registry'
        ? scholars.map((item) => item.status)
        : sectionMode === 'removed'
          ? removedScholars.map((item) => item.status)
          : renewals.map((item) => item.renewal_status);

    return [
      'All Statuses',
      ...new Set(source.filter(Boolean)),
    ];
  }, [scholars, removedScholars, renewals, sectionMode]);

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

  const openFilterModal = () => {
    setDraftProgram(program);
    setDraftYear(academicYear);
    setDraftSemester(semester);
    setDraftStatus(status);
    setDraftSortBy(sortBy);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setProgram(draftProgram);
    setAcademicYear(draftYear);
    setSemester(draftSemester);
    setStatus(draftStatus);
    setSortBy(draftSortBy);
    setFilterOpen(false);
    setPage(1);
  };

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

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
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
              {`Canonical renewal records · ${filteredRenewals.length} result${filteredRenewals.length === 1 ? '' : 's'}`}
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
            {Math.min(page * PAGE_SIZE, currentRows.length)} of{' '}
            {currentRows.length}
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

function ScholarRegistryTable({ rows, onView, onRemove, removedMode = false }) {
  const [photoPreview, setPhotoPreview] = useState(null);

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
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (scholar.avatar_url) {
                        setPhotoPreview({
                          src: scholar.avatar_url,
                          name: scholar.student_name || 'Scholar',
                        });
                      }
                    }}
                    disabled={!scholar.avatar_url}
                    className="shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-[var(--portal-base)] focus:ring-offset-2 disabled:cursor-default"
                    aria-label={scholar.avatar_url ? `Enlarge ${scholar.student_name || 'scholar'} profile photo` : 'No profile photo available'}
                  >
                    <Avatar className={`h-10 w-10 rounded-full border border-stone-200 ${scholar.avatar_url ? 'cursor-zoom-in' : ''}`}>
                      <AvatarImage
                        src={scholar.avatar_url || undefined}
                        alt={scholar.student_name}
                        className="rounded-full"
                      />
                      <AvatarFallback className="rounded-full text-xs font-bold">
                        {getInitials(scholar.student_name)}
                      </AvatarFallback>
                    </Avatar>
                  </button>

                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold leading-5 text-stone-900">
                      {scholar.student_name}
                    </p>
                    <p className="mt-0.5 break-all font-mono text-xs text-stone-400">
                      {scholar.student_number}
                    </p>
                  </div>
                </div>
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

      <ProfilePhotoPreviewDialog
        open={Boolean(photoPreview?.src)}
        onOpenChange={(open) => {
          if (!open) setPhotoPreview(null);
        }}
        src={photoPreview?.src || ''}
        name={photoPreview?.name || 'Scholar'}
      />
    </div>
  );
}

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

function itemYear(item) {
  return item?.school_year_label || '';
}
