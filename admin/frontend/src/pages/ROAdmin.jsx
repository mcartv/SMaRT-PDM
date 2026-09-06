import React, { useEffect, useMemo, useState } from 'react';
import { useSocketEvent } from '@/hooks/useSocket';
import { buildApiUrl } from '@/api';
import ROScholarRequestsPanel from './ROScholarRequestsPanel';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';

import PreviewableProfileAvatar from '@/components/profile/PreviewableProfileAvatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import {
  Search,
  RefreshCw,
  Loader2,
  ClipboardCheck,
  Filter,
  X,
  AlertTriangle,
  Send,
  Eye,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
} from 'lucide-react';

const C = {
  brownMid: 'var(--portal-base)',
  brownDark: 'var(--portal-active)',
  brownSoft: 'var(--portal-accent-soft)',
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
  bg: 'var(--portal-main-bg)',
  line: 'var(--portal-border)',
  mutedText: 'var(--portal-muted)',
};

const TOP_TABS = [
  { value: 'assigned', label: 'Assigned' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'requests', label: 'Area Requests' },
];

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function getPlacementApprovalState(scholar = {}) {
  const placements = Array.isArray(scholar.placements) ? scholar.placements : [];
  const statuses = placements.map((placement) =>
    normalizeStatus(placement?.placement_status || placement?.placementStatus)
  );

  return {
    hasApproved: statuses.includes('approved'),
    hasPending: statuses.includes('pending'),
  };
}

// SMART-PDM_RO_ASSIGNMENT_CLASSIFICATION_V1
// ro_id identifies the obligation record itself, not an actual RO assignment.
function hasRoAssignment(scholar = {}) {
  if (typeof scholar.has_active_assignment === 'boolean') {
    return scholar.has_active_assignment;
  }
  if (typeof scholar.hasActiveAssignment === 'boolean') {
    return scholar.hasActiveAssignment;
  }

  const assignmentStatus = normalizeStatus(
    scholar.assignment_status || scholar.assignmentStatus
  );

  const placements = Array.isArray(scholar.placements)
    ? scholar.placements
    : [];

  if (placements.length) {
    return placements.some((placement) => {
      const status = normalizeStatus(
        placement?.placement_status || placement?.placementStatus
      );

      return status === 'pending' || status === 'approved';
    });
  }

  return [
    'pending coordinator approval',
    'assigned',
    'acknowledged',
    'conflict reported',
    'in progress',
    'for validation',
  ].includes(assignmentStatus);
}

function getDepartmentValidationStatus(log = {}) {
  const raw = normalizeStatus(
    log.departmentValidationStatus ||
      log.department_validation_status ||
      log.validationStatus ||
      log.validation_status
  );

  if (raw === 'approved') return 'Approved';
  if (raw === 'returned' || raw === 'rejected') return 'Returned';
  return 'Pending';
}

function getScholarName(scholar) {
  return (
    scholar.name ||
    scholar.student_name ||
    [scholar.first_name, scholar.middle_name, scholar.last_name]
      .filter(Boolean)
      .join(' ') ||
    'Unknown Scholar'
  );
}

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatYearLevel(value) {
  if (!value) return 'N/A';

  const raw = String(value).trim();

  if (raw.toLowerCase().includes('year')) return raw;

  const map = {
    1: '1st Year',
    2: '2nd Year',
    3: '3rd Year',
    4: '4th Year',
    5: '5th Year',
  };

  return map[raw] || `${raw} Year`;
}

function formatDateTime(value) {
  if (!value) return 'N/A';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return 'Invalid date';
  }
}

function formatMinutes(value) {
  const minutes = Math.max(0, Number(value || 0));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours <= 0) return `${mins}m`;
  if (mins <= 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function formatHoursCompact(minutes) {
  const safeMinutes = Math.max(0, Number(minutes || 0));
  const hours = safeMinutes / 60;

  if (Number.isInteger(hours)) return String(hours);

  return hours.toFixed(1).replace(/\.0$/, '');
}

function clampPercent(value) {
  return Math.min(100, Math.max(0, Number(value || 0)));
}

function compactProgressText({
  requiredMinutes,
  submittedMinutes,
  validatedMinutes,
  submittedProgress,
  validatedProgress,
  isCleared,
}) {
  const required = Math.max(0, Number(requiredMinutes || 0));
  const validated = Math.max(0, Number(validatedMinutes || 0));
  const submitted = Math.max(0, Number(submittedMinutes || 0));

  const percent = isCleared
    ? 100
    : Math.max(Number(validatedProgress || 0), Number(submittedProgress || 0));

  const usedMinutes = isCleared ? required : validated > 0 ? validated : submitted;

  return `${clampPercent(percent)}% (${formatHoursCompact(usedMinutes)}/${formatHoursCompact(required)}hrs)`;
}

function getRoMetrics(scholar) {
  const requiredMinutes =
    scholar.requiredMinutes ||
    scholar.required_minutes ||
    Number(scholar.required_hours || scholar.requiredHours || 0) * 60 ||
    0;

  const submittedMinutes =
    scholar.submittedMinutes || scholar.submitted_minutes || 0;

  const validatedMinutes =
    scholar.validatedMinutes || scholar.validated_minutes || 0;

  const submittedProgress =
    scholar.submittedProgress || scholar.submitted_progress || 0;

  const validatedProgress =
    scholar.validatedProgress || scholar.ro_progress || 0;

  const pendingLogCount =
    scholar.pendingLogCount || scholar.pending_log_count || 0;

  const proofCount =
    scholar.proofCount || scholar.proof_count || 0;

  const isCleared =
    scholar.is_cleared === true ||
    normalizeStatus(scholar.ro_status) === 'cleared' ||
    normalizeStatus(scholar.assignment_status) === 'cleared';

  const completedLogs = (Array.isArray(scholar.logs) ? scholar.logs : []).filter(
    (log) => normalizeStatus(log.logStatus || log.log_status) === 'timed out'
  );
  const approvedDepartmentLogs = completedLogs.filter(
    (log) => normalizeStatus(log.departmentValidationStatus || log.department_validation_status) === 'approved'
  );
  const pendingDepartmentLogs = completedLogs.filter((log) => {
    const status = normalizeStatus(
      log.departmentValidationStatus || log.department_validation_status
    );
    return !status || status === 'pending';
  });
  const canMarkCleared =
    !isCleared &&
    requiredMinutes > 0 &&
    validatedMinutes >= requiredMinutes &&
    approvedDepartmentLogs.length > 0 &&
    pendingDepartmentLogs.length === 0;
  const clearanceBlockedReason = isCleared
    ? 'This obligation is already cleared.'
    : completedLogs.length === 0
      ? 'No completed attendance logs yet.'
      : pendingDepartmentLogs.length > 0
        ? 'Waiting for the department head to decide all pending attendance evidence.'
        : validatedMinutes < requiredMinutes
          ? `Only ${formatMinutes(validatedMinutes)} of ${formatMinutes(requiredMinutes)} is department-validated.`
          : approvedDepartmentLogs.length === 0
            ? 'No attendance evidence has been approved by the department head.'
            : '';


  const progressSummary = compactProgressText({
    requiredMinutes,
    submittedMinutes,
    validatedMinutes,
    submittedProgress,
    validatedProgress,
    isCleared,
  });

  return {
    requiredMinutes,
    submittedMinutes,
    validatedMinutes,
    submittedProgress,
    validatedProgress,
    pendingLogCount,
    proofCount,
    isCleared,
    canMarkCleared,
    clearanceBlockedReason,
    progressSummary,
  };
}

function getMainStatusCapsule(scholar) {
  const assignmentStatus = normalizeStatus(
    scholar.assignment_status || scholar.assignmentStatus
  );

  const progressStatus = normalizeStatus(
    scholar.progress_status || scholar.progressStatus
  );

  const roStatus = normalizeStatus(scholar.ro_status);
  const { hasApproved, hasPending } = getPlacementApprovalState(scholar);

  const isCleared =
    scholar.is_cleared === true ||
    roStatus === 'cleared' ||
    assignmentStatus === 'cleared';

  if (isCleared) {
    return { label: 'Cleared', tone: 'green' };
  }

  if (assignmentStatus === 'conflict reported') {
    return { label: 'Conflict', tone: 'red' };
  }

  if (
    assignmentStatus === 'pending coordinator approval' ||
    (hasPending && !hasApproved)
  ) {
    return { label: 'Pending Approval', tone: 'amber' };
  }

  if (assignmentStatus === 'coordinator rejected') {
    return { label: 'Returned by Coordinator', tone: 'red' };
  }

  if (
    assignmentStatus === 'for validation' ||
    progressStatus === 'for validation'
  ) {
    return { label: 'For Validation', tone: 'blue' };
  }

  if (
    assignmentStatus === 'in progress' ||
    progressStatus === 'in progress'
  ) {
    return { label: 'In Progress', tone: 'purple' };
  }

  if (assignmentStatus === 'acknowledged') {
    return { label: 'Acknowledged', tone: 'blue' };
  }

  if (assignmentStatus === 'assigned') {
    return { label: 'Assigned', tone: 'amber' };
  }

  if (!hasRoAssignment(scholar)) {
    return { label: 'Unassigned', tone: 'default' };
  }

  return { label: 'Assigned', tone: 'amber' };
}

function StatusChip({ children, tone = 'default' }) {
  const styles = {
    default: {
      background: '#f5f5f4',
      color: '#57534e',
      border: '1px solid #e7e5e4',
    },
    green: {
      background: C.greenSoft,
      color: C.green,
      border: '1px solid #dcfce7',
    },
    amber: {
      background: C.amberSoft,
      color: C.amber,
      border: '1px solid #fed7aa',
    },
    red: {
      background: C.redSoft,
      color: C.red,
      border: '1px solid #fecaca',
    },
    blue: {
      background: C.blueSoft,
      color: C.blue,
      border: '1px solid #bfdbfe',
    },
    purple: {
      background: C.purpleSoft,
      color: C.purple,
      border: '1px solid #ddd6fe',
    },
  };

  const style = styles[tone] || styles.default;

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
      style={style}
    >
      {children}
    </span>
  );
}

function ProgressLine({ label, value, caption, color }) {
  const percent = clampPercent(value);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-stone-600">{label}</p>
        <p className="text-xs font-medium" style={{ color }}>
          {percent}%
        </p>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>

      <p className="mt-1.5 text-xs font-normal text-stone-400">{caption}</p>
    </div>
  );
}

function EmptyState({ onAssignMode }) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50">
        <ClipboardCheck className="h-6 w-6 text-stone-400" />
      </div>

      <h3 className="text-sm font-semibold text-stone-800">
        No RO scholar records found
      </h3>

      <p className="mt-1 max-w-md text-xs leading-6 text-stone-500">
        Try changing the filters or switch the view.
      </p>

      <Button
        onClick={onAssignMode}
        variant="outline"
        size="sm"
        className="mt-4 rounded-lg border-stone-200 text-xs"
      >
        Show Unassigned
      </Button>
    </div>
  );
}

function ToolbarSegment({ options, value, onChange }) {
  return (
    <div className="inline-flex w-full rounded-xl bg-stone-100 p-1 sm:w-auto">
      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`inline-flex flex-1 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${active
              ? 'bg-white text-stone-900 shadow-sm'
              : 'text-stone-600'
              }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterModal({
  open,
  onClose,
  programs,
  courses,
  yearLevel,
  setYearLevel,
  courseId,
  setCourseId,
  programId,
  setProgramId,
  statusFilter,
  setStatusFilter,
  onReset,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 font-sans backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <Card className="relative w-full max-w-xl overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/80 px-5 py-4">
          <h3 className="text-sm font-semibold text-stone-900">Filter RO Scholars</h3>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="all">All Statuses</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="for_validation">For Validation</option>
                <option value="conflict">Conflict</option>
                <option value="cleared">Cleared</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Year Level
              </label>

              <select
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="all">All Year Levels</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
                <option value="5">5th Year</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Program
              </label>

              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="all">All Programs</option>
                {programs.map((program) => (
                  <option
                    key={program.program_id || program.id}
                    value={program.program_id || program.id}
                  >
                    {program.program_name || program.name || 'Unnamed Program'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Course
              </label>

              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="all">All Courses</option>
                {courses.map((course) => (
                  <option
                    key={course.course_id || course.id}
                    value={course.course_id || course.id}
                  >
                    {course.course_code
                      ? `${course.course_code} - ${course.course_name || ''}`
                      : course.course_name || course.name || 'Unnamed Course'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-stone-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              className="rounded-xl border-stone-200 text-xs"
            >
              Reset
            </Button>

            <Button
              type="button"
              onClick={onClose}
              className="rounded-xl border-none px-5 text-xs font-medium text-white"
              style={{ background: C.brownMid }}
            >
              Apply
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ConfirmClearModal({ open, scholar, loading, onClose, onConfirm }) {
  if (!open || !scholar) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 font-sans backdrop-blur-sm">
      <div className="absolute inset-0" onClick={loading ? undefined : onClose} />
      <Card className="relative w-full max-w-sm rounded-2xl border-stone-200 bg-white shadow-xl">
        <CardContent className="p-5">
          <h3 className="text-base font-semibold text-stone-900">Mark as RO cleared?</h3>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            {getScholarName(scholar)} will be marked as cleared for the current RO requirement.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={onClose}
              className="h-10 rounded-xl border-stone-200 px-4 text-sm"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={loading}
              onClick={onConfirm}
              className="h-10 rounded-xl bg-[var(--portal-base)] px-4 text-sm font-semibold text-white hover:brightness-95"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Mark cleared
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AssignModal({
  open,
  scholar,
  departments = [],
  defaultRequiredHours = 0,
  loading,
  error,
  onClose,
  onSubmit,
}) {
  const hasPlacements =
    Array.isArray(scholar?.placements) && scholar.placements.length > 0;
  const [assignedArea, setAssignedArea] = useState(
    hasPlacements ? '' : scholar?.assigned_area || scholar?.assignedArea || ''
  );
  const [remarks, setRemarks] = useState(scholar?.remarks || '');

  if (!open || !scholar) return null;

  const name = getScholarName(scholar);
  const hasAssignment = Boolean(scholar.ro_id);
  const obligationHours = hasAssignment
    ? Number(scholar.required_hours || scholar.requiredHours || 0)
    : Number(defaultRequiredHours || 0);

  const submit = () => {
    onSubmit({
      applicationId: scholar.application_id || null,
      openingId: scholar.opening_id || null,
      programId: scholar.program_id || null,
      assignedArea,
      remarks,
    });
  };

  const currentDepartmentExists = departments.some(
    (department) => department.department_name === assignedArea
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4 font-sans backdrop-blur-sm">
      <div className="absolute inset-0" onClick={loading ? undefined : onClose} />

      <Card className="relative w-full max-w-xl overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <h3 className="text-sm font-semibold text-stone-900">
            {hasAssignment ? 'Add RO Placement' : 'Send RO Request'}
          </h3>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 px-4 py-3">
            <p className="text-xl font-semibold text-stone-900">{name}</p>
            <p className="mt-1 text-sm text-stone-500">
              {scholar.program_name || 'Scholarship Program'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-stone-400">
                RO Area
              </span>

              <select
                value={assignedArea}
                onChange={(e) => setAssignedArea(e.target.value)}
                className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="">Select an RO Area</option>

                {assignedArea && !currentDepartmentExists ? (
                  <option value={assignedArea}>{assignedArea}</option>
                ) : null}

                {departments.map((department) => (
                  <option
                    key={department.department_id}
                    value={department.department_name}
                    disabled={!department.coordinator}
                  >
                    {department.department_name}
                    {department.coordinator ? ` — ${department.coordinator.name}` : ' — No coordinator'}
                  </option>
                ))}
              </select>
            </label>

            <div className="block">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Required Hours
              </span>

              <div className="flex h-10 items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3">
                <span className="text-sm font-semibold text-stone-800">
                  {obligationHours > 0 ? `${obligationHours} hours total` : 'Not configured'}
                </span>
                <span className="text-[10px] font-medium text-stone-400">
                  {hasAssignment ? 'Shared across all placements' : 'From Obligation settings'}
                </span>
              </div>
            </div>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] font-medium uppercase tracking-wide text-stone-400">
                Remarks
              </span>

              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Optional remarks"
                className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              />
            </label>
          </div>

          {error ? (
            <div className="flex gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-stone-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border-stone-200 text-xs"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={submit}
              disabled={loading || !assignedArea || obligationHours <= 0}
              className="rounded-xl border-none px-5 text-xs font-medium text-white disabled:opacity-50"
              style={{ background: C.brownMid }}
            >
              {loading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Send Request
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BatchAssignModal({
  open,
  selectedCount,
  departments = [],
  defaultRequiredHours = 0,
  loading,
  error,
  onClose,
  onSubmit,
}) {
  const [assignedArea, setAssignedArea] = useState('');
  const [remarks, setRemarks] = useState('');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4 font-sans backdrop-blur-sm">
      <div className="absolute inset-0" onClick={loading ? undefined : onClose} />

      <Card className="relative w-full max-w-xl overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <h3 className="text-sm font-semibold text-stone-900">Send Batch RO Requests</h3>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
            <p className="text-sm font-semibold text-stone-900">
              {selectedCount} selected scholar{selectedCount > 1 ? 's' : ''}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-stone-400">
                RO Area
              </span>

              <select
                value={assignedArea}
                onChange={(e) => setAssignedArea(e.target.value)}
                className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="">Select an RO Area</option>

                {departments.map((department) => (
                  <option
                    key={department.department_id}
                    value={department.department_name}
                    disabled={!department.coordinator}
                  >
                    {department.department_name}
                    {department.coordinator ? ` — ${department.coordinator.name}` : ' — No coordinator'}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-stone-400">
                Required Hours
              </span>

              <div className="flex h-10 items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3">
                <span className="text-sm font-semibold text-stone-700">
                  {defaultRequiredHours > 0 ? `${defaultRequiredHours} hours` : 'Not configured'}
                </span>
                <span className="text-[10px] font-medium text-stone-400">From Obligation settings</span>
              </div>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-stone-400">
                Remarks
              </span>

              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Optional remarks"
                className="w-full resize-none rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              />
            </label>
          </div>

          {error ? (
            <div className="flex gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-stone-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border-stone-200 text-xs"
            >
              Cancel
            </Button>

            <Button
              type="button"
              disabled={
                loading ||
                !assignedArea ||
                selectedCount === 0 ||
                defaultRequiredHours <= 0
              }
              onClick={() => onSubmit({ assignedArea, remarks })}
              className="rounded-xl border-none px-5 text-xs font-medium text-white disabled:opacity-50"
              style={{ background: C.brownMid }}
            >
              {loading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Send
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LogsModal({ open, scholar, loading, error, onClose, onBackToDetails }) {
  if (!open || !scholar) return null;

  const logs = Array.isArray(scholar.logs) ? scholar.logs : [];

  return (
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/35 p-4 font-sans backdrop-blur-sm">
      <div className="absolute inset-0" onClick={loading ? undefined : onClose} />

      <Card className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">RO Logs & Proofs</h3>
            <p className="mt-1 text-sm text-stone-500">{getScholarName(scholar)}</p>
          </div>

          <div className="flex items-center gap-2">
            {typeof onBackToDetails === 'function' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onBackToDetails}
                className="rounded-lg border-stone-200 text-xs"
              >
                Back to Details
              </Button>
            ) : null}

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <CardContent className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          {logs.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-stone-700">No logs yet</p>
            </div>
          ) : (
            logs.map((log) => {
              const status = getDepartmentValidationStatus(log);
              const departmentRemarks =
                log.departmentValidationRemarks ||
                log.department_validation_remarks ||
                log.validationRemarks ||
                log.validation_remarks ||
                '';
              const proofs = Array.isArray(log.proofs) ? log.proofs : [];

              return (
                <div
                  key={log.logId || log.log_id}
                  className="rounded-2xl border border-stone-200 bg-white p-4"
                >
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_320px]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusChip
                          tone={
                            status === 'Approved'
                              ? 'green'
                              : status === 'Returned'
                                ? 'red'
                                : 'amber'
                          }
                        >
                          {status}
                        </StatusChip>

                        <StatusChip tone="default">
                          {log.logStatus || log.log_status || 'Timed Out'}
                        </StatusChip>

                        {log.assignedArea || log.assigned_area ? (
                          <StatusChip tone="blue">
                            {log.assignedArea || log.assigned_area}
                          </StatusChip>
                        ) : null}
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
                        <p>
                          <span className="font-medium text-stone-700">Time In:</span>{' '}
                          <span className="text-stone-500">
                            {formatDateTime(log.timeInAt || log.time_in_at)}
                          </span>
                        </p>

                        <p>
                          <span className="font-medium text-stone-700">Time Out:</span>{' '}
                          <span className="text-stone-500">
                            {formatDateTime(log.timeOutAt || log.time_out_at)}
                          </span>
                        </p>

                        <p>
                          <span className="font-medium text-stone-700">Duration:</span>{' '}
                          <span className="text-stone-500">
                            {formatMinutes(log.durationMinutes || log.duration_minutes)}
                          </span>
                        </p>

                        <p>
                          <span className="font-medium text-stone-700">Validated:</span>{' '}
                          <span className="text-stone-500">
                            {formatMinutes(log.validatedMinutes || log.validated_minutes)}
                          </span>
                        </p>
                      </div>

                      {(log.studentNote || log.student_note) ? (
                        <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">
                          {log.studentNote || log.student_note}
                        </p>
                      ) : null}

                      <div className="mt-4 border-t border-stone-100 pt-4">
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                          Photo Proofs
                        </p>

                        {proofs.length === 0 ? (
                          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-600">
                            No photo proof submitted for this time log.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                            {proofs.map((proof) => {
                              const imageUrl =
                                proof.image_url ||
                                proof.file_url ||
                                proof.proof_url ||
                                proof.photo_url ||
                                null;

                              return (
                                <a
                                  key={proof.proof_id || proof.id || imageUrl}
                                  href={imageUrl || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="group overflow-hidden rounded-xl border border-stone-200 bg-stone-50"
                                >
                                  {imageUrl ? (
                                    <img
                                      src={imageUrl}
                                      alt="RO proof"
                                      className="h-32 w-full object-cover transition-transform group-hover:scale-[1.02]"
                                    />
                                  ) : (
                                    <div className="flex h-32 items-center justify-center text-xs text-stone-400">
                                      No image
                                    </div>
                                  )}

                                  <div className="border-t border-stone-100 px-3 py-2">
                                    <p className="truncate text-[11px] font-medium text-stone-600">
                                      {proof.proof_status || proof.status || 'Uploaded'}
                                    </p>
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {departmentRemarks ? (
                        <div
                          className={`mt-4 rounded-xl border px-3 py-2.5 text-xs ${
                            status === 'Returned'
                              ? 'border-red-100 bg-red-50 text-red-700'
                              : status === 'Approved'
                                ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                : 'border-amber-100 bg-amber-50 text-amber-800'
                          }`}
                        >
                          <p className="font-semibold">Validation Feedback</p>
                          <p className="mt-1 leading-5">{departmentRemarks}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                        Department Validation
                      </p>
                      <div className="mt-3">
                        <StatusChip
                          tone={status === 'Approved' ? 'green' : status === 'Returned' ? 'red' : 'amber'}
                        >
                          {status}
                        </StatusChip>
                      </div>
                      <p className="mt-3 text-xs leading-5 text-stone-500">
                        {status === 'Approved'
                          ? 'The department head validated this attendance evidence. These minutes count toward final OSFA clearance.'
                          : status === 'Returned'
                            ? 'The department head returned this evidence. It does not count toward clearance.'
                            : 'Waiting for the assigned department head to validate the time-in and time-out evidence.'}
                      </p>
                      <div className="mt-4 rounded-xl border border-stone-200 bg-white px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                          Department-validated Minutes
                        </p>
                        <p className="mt-1.5 text-sm font-medium text-stone-900">
                          {formatMinutes(log.validatedMinutes || log.validated_minutes)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {error ? (
            <div className="flex gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function RoDetailsModal({
  open,
  scholar,
  loading,
  onClose,
  onAssign,
  onLogs,
  onClear,
}) {
  if (!open || !scholar) return null;

  const name = getScholarName(scholar);
  const hasAssignment = hasRoAssignment(scholar);
  const placements = Array.isArray(scholar.placements) ? scholar.placements : [];

  const {
    requiredMinutes,
    submittedMinutes,
    submittedProgress,
    validatedMinutes,
    validatedProgress,
    pendingLogCount,
    proofCount,
    isCleared,
    canMarkCleared,
    clearanceBlockedReason,
    progressSummary,
  } = getRoMetrics(scholar);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/35 p-4 font-sans backdrop-blur-sm">
      <div className="absolute inset-0" onClick={loading ? undefined : onClose} />

      <Card className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-stone-800">RO Details</h3>
            <p className="mt-1 text-sm text-stone-500">{name}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CardContent className="flex-1 space-y-4 overflow-y-auto p-5 sm:p-6">
          <div className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-4">
            <PreviewableProfileAvatar
              src={scholar.profile_photo_url || scholar.avatarUrl || scholar.avatar_url || ''}
              name={`${name} profile photo`}
              fallback={getInitials(name)}
              avatarClassName="h-14 w-14 shrink-0 rounded-full border border-stone-200 shadow-sm"
              fallbackClassName="bg-blue-900 text-sm font-medium text-white"
              buttonClassName="rounded-full"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xl font-semibold text-stone-900">{name}</p>
                  <p className="mt-1 font-mono text-xs text-stone-400">
                    {scholar.pdm_id || 'No PDM ID'}
                  </p>
                </div>

                <StatusChip tone={getMainStatusCapsule(scholar).tone}>
                  {getMainStatusCapsule(scholar).label}
                </StatusChip>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-stone-600 sm:grid-cols-2">
                <p>
                  <span className="font-medium text-stone-700">Program:</span>{' '}
                  {scholar.program_name || 'N/A'}
                </p>

                <p>
                  <span className="font-medium text-stone-700">Course:</span>{' '}
                  {scholar.course_code || 'N/A'} · {formatYearLevel(scholar.year_level)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                RO Areas
              </p>
              <p className="mt-1.5 text-sm font-medium text-stone-900">
                {placements.length || (hasAssignment ? 1 : 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Progress
              </p>
              <p className="mt-1.5 text-sm font-medium text-stone-900">
                {hasAssignment ? progressSummary : 'N/A'}
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Logs
              </p>
              <p className="mt-1.5 text-sm font-medium text-stone-900">
                {pendingLogCount > 0 ? `${pendingLogCount} pending` : 'No pending'}
              </p>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Proofs
              </p>
              <p className="mt-1.5 text-sm font-medium text-stone-900">
                {proofCount || 0}
              </p>
            </div>
          </div>

          {scholar.remarks ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                Remarks
              </p>
              <p className="mt-2 text-sm leading-6 text-stone-700">
                {scholar.remarks}
              </p>
            </div>
          ) : null}

          {hasAssignment ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                    Placement Requests
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    Service hours may be completed in one or more approved RO Areas.
                  </p>
                </div>
                <StatusChip tone="blue">
                  {placements.length} {placements.length === 1 ? 'area' : 'areas'}
                </StatusChip>
              </div>

              {placements.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {placements.map((placement) => {
                    const status = placement.placement_status || 'Pending';
                    const statusKey = normalizeStatus(status);
                    const tone =
                      statusKey === 'approved'
                        ? 'green'
                        : statusKey === 'rejected' || statusKey === 'cancelled'
                          ? 'red'
                          : 'amber';

                    return (
                      <div
                        key={placement.placement_id}
                        className="rounded-xl border border-stone-200 bg-stone-50/70 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-stone-800">
                            {placement.assigned_area || 'RO Area'}
                          </p>
                          <StatusChip tone={tone}>{status}</StatusChip>
                        </div>
                        {placement.coordinator_remarks || placement.admin_remarks ? (
                          <p className="mt-2 text-sm leading-6 text-stone-500">
                            {placement.coordinator_remarks || placement.admin_remarks}
                          </p>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl bg-stone-50 px-3 py-2.5 text-sm text-stone-500">
                  This legacy assignment has no separate placement record yet.
                </p>
              )}
            </div>
          ) : null}

          {hasAssignment ? (
            <div className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                    Hours
                  </p>
                  <p className="mt-1.5 text-sm font-medium text-stone-900">
                    {progressSummary}
                  </p>
                </div>

                <StatusChip tone={getMainStatusCapsule(scholar).tone}>
                  {getMainStatusCapsule(scholar).label}
                </StatusChip>
              </div>

              <div className="space-y-4">
                <ProgressLine
                  label="Submitted"
                  value={submittedProgress}
                  color={C.amber}
                  caption={`${formatMinutes(submittedMinutes)} submitted of ${formatMinutes(requiredMinutes)}`}
                />

                <ProgressLine
                  label="Validated"
                  value={validatedProgress}
                  color={C.green}
                  caption={`${formatMinutes(validatedMinutes)} validated of ${formatMinutes(requiredMinutes)}`}
                />
              </div>
            </div>
          ) : null}

          {scholar.conflict_reason || scholar.conflictReason ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-red-500">
                Conflict Reported
              </p>
              <p className="mt-1 text-sm leading-6 text-red-600">
                {scholar.conflict_reason || scholar.conflictReason}
              </p>
            </div>
          ) : null}
          {hasAssignment && !isCleared && !canMarkCleared ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-normal text-amber-800">
              Mark Cleared is locked: {clearanceBlockedReason}
            </div>
          ) : null}
        </CardContent>

        <div className="flex flex-col gap-2 border-t border-stone-100 bg-stone-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onAssign}
            disabled={loading}
            className="h-9 rounded-xl border-stone-200 px-4 text-xs font-medium"
          >
            <Send className="mr-2 h-3.5 w-3.5" />
            {hasAssignment ? 'Add Placement' : 'Assign'}
          </Button>

          {hasAssignment ? (
            <Button
              type="button"
              variant="outline"
              onClick={onLogs}
              disabled={loading}
              className="h-9 rounded-xl border-stone-200 px-4 text-xs font-medium"
            >
              <Eye className="mr-2 h-3.5 w-3.5" />
              Logs & Proofs
            </Button>
          ) : null}

          {hasAssignment && !isCleared ? (
            <Button
              type="button"
              onClick={onClear}
              disabled={loading || !canMarkCleared}
              title={clearanceBlockedReason || 'All required hours were validated by the department head.'}
              className="h-9 rounded-xl border-none px-4 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: C.green }}
            >
              <ShieldCheck className="mr-2 h-3.5 w-3.5" />
              Mark Cleared
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export default function ROAdmin() {
  const token = sessionStorage.getItem('adminToken');

  const [scholars, setScholars] = useState([]);
  const [courses, setCourses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeRoSetting, setActiveRoSetting] = useState(null);

  const [topTab, setTopTab] = useState('assigned');
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('all');
  const [programId, setProgramId] = useState('all');
  const [yearLevel, setYearLevel] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [selectedIds, setSelectedIds] = useState([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchError, setBatchError] = useState('');


  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const [filterOpen, setFilterOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  const [selectedScholar, setSelectedScholar] = useState(null);
  const [detailsScholar, setDetailsScholar] = useState(null);
  const [pendingClearScholar, setPendingClearScholar] = useState(null);
  const [actionError, setActionError] = useState('');

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }),
    [token]
  );

  const activeRequiredHours = Number(activeRoSetting?.required_hours ?? 0);

  const activeFilterCount = [
    programId !== 'all',
    courseId !== 'all',
    yearLevel !== 'all',
    statusFilter !== 'all',
  ].filter(Boolean).length;

  const parseScholarRows = (data) => {
    return Array.isArray(data)
      ? data
      : Array.isArray(data.scholars)
        ? data.scholars
        : Array.isArray(data.data)
          ? data.data
          : [];
  };

  const isBatchSelectable = (scholar) => {
    const assignmentStatus = normalizeStatus(
      scholar.assignment_status || scholar.assignmentStatus
    );

    const roStatus = normalizeStatus(scholar.ro_status);

    const isCleared =
      scholar.is_cleared === true ||
      roStatus === 'cleared' ||
      assignmentStatus === 'cleared';

    return !isCleared;
  };

  const displayedScholars = useMemo(() => {
    const rows = [...scholars];

    return rows.filter((scholar) => {
      const assignmentStatus = normalizeStatus(
        scholar.assignment_status || scholar.assignmentStatus
      );

      const progressStatus = normalizeStatus(
        scholar.progress_status || scholar.progressStatus
      );

      const roStatus = normalizeStatus(scholar.ro_status);

      const isCleared =
        scholar.is_cleared === true ||
        roStatus === 'cleared' ||
        assignmentStatus === 'cleared';

      const hasAssignment = hasRoAssignment(scholar);

      if (topTab === 'unassigned' && hasAssignment) return false;
      if (topTab === 'assigned' && (!hasAssignment || isCleared)) return false;
      if (topTab === 'cleared' && !isCleared) return false;

      const placementState = getPlacementApprovalState(scholar);

      if (statusFilter === 'pending_approval') {
        return (
          assignmentStatus === 'pending coordinator approval' ||
          (placementState.hasPending && !placementState.hasApproved)
        );
      }

      if (statusFilter === 'assigned') {
        return (
          assignmentStatus === 'assigned' &&
          (!placementState.hasPending || placementState.hasApproved)
        );
      }

      if (statusFilter === 'in_progress') {
        return (
          assignmentStatus === 'in progress' ||
          progressStatus === 'in progress'
        );
      }

      if (statusFilter === 'for_validation') {
        return (
          assignmentStatus === 'for validation' ||
          progressStatus === 'for validation'
        );
      }

      if (statusFilter === 'conflict') {
        return assignmentStatus === 'conflict reported';
      }

      if (statusFilter === 'cleared') {
        return isCleared;
      }

      return true;
    });
  }, [scholars, topTab, statusFilter]);

  const selectableScholars = displayedScholars.filter(isBatchSelectable);

  const selectedScholars = scholars.filter((scholar) =>
    selectedIds.includes(String(scholar.student_id))
  );

  const allVisibleSelected =
    selectableScholars.length > 0 &&
    selectableScholars.every((scholar) =>
      selectedIds.includes(String(scholar.student_id))
    );


  const buildScholarQuery = () => {
    const params = new URLSearchParams();

    params.set('status', 'all');

    if (search.trim()) params.set('search', search.trim());
    if (courseId !== 'all') params.set('courseId', courseId);
    if (programId !== 'all') params.set('programId', programId);
    if (yearLevel !== 'all') params.set('yearLevel', yearLevel);

    return params.toString();
  };

  const loadFilterData = async () => {
    try {
      const [coursesRes, openingsRes, departmentsRes, activeSettingRes] =
        await Promise.all([
          fetch(buildApiUrl('/api/courses'), {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(buildApiUrl('/api/program-openings'), {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(buildApiUrl('/api/ro-settings/departments'), {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(buildApiUrl('/api/ro-settings/active'), {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

      const coursesData = await coursesRes.json().catch(() => []);
      const openingsData = await openingsRes.json().catch(() => []);
      const departmentsData = await departmentsRes.json().catch(() => ({}));
      const activeSettingData = await activeSettingRes.json().catch(() => ({}));

      if (coursesRes.ok) {
        setCourses(Array.isArray(coursesData) ? coursesData : coursesData.data || []);
      }

      if (openingsRes.ok) {
        const openingRows = Array.isArray(openingsData)
          ? openingsData
          : openingsData.data || [];

        setPrograms(
          openingRows.reduce((acc, row) => {
            if (!row.program_id) return acc;
            if (acc.some((item) => item.program_id === row.program_id)) return acc;

            acc.push({
              program_id: row.program_id,
              program_name: row.program_name || row.opening_title || 'Unnamed Program',
            });

            return acc;
          }, [])
        );
      }

      if (departmentsRes.ok) {
        const departmentRows = Array.isArray(departmentsData?.items)
          ? departmentsData.items
          : Array.isArray(departmentsData?.data)
            ? departmentsData.data
            : [];

        setDepartments(departmentRows.filter((item) => item.is_active !== false));
      }

      if (activeSettingRes.ok) {
        setActiveRoSetting(
          activeSettingData?.setting ||
          activeSettingData?.data?.setting ||
          activeSettingData?.data ||
          null
        );
      }
    } catch (err) {
      console.error('LOAD RO FILTER DATA ERROR:', err);
    }
  };

  const loadScholars = async ({ initial = false } = {}) => {
    try {
      if (initial) setLoading(true);
      else setFilterLoading(true);

      setError('');

      const query = buildScholarQuery();

      const res = await fetch(buildApiUrl(`/api/ro/scholars?${query}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to load RO scholars');
      }

      const rows = parseScholarRows(data);
      setScholars(rows);

      setSelectedIds((current) => {
        const validIds = new Set(rows.map((row) => String(row.student_id)));
        return current.filter((id) => validIds.has(String(id)));
      });

      setDetailsScholar((current) => {
        if (!current?.student_id) return current;
        return rows.find((row) => row.student_id === current.student_id) || current;
      });

      setSelectedScholar((current) => {
        if (!current?.student_id) return current;
        return rows.find((row) => row.student_id === current.student_id) || current;
      });
    } catch (err) {
      console.error('LOAD RO SCHOLARS ERROR:', err);
      setError(err.message || 'Failed to load RO scholars');
      setScholars([]);
      setSelectedIds([]);
    } finally {
      setLoading(false);
      setFilterLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadFilterData(), loadScholars()]);
  };

  useEffect(() => {
    loadFilterData();
    loadScholars({ initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadScholars();
    }, 350);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, courseId, programId, yearLevel]);

  useSocketEvent(
    'ro:updated',
    () => {
      refreshAll();
    },
    [search, courseId, programId, yearLevel, topTab, statusFilter]
  );

  useSocketEvent(
    'roUpdated',
    () => {
      refreshAll();
    },
    [search, courseId, programId, yearLevel, topTab, statusFilter]
  );

  const handleResetFilters = () => {
    setSearch('');
    setCourseId('all');
    setProgramId('all');
    setYearLevel('all');
    setStatusFilter('all');
  };

  const toggleSelected = (studentId) => {
    const id = String(studentId);

    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = selectableScholars.map((scholar) => String(scholar.student_id));

    setSelectedIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return [...new Set([...current, ...visibleIds])];
    });
  };


  const closeAllModals = () => {
    setAssignModalOpen(false);
    setLogsModalOpen(false);
    setDetailsModalOpen(false);
    setActionError('');
  };

  const openAssignModal = (scholar) => {
    closeAllModals();
    setSelectedScholar(scholar);
    setAssignModalOpen(true);
  };

  const openDetailsModal = (scholar) => {
    closeAllModals();
    setDetailsScholar(scholar);
    setDetailsModalOpen(true);
  };

  const closeAssignModal = () => {
    if (actionLoading) return;
    setAssignModalOpen(false);
    setSelectedScholar(null);
    setActionError('');
  };

  const closeLogsModal = () => {
    if (actionLoading) return;
    setLogsModalOpen(false);
    setSelectedScholar(null);
    setActionError('');
  };

  const closeDetailsModal = () => {
    if (actionLoading) return;
    setDetailsModalOpen(false);
    setDetailsScholar(null);
    setActionError('');
  };

  const openAssignFromDetails = () => {
    if (!detailsScholar) return;
    setDetailsModalOpen(false);
    setSelectedScholar(detailsScholar);
    setAssignModalOpen(true);
  };

  const openLogsFromDetails = () => {
    if (!detailsScholar) return;
    setDetailsModalOpen(false);
    setSelectedScholar(detailsScholar);
    setLogsModalOpen(true);
  };

  const backToDetailsFromLogs = () => {
    if (!selectedScholar) return;
    setLogsModalOpen(false);
    setDetailsScholar(selectedScholar);
    setDetailsModalOpen(true);
  };

  const handleAssign = async (payload) => {
    if (!selectedScholar?.student_id) return;

    try {
      setActionLoading(true);
      setActionError('');

      const res = await fetch(
        buildApiUrl(`/api/ro/scholars/${selectedScholar.student_id}/assign`),
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            ...payload,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to assign RO');
      }

      setAssignModalOpen(false);
      setSelectedScholar(null);
      await refreshAll();
    } catch (err) {
      console.error('ASSIGN RO ERROR:', err);
      setActionError(err.message || 'Failed to assign RO');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchAssign = async ({ assignedArea, remarks }) => {
    try {
      setActionLoading(true);
      setBatchError('');

      const assignableIds = selectedScholars
        .filter(isBatchSelectable)
        .map((scholar) => String(scholar.student_id));

      if (!assignableIds.length) {
        throw new Error('Select at least one assignable scholar.');
      }

      if (!assignedArea) {
        throw new Error('Select an RO department.');
      }

      const res = await fetch(buildApiUrl('/api/ro/scholars/batch-assign'), {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          studentIds: assignableIds,
          assignedArea,
          remarks,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to batch assign RO.');
      }

      if (Number(data.failed_count || 0) > 0) {
        setBatchError(
          `${data.success_count || 0} requests sent, ${data.failed_count || 0} failed.`
        );
      } else {
        setBatchModalOpen(false);
        setSelectedIds([]);
      }

      await refreshAll();
    } catch (err) {
      console.error('BATCH ASSIGN RO ERROR:', err);
      setBatchError(err.message || 'Failed to batch assign RO.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClear = async (scholar) => {
    if (!scholar?.student_id) return;

    try {
      setActionLoading(true);
      setActionError('');

      const res = await fetch(buildApiUrl(`/api/ro/scholars/${scholar.student_id}/clear`), {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          applicationId: scholar.application_id || null,
          openingId: scholar.opening_id || null,
          programId: scholar.program_id || null,
          remarks: 'Marked as cleared by RO admin.',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to clear scholar');
      }

      setPendingClearScholar(null);
      setDetailsModalOpen(false);
      setLogsModalOpen(false);
      setSelectedScholar(null);
      setDetailsScholar(null);

      await refreshAll();
    } catch (err) {
      console.error('CLEAR RO ERROR:', err);
      setError(err.message || 'Failed to clear scholar');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <PageLoadingSkeleton label="Loading Return of Obligation administration" showStats />;
  }

  return (
    <div className="space-y-4 px-1 py-3 font-sans" style={{ background: C.bg }}>
      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        programs={programs}
        courses={courses}
        programId={programId}
        setProgramId={setProgramId}
        courseId={courseId}
        setCourseId={setCourseId}
        yearLevel={yearLevel}
        setYearLevel={setYearLevel}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onReset={handleResetFilters}
      />

      <AssignModal
        key={
          assignModalOpen
            ? selectedScholar?.student_id || selectedScholar?.ro_id || 'open'
            : 'closed'
        }
        open={assignModalOpen}
        scholar={selectedScholar}
        departments={departments}
        defaultRequiredHours={activeRequiredHours}
        loading={actionLoading}
        error={actionError}
        onClose={closeAssignModal}
        onSubmit={handleAssign}
      />

      <BatchAssignModal
        key={batchModalOpen ? 'batch-open' : 'batch-closed'}
        open={batchModalOpen}
        selectedCount={selectedIds.length}
        departments={departments}
        defaultRequiredHours={activeRequiredHours}
        loading={actionLoading}
        error={batchError}
        onClose={() => {
          if (actionLoading) return;
          setBatchModalOpen(false);
          setBatchError('');
        }}
        onSubmit={handleBatchAssign}
      />

      <LogsModal
        open={logsModalOpen}
        scholar={selectedScholar}
        loading={actionLoading}
        error={actionError}
        onClose={closeLogsModal}
        onBackToDetails={backToDetailsFromLogs}
      />

      <RoDetailsModal
        open={detailsModalOpen}
        scholar={detailsScholar}
        loading={actionLoading}
        onClose={closeDetailsModal}
        onAssign={openAssignFromDetails}
        onLogs={openLogsFromDetails}
        onClear={() => {
          if (!detailsScholar) return;
          setActionError('');
          setPendingClearScholar(detailsScholar);
        }}
      />

      <ConfirmClearModal
        open={Boolean(pendingClearScholar)}
        scholar={pendingClearScholar}
        loading={actionLoading}
        onClose={() => {
          if (!actionLoading) setPendingClearScholar(null);
        }}
        onConfirm={() => {
          if (pendingClearScholar) handleClear(pendingClearScholar);
        }}
      />

      <section className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          {topTab !== 'requests' ? (
          <div className="relative w-full xl:max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />

              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by scholar name or PDM ID..."
                className="h-10 rounded-xl border-stone-200 bg-stone-50 pl-10 text-sm"
              />
          </div>
          ) : (
            <div>
              <p className="text-sm font-semibold text-stone-900">RO Area Requests</p>
              <p className="mt-1 text-sm text-stone-500">
                Review offices requesting scholars for RO service.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <ToolbarSegment
              options={TOP_TABS}
              value={topTab}
              onChange={setTopTab}
            />

            {topTab !== 'requests' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFilterOpen(true)}
              className="h-10 rounded-xl border-stone-200 bg-white px-3 text-sm font-medium text-stone-700"
            >
              <SlidersHorizontal className="mr-2 h-4 w-4" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
            ) : null}

            <Button
              onClick={() => refreshAll()}
              variant="outline"
              size="sm"
              className="h-10 rounded-xl border-stone-200 bg-white px-3 text-sm font-medium text-stone-700"
              disabled={filterLoading}
            >
              {filterLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>

          </div>
        </div>
      </section>

      {error ? (
        <div className="flex gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {activeRequiredHours <= 0 && topTab !== 'requests' ? (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Set and activate the required hours in Maintenance &gt; Obligation before sending RO requests.
          </span>
        </div>
      ) : null}

      {topTab === 'requests' ? (
        <ROScholarRequestsPanel token={token} />
      ) : (
      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <h2 className="truncate text-sm font-semibold leading-5 text-stone-900">
            {topTab === 'assigned'
              ? 'Assigned RO Scholars'
              : topTab === 'unassigned'
                ? 'Unassigned RO Scholars'
                : 'Cleared RO Scholars'}
          </h2>

          {!['cleared', 'requests'].includes(topTab) ? (
            <Button
              type="button"
              onClick={() => {
                setBatchError('');
                setBatchModalOpen(true);
              }}
              size="sm"
              disabled={selectedIds.length === 0 || activeRequiredHours <= 0}
              className="h-9 rounded-xl border-none px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-45"
              style={{ background: C.brownMid }}
            >
              <Send className="mr-2 h-4 w-4" />
              {selectedIds.length > 0
                ? `Batch Assign (${selectedIds.length})`
                : 'Batch Assign'}
            </Button>
          ) : null}
        </div>

        <CardContent className="p-4">
          {displayedScholars.length === 0 ? (
            <EmptyState onAssignMode={() => setTopTab('unassigned')} />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/70">
                    {topTab !== 'cleared' ? (
                      <th className="w-[44px] px-3 py-3 text-left text-xs font-semibold text-stone-900">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                          aria-label="Select all visible scholars"
                        />
                      </th>
                    ) : null}

                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">
                      Scholar
                    </th>

                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">
                      Program
                    </th>

                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">
                      Department
                    </th>

                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">
                      Progress
                    </th>

                    <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">
                      Status
                    </th>

                    <th className="min-w-[140px] px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-700">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-100 bg-white">
                  {displayedScholars.map((scholar) => {
                    const key = `${scholar.student_id}-${scholar.application_id || scholar.ro_id || 'ro'}`;
                    const name = getScholarName(scholar);
                    const hasAssignment = hasRoAssignment(scholar);

                    const selectable = isBatchSelectable(scholar);
                    const selected = selectedIds.includes(String(scholar.student_id));

                    const {
                      requiredMinutes,
                      submittedMinutes,
                      validatedMinutes,
                      submittedProgress,
                      validatedProgress,
                      isCleared,
                    } = getRoMetrics(scholar);

                    const capsule = getMainStatusCapsule(scholar);

                    return (
                      <tr key={key} className="transition-colors hover:bg-stone-50/70">
                        {topTab !== 'cleared' ? (
                          <td className="px-3 py-4 align-top">
                            <input
                              type="checkbox"
                              disabled={!selectable}
                              checked={selected}
                              onChange={() => toggleSelected(scholar.student_id)}
                              aria-label={`Select ${name}`}
                            />
                          </td>
                        ) : null}

                        <td className="px-3 py-4 align-top">
                          <div className="flex items-start gap-3">
                            <PreviewableProfileAvatar
                              src={scholar.profile_photo_url || scholar.avatarUrl || scholar.avatar_url || ''}
                              name={`${name} profile photo`}
                              fallback={getInitials(name)}
                              avatarClassName="h-10 w-10 shrink-0 rounded-full border border-stone-200 shadow-sm"
                              fallbackClassName="bg-blue-900 text-xs font-bold text-white"
                              buttonClassName="rounded-full"
                            />

                            <div className="min-w-0">
                              <p className="max-w-[220px] truncate text-sm font-semibold leading-5 text-stone-900">
                                {name}
                              </p>
                              <p className="mt-0.5 text-xs font-mono text-stone-400">
                                {scholar.pdm_id || 'No PDM ID'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-4 align-top">
                          <p className="max-w-[240px] text-sm leading-5 text-stone-700">
                            {scholar.program_name || 'N/A'}
                          </p>
                          <p className="mt-0.5 text-[10px] text-stone-400">
                            {scholar.course_code || 'N/A'} · {formatYearLevel(scholar.year_level)}
                          </p>
                        </td>

                        <td className="px-3 py-4 align-top">
                          {hasAssignment ? (
                            <p className="max-w-[220px] text-sm leading-5 text-stone-700">
                              {scholar.assigned_area || scholar.assignedArea || 'No assigned area'}
                            </p>
                          ) : (
                            <p className="text-sm text-stone-400">
                              Not assigned
                            </p>
                          )}
                        </td>

                        <td className="px-3 py-4 align-top">
                          {hasAssignment ? (
                            <p className="text-sm font-semibold text-stone-700">
                              {compactProgressText({
                                requiredMinutes,
                                submittedMinutes,
                                validatedMinutes,
                                submittedProgress,
                                validatedProgress,
                                isCleared,
                              })}
                            </p>
                          ) : (
                            <p className="text-xs text-stone-400">N/A</p>
                          )}
                        </td>

                        <td className="px-3 py-4 align-top">
                          <StatusChip tone={capsule.tone}>{capsule.label}</StatusChip>
                        </td>

                        <td className="min-w-[140px] px-3 py-4 text-right align-top">
                          <Button
                            type="button"
                            onClick={() =>
                              hasAssignment
                                ? openDetailsModal(scholar)
                                : openAssignModal(scholar)
                            }
                            variant="outline"
                            size="sm"
                            disabled={actionLoading || (!hasAssignment && activeRequiredHours <= 0)}
                            title={
                              !hasAssignment && activeRequiredHours <= 0
                                ? 'Configure required hours in Maintenance > Obligation first.'
                                : undefined
                            }
                            className="h-9 rounded-lg border-stone-200 px-3.5 text-xs whitespace-nowrap"
                          >
                            {hasAssignment ? (
                              <>
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                View
                              </>
                            ) : (
                              <>
                                <Send className="mr-1.5 h-3.5 w-3.5" />
                                Assign
                              </>
                            )}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        <div className="flex items-center justify-between border-t border-stone-100 px-5 py-3">
          <p className="text-xs text-stone-400">
            Showing {displayedScholars.length ? `1-${displayedScholars.length}` : '0-0'} of {displayedScholars.length}
          </p>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled
              className="h-8 w-8 rounded-full border-stone-200 text-stone-400 disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <span className="text-xs text-stone-500">Page 1 / 1</span>

            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled
              className="h-8 w-8 rounded-full border-stone-200 text-stone-400 disabled:opacity-50"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </section>
      )}
    </div>
  );
}

