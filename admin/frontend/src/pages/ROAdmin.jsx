import React, { useEffect, useMemo, useState } from 'react';
import { useSocketEvent } from '@/hooks/useSocket';
import { buildApiUrl } from '@/api';
import ROScholarRequestsPanel from './ROScholarRequestsPanel';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  brownMid: '#7c4a2e',
  brownDark: '#5d3400',
  brownSoft: '#f5ede2',
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
  bg: '#faf7f2',
  line: '#e7e5e4',
  mutedText: '#78716c',
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

function getActivePlacements(scholar) {
  const placements = Array.isArray(scholar?.placements)
    ? scholar.placements
    : [];

  return placements.filter((placement) => {
    const status = normalizeStatus(
      placement.placement_status || placement.status
    );

    return status === 'pending' || status === 'approved';
  });
}

function hasActiveRoPlacement(scholar) {
  if (getActivePlacements(scholar).length > 0) {
    return true;
  }

  // Legacy fallback: older genuine assignments may have assigned_area set
  // even when they predate the ro_placements workflow.
  const assignedArea = String(
    scholar?.assigned_area || scholar?.assignedArea || ''
  ).trim();

  return Boolean(assignedArea);
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

  const isCleared =
    scholar.is_cleared === true ||
    roStatus === 'cleared' ||
    assignmentStatus === 'cleared';

  if (isCleared) {
    return { label: 'Cleared', tone: 'green' };
  }

  /*
   * A return_of_obligations row represents the semester RO cycle.
   * It does NOT mean the scholar has already been assigned to an RO area.
   * Only an active placement (or legacy assigned_area) makes it assigned.
   */
  if (!hasActiveRoPlacement(scholar)) {
    return { label: 'Unassigned', tone: 'default' };
  }

  if (assignmentStatus === 'conflict reported') {
    return { label: 'Conflict', tone: 'red' };
  }

  if (assignmentStatus === 'pending coordinator approval') {
    return { label: 'Coordinator Approval', tone: 'blue' };
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
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold whitespace-nowrap"
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
        <p className="text-xs font-bold text-stone-700">{label}</p>
        <p className="text-xs font-black" style={{ color }}>
          {percent}%
        </p>
      </div>

      <div className="h-2.5 overflow-hidden rounded-full bg-stone-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, background: color }}
        />
      </div>

      <p className="mt-1 text-[11px] font-medium text-stone-400">{caption}</p>
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
    <div className="inline-flex shrink-0 items-center rounded-lg border border-stone-200 bg-[#f8f6f2] p-0.5">
      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-all ${
              active
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
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
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                Status
              </label>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="all">All Statuses</option>
                <option value="in_progress">In Progress</option>
                <option value="for_validation">For Validation</option>
                <option value="conflict">Conflict</option>
                <option value="cleared">Cleared</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-stone-400">
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
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-stone-400">
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
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-stone-400">
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
              className="rounded-xl border-none px-5 text-xs font-bold text-white"
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
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
            <p className="text-sm font-black text-stone-900">{name}</p>
            <p className="mt-0.5 text-xs text-stone-500">
              {scholar.program_name || 'Scholarship Program'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-stone-400">
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
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-stone-400">
                Required Hours
              </span>

              <div className="flex h-10 items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3">
                <span className="text-sm font-bold text-stone-800">
                  {obligationHours > 0 ? `${obligationHours} hours total` : 'Not configured'}
                </span>
                <span className="text-[10px] font-semibold text-stone-400">
                  {hasAssignment ? 'Shared across all placements' : 'From Obligation settings'}
                </span>
              </div>
            </div>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-stone-400">
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
              className="rounded-xl border-none px-5 text-xs font-bold text-white disabled:opacity-50"
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
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
            <p className="text-sm font-black text-stone-900">
              {selectedCount} selected scholar{selectedCount > 1 ? 's' : ''}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-stone-400">
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
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-stone-400">
                Required Hours
              </span>

              <div className="flex h-10 items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-3">
                <span className="text-sm font-bold text-stone-800">
                  {defaultRequiredHours > 0 ? `${defaultRequiredHours} hours` : 'Not configured'}
                </span>
                <span className="text-[10px] font-semibold text-stone-400">From Obligation settings</span>
              </div>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-stone-400">
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
              className="rounded-xl border-none px-5 text-xs font-bold text-white disabled:opacity-50"
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
    <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={loading ? undefined : onClose} />

      <Card className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">RO Logs & Proofs</h3>
            <p className="mt-1 text-xs text-stone-500">{getScholarName(scholar)}</p>
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

        <CardContent className="flex-1 space-y-4 overflow-y-auto p-5">
          {logs.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-stone-700">No logs yet</p>
            </div>
          ) : (
            logs.map((log) => {
              const status =
                log.departmentValidationStatus ||
                log.department_validation_status ||
                'Pending';
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
                              : status === 'Rejected'
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
                          <span className="font-bold text-stone-700">Time In:</span>{' '}
                          <span className="text-stone-500">
                            {formatDateTime(log.timeInAt || log.time_in_at)}
                          </span>
                        </p>

                        <p>
                          <span className="font-bold text-stone-700">Time Out:</span>{' '}
                          <span className="text-stone-500">
                            {formatDateTime(log.timeOutAt || log.time_out_at)}
                          </span>
                        </p>

                        <p>
                          <span className="font-bold text-stone-700">Duration:</span>{' '}
                          <span className="text-stone-500">
                            {formatMinutes(log.durationMinutes || log.duration_minutes)}
                          </span>
                        </p>

                        <p>
                          <span className="font-bold text-stone-700">Validated:</span>{' '}
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
                        <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-stone-400">
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
                        <p className={`mt-4 rounded-lg px-3 py-2 text-xs ${status === 'Returned' ? 'bg-red-50 text-red-600' : 'bg-stone-50 text-stone-600'}`}>
                          {departmentRemarks}
                        </p>
                      ) : null}
                    </div>

                    <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
                      <p className="text-[10px] font-black uppercase tracking-wide text-stone-400">
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
                        <p className="text-[10px] font-black uppercase tracking-wide text-stone-400">
                          Department-validated Minutes
                        </p>
                        <p className="mt-1 text-sm font-black text-stone-900">
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
  const hasAssignment = !!scholar.ro_id;
  const placements = Array.isArray(scholar.placements) ? scholar.placements : [];
  const statusCapsule = getMainStatusCapsule(scholar);

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
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/35 p-3 backdrop-blur-sm">
      <div
        className="absolute inset-0"
        onClick={loading ? undefined : onClose}
      />

      <Card className="relative flex max-h-[calc(100vh-24px)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border-stone-200 bg-white shadow-xl">
        {/* Compact fixed header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-stone-100 bg-stone-50/70 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-stone-900">RO Details</h3>
            <p className="mt-0.5 truncate text-xs text-stone-500">{name}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scroll only inside the modal body when the screen is very short. */}
        <CardContent className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
          {/* Scholar identity */}
          <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50/70 px-3 py-2.5">
            <Avatar className="h-10 w-10 shrink-0 rounded-full border border-stone-200 shadow-sm">
              <AvatarImage
                src={
                  scholar.profile_photo_url ||
                  scholar.avatarUrl ||
                  scholar.avatar_url ||
                  undefined
                }
                alt={name}
              />
              <AvatarFallback className="bg-blue-900 text-xs font-semibold text-white">
                {getInitials(name)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-900">
                    {name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-stone-500">
                    {scholar.pdm_id || 'No PDM ID'}
                  </p>
                </div>

                <StatusChip tone={statusCapsule.tone}>
                  {statusCapsule.label}
                </StatusChip>
              </div>

              <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-stone-600 sm:grid-cols-2">
                <p className="truncate">
                  <span className="font-semibold text-stone-800">Program:</span>{' '}
                  {scholar.program_name || 'N/A'}
                </p>

                <p className="truncate">
                  <span className="font-semibold text-stone-800">Course:</span>{' '}
                  {scholar.course_code || 'N/A'} · {formatYearLevel(scholar.year_level)}
                </p>
              </div>
            </div>
          </div>

          {/* Compact metrics */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              {
                label: 'RO Areas',
                value: placements.length || (hasAssignment ? 1 : 0),
              },
              {
                label: 'Progress',
                value: hasAssignment ? progressSummary : 'N/A',
              },
              {
                label: 'Logs',
                value: pendingLogCount > 0 ? `${pendingLogCount} pending` : 'No pending',
              },
              {
                label: 'Proofs',
                value: proofCount || 0,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-stone-200 bg-white px-3 py-2"
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  {item.label}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-stone-900">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {scholar.remarks ? (
            <div className="rounded-lg border border-stone-200 bg-white px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                Remarks
              </p>
              <p className="mt-1 text-xs leading-5 text-stone-600">
                {scholar.remarks}
              </p>
            </div>
          ) : null}

          {hasAssignment ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {/* Placement Requests */}
              <div className="min-w-0 rounded-xl border border-stone-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                      Placement Requests
                    </p>
                    <p className="mt-0.5 truncate text-xs text-stone-500">
                      Current approved/pending RO area placement.
                    </p>
                  </div>

                  <StatusChip tone="blue">
                    {placements.length} {placements.length === 1 ? 'area' : 'areas'}
                  </StatusChip>
                </div>

                {placements.length > 0 ? (
                  <div className="max-h-36 space-y-1.5 overflow-y-auto pr-0.5">
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
                          className="rounded-lg border border-stone-200 bg-stone-50/70 px-2.5 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="min-w-0 flex-1 truncate text-xs font-semibold text-stone-900">
                              {placement.assigned_area || 'RO Area'}
                            </p>
                            <StatusChip tone={tone}>{status}</StatusChip>
                          </div>

                          {placement.coordinator_remarks || placement.admin_remarks ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-4 text-stone-500">
                              {placement.coordinator_remarks || placement.admin_remarks}
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">
                    This assignment has no separate placement record yet.
                  </p>
                )}
              </div>

              {/* Hours */}
              <div className="min-w-0 rounded-xl border border-stone-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                      Hours
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-stone-900">
                      {progressSummary}
                    </p>
                  </div>

                  <StatusChip tone={statusCapsule.tone}>
                    {statusCapsule.label}
                  </StatusChip>
                </div>

                <div className="space-y-2.5">
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
            </div>
          ) : null}

          {scholar.conflict_reason || scholar.conflictReason ? (
            <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-red-500">
                Conflict Reported
              </p>
              <p className="mt-1 text-xs leading-4 text-red-600">
                {scholar.conflict_reason || scholar.conflictReason}
              </p>
            </div>
          ) : null}

          {hasAssignment && !isCleared && !canMarkCleared ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Mark Cleared is locked: {clearanceBlockedReason}
            </div>
          ) : null}
        </CardContent>

        {/* Compact fixed footer */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-stone-100 bg-stone-50/80 px-3 py-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onAssign}
            disabled={loading}
            className="h-8 rounded-lg border-stone-200 px-3 text-xs"
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {hasAssignment ? 'Add Placement' : 'Assign'}
          </Button>

          {hasAssignment ? (
            <Button
              type="button"
              variant="outline"
              onClick={onLogs}
              disabled={loading}
              className="h-8 rounded-lg border-stone-200 px-3 text-xs"
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Logs & Proofs
            </Button>
          ) : null}

          {hasAssignment && !isCleared ? (
            <Button
              type="button"
              onClick={onClear}
              disabled={loading || !canMarkCleared}
              title={
                clearanceBlockedReason ||
                'All required hours were validated by the department head.'
              }
              className="h-8 rounded-lg border-none px-3 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50"
              style={{ background: C.green }}
            >
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
              Mark Cleared
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function FeedbackModal({
  open,
  title,
  message,
  details = [],
  tone = 'info',
  onClose,
}) {
  if (!open) return null;

  const toneClasses = {
    info: 'border-blue-200 bg-blue-50 text-blue-800',
    success: 'border-green-200 bg-green-50 text-green-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    error: 'border-red-200 bg-red-50 text-red-800',
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md overflow-hidden rounded-xl border-stone-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-stone-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-stone-900">
            {title}
          </h3>
        </div>

        <CardContent className="space-y-3 p-4">
          <div
            className={`rounded-lg border px-3.5 py-3 ${toneClasses[tone] || toneClasses.info
              }`}
          >
            <p className="text-sm leading-relaxed">
              {message}
            </p>

            {details.length > 0 && (
              <div className="mt-2 space-y-1 border-t border-current/10 pt-2">
                {details.map((detail, index) => (
                  <p
                    key={`${detail}-${index}`}
                    className="text-xs leading-relaxed"
                  >
                    {detail}
                  </p>
                ))}
              </div>
            )}
          </div>
        </CardContent>

        <div className="flex justify-end border-t border-stone-100 bg-stone-50 px-4 py-3">
          <Button
            type="button"
            size="sm"
            onClick={onClose}
            className="h-8 bg-stone-900 px-4 text-xs text-white hover:bg-stone-800"
          >
            OK
          </Button>
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
  const [actionError, setActionError] = useState('');
  const [feedbackModal, setFeedbackModal] = useState(null);

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

    if (isCleared) return false;

    // A scholar may only have one active RO placement in the current semester.
    // Pending and Approved placements are considered active.
    return !hasActiveRoPlacement(scholar);
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

      const hasActivePlacement = hasActiveRoPlacement(scholar);

      if (topTab === 'unassigned' && (hasActivePlacement || isCleared)) {
        return false;
      }

      if (topTab === 'assigned' && (!hasActivePlacement || isCleared)) {
        return false;
      }

      if (topTab === 'cleared' && !isCleared) return false;

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

      const message = err.message || 'Failed to assign RO';
      const normalizedMessage = normalizeStatus(message);
      const isAlreadyAssigned =
        normalizedMessage.includes('already assigned') ||
        normalizedMessage.includes('active ro placement') ||
        normalizedMessage.includes('active placement') ||
        normalizedMessage.includes('already has');

      if (isAlreadyAssigned) {
        setAssignModalOpen(false);

        setFeedbackModal({
          tone: 'warning',
          title: 'Scholar already assigned',
          message,
          details: [
            'A scholar can only have one active RO placement per semester.',
            'Cancel or reject the existing placement before assigning another RO area.',
          ],
        });
      } else {
        setActionError(message);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleBatchAssign = async ({ assignedArea, remarks }) => {
    try {
      setActionLoading(true);
      setBatchError('');

      if (!assignedArea) {
        throw new Error('Select an RO department.');
      }

      if (!selectedScholars.length) {
        throw new Error('Select at least one scholar.');
      }

      /*
       * IMPORTANT:
       * Do not silently reuse an existing RO and create another ro_placements
       * row for a scholar who already has a Pending/Approved placement.
       *
       * We reject the whole batch when at least one selected scholar is
       * already assigned. This makes the operation predictable and prevents
       * accidental duplicate placements.
       */
      const alreadyAssigned = selectedScholars.filter(hasActiveRoPlacement);

      if (alreadyAssigned.length > 0) {
        const names = alreadyAssigned.map(getScholarName);

        setBatchModalOpen(false);
        setSelectedIds([]);

        setFeedbackModal({
          tone: 'warning',
          title:
            alreadyAssigned.length === 1
              ? 'Scholar already assigned'
              : 'Some scholars are already assigned',
          message:
            alreadyAssigned.length === 1
              ? `${names[0]} already has an active RO placement for the current semester.`
              : `${alreadyAssigned.length} selected scholars already have active RO placements for the current semester.`,
          details: [
            ...names.slice(0, 5).map(
              (name) => `${name} — already assigned`
            ),
            ...(names.length > 5
              ? [`+${names.length - 5} more scholar(s)`]
              : []),
            'A scholar can only have one active RO placement per semester.',
            'Cancel or reject the existing placement before assigning the scholar to another RO area.',
          ],
        });

        return;
      }

      const assignableIds = selectedScholars
        .filter(isBatchSelectable)
        .map((scholar) => String(scholar.student_id));

      if (!assignableIds.length) {
        setBatchModalOpen(false);
        setSelectedIds([]);

        setFeedbackModal({
          tone: 'warning',
          title: 'No assignable scholars',
          message:
            'None of the selected scholars can receive a new RO assignment.',
          details: [
            'Cleared scholars and scholars with an active Pending or Approved placement cannot be batch assigned again.',
          ],
        });

        return;
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
        throw new Error(
          data.error ||
          data.message ||
          'Failed to batch assign RO.'
        );
      }

      const failedRows = Array.isArray(data.failed)
        ? data.failed
        : Array.isArray(data.failures)
          ? data.failures
          : Array.isArray(data.data?.failed)
            ? data.data.failed
            : [];

      const successfulRows = Array.isArray(data.successful)
        ? data.successful
        : Array.isArray(data.data?.successful)
          ? data.data.successful
          : [];

      const successCount = Number(
        data.success_count ??
        data.data?.success_count ??
        successfulRows.length ??
        0
      );

      const failedCount = Number(
        data.failed_count ??
        data.data?.failed_count ??
        failedRows.length ??
        0
      );

      const duplicateFailures = failedRows.filter((item) => {
        const reason = normalizeStatus(
          item?.error || item?.message || item?.reason
        );

        return (
          reason.includes('already assigned') ||
          reason.includes('active ro placement') ||
          reason.includes('active placement') ||
          reason.includes('already has')
        );
      });

      setBatchModalOpen(false);
      setSelectedIds([]);

      if (failedCount > 0 && successCount === 0) {
        const firstDuplicate = duplicateFailures[0];
        const firstFailure = failedRows[0];

        const serverMessage =
          firstDuplicate?.error ||
          firstDuplicate?.message ||
          firstDuplicate?.reason ||
          firstFailure?.error ||
          firstFailure?.message ||
          firstFailure?.reason ||
          'The selected scholar could not be assigned.';

        setFeedbackModal({
          tone: duplicateFailures.length > 0 ? 'warning' : 'error',
          title:
            duplicateFailures.length > 0
              ? 'Scholar already assigned'
              : 'Batch assignment failed',
          message: serverMessage,
          details:
            duplicateFailures.length > 0
              ? [
                  'A scholar can only have one active RO placement per semester.',
                  'Cancel or reject the existing placement before assigning another RO area.',
                ]
              : [],
        });
      } else if (failedCount > 0) {
        setFeedbackModal({
          tone: 'warning',
          title: 'Batch assignment completed with issues',
          message: `${successCount} scholar(s) were assigned and ${failedCount} scholar(s) were skipped.`,
          details: failedRows.slice(0, 5).map((item) => {
            const name =
              item?.student_name ||
              item?.name ||
              item?.student_id ||
              'Scholar';

            const reason =
              item?.error ||
              item?.message ||
              item?.reason ||
              'Assignment failed.';

            return `${name}: ${reason}`;
          }),
        });
      } else {
        setFeedbackModal({
          tone: 'success',
          title: 'RO assignment completed',
          message: `${successCount || assignableIds.length} scholar(s) were successfully assigned to ${assignedArea}.`,
        });
      }

      await refreshAll();
    } catch (err) {
      console.error('BATCH ASSIGN RO ERROR:', err);

      setBatchModalOpen(false);

      setFeedbackModal({
        tone: 'error',
        title: 'Batch assignment failed',
        message:
          err.message ||
          'The RO batch assignment could not be completed.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleClear = async (scholar) => {
    if (!scholar?.student_id) return;

    const confirmed = window.confirm(
      `Mark ${getScholarName(scholar)} as RO cleared?`
    );

    if (!confirmed) return;

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
    <div className="space-y-3 px-1 py-2" style={{ background: C.bg }}>
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

      <FeedbackModal
        open={Boolean(feedbackModal)}
        title={feedbackModal?.title}
        message={feedbackModal?.message}
        details={feedbackModal?.details || []}
        tone={feedbackModal?.tone || 'info'}
        onClose={() => setFeedbackModal(null)}
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
          if (detailsScholar) handleClear(detailsScholar);
        }}
      />

      <section
        className="rounded-xl border bg-white px-3 py-3"
        style={{ borderColor: C.line }}
      >
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-center">
          {topTab !== 'requests' ? (
            <div className="min-w-0 flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />

                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by scholar name or PDM ID..."
                  className="h-9 rounded-lg border-stone-200 bg-[#f8f6f2] pl-9 pr-3 text-sm shadow-none focus-visible:ring-1"
                />
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-stone-900">RO Area Requests</p>
              <p className="mt-0.5 text-xs text-stone-500">
                Review offices requesting scholars for RO service.
              </p>
            </div>
          )}

          <div className="flex shrink-0 flex-wrap items-center gap-2 xl:flex-nowrap">
            <ToolbarSegment
              options={TOP_TABS}
              value={topTab}
              onChange={setTopTab}
            />

            {selectedIds.length > 0 &&
            !['cleared', 'requests'].includes(topTab) ? (
              <Button
                onClick={() => {
                  setBatchError('');
                  setBatchModalOpen(true);
                }}
                size="sm"
                disabled={activeRequiredHours <= 0}
                className="h-9 shrink-0 rounded-lg border-none px-3 text-xs text-white"
                style={{ background: C.brownMid }}
              >
                <Send className="mr-1.5 h-3.5 w-3.5" />
                Batch Assign ({selectedIds.length})
              </Button>
            ) : null}

            {topTab !== 'requests' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setFilterOpen(true)}
                className="h-9 shrink-0 rounded-lg border-stone-200 bg-white px-2.5 text-xs text-stone-700"
              >
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
                Filters
                {activeFilterCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-stone-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
            ) : null}

            <Button
              onClick={() => refreshAll()}
              variant="outline"
              size="sm"
              className="h-9 shrink-0 rounded-lg border-stone-200 bg-white px-2.5 text-xs text-stone-700"
              disabled={filterLoading}
            >
              {filterLoading ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
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
        <section
          className="overflow-hidden rounded-2xl border bg-white"
          style={{ borderColor: C.line }}
        >
          <div className="border-b border-stone-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-stone-900">
              {topTab === 'assigned'
                ? 'Assigned RO Scholars'
                : topTab === 'unassigned'
                  ? 'Unassigned RO Scholars'
                  : 'Cleared RO Scholars'}
            </h2>

            <p className="mt-1 text-xs text-stone-400">
              {displayedScholars.length} result{displayedScholars.length !== 1 ? 's' : ''}
            </p>
          </div>

          <CardContent className="p-4">
            {displayedScholars.length === 0 ? (
              <EmptyState onAssignMode={() => setTopTab('unassigned')} />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50/70">
                      <th className="w-[44px] px-3 py-3 text-left text-xs font-semibold text-stone-900">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAllVisible}
                        />
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                        Scholar
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                        Program
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                        Department
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                        Progress
                      </th>

                      <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                        Status
                      </th>

                      <th className="px-3 py-3 text-right text-xs font-semibold text-stone-900">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-stone-100 bg-white">
                    {displayedScholars.map((scholar) => {
                      const key = `${scholar.student_id}-${scholar.application_id || scholar.ro_id || 'ro'}`;
                      const name = getScholarName(scholar);
                      const hasAssignment = !!scholar.ro_id;
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
                          <td className="px-3 py-4 align-top">
                            <input
                              type="checkbox"
                              disabled={!selectable}
                              checked={selected}
                              onChange={() => toggleSelected(scholar.student_id)}
                            />
                          </td>

                          <td className="px-3 py-4 align-top">
                            <div className="flex items-start gap-3">
                              <Avatar className="h-9 w-9 shrink-0 rounded-full border border-stone-200 shadow-sm">
                                <AvatarImage
                                  src={
                                    scholar.profile_photo_url ||
                                    scholar.avatarUrl ||
                                    scholar.avatar_url ||
                                    undefined
                                  }
                                  alt={name}
                                />
                                <AvatarFallback className="bg-blue-900 text-[10px] font-semibold text-white">
                                  {getInitials(name)}
                                </AvatarFallback>
                              </Avatar>

                              <div className="min-w-0">
                                <p className="max-w-[220px] truncate text-sm font-semibold text-stone-900">
                                  {name}
                                </p>
                                <p className="mt-0.5 text-[11px] text-stone-400">
                                  {scholar.pdm_id || 'No PDM ID'}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-3 py-4 align-top">
                            <p className="max-w-[240px] text-xs font-semibold leading-5 text-stone-900">
                              {scholar.program_name || 'N/A'}
                            </p>
                            <p className="mt-0.5 text-[11px] text-stone-400">
                              {scholar.course_code || 'N/A'} · {formatYearLevel(scholar.year_level)}
                            </p>
                          </td>

                          <td className="px-3 py-4 align-top">
                            {hasAssignment ? (
                              <p className="max-w-[220px] text-xs font-bold text-stone-900">
                                {scholar.assigned_area || scholar.assignedArea || 'Not assigned'}
                              </p>
                            ) : (
                              <p className="text-xs font-semibold text-stone-400">
                                Not assigned
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-4 align-top">
                            {hasAssignment ? (
                              <p className="text-xs font-black text-stone-900">
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

                          <td className="px-3 py-4 text-right align-top">
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
                              className="h-9 rounded-xl border-stone-200 px-3 text-xs"
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

