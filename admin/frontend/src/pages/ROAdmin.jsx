import React, { useEffect, useMemo, useState } from 'react';
import { useSocketEvent } from '@/hooks/useSocket';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ClipboardCheck,
  Filter,
  X,
  AlertTriangle,
  Send,
  Eye,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  MapPin,
  MessageSquareText,
} from 'lucide-react';
import { buildApiUrl } from '@/api';

const C = {
  brownMid: '#7c4a2e',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  blue: '#1E3A8A',
  blueSoft: '#EFF6FF',
  purple: '#7c3aed',
  purpleSoft: '#F5F3FF',
  bg: '#faf7f2',
  line: '#e7e5e4',
};

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'unassigned', label: 'Unassigned' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'for_validation', label: 'For Validation' },
  { value: 'conflict', label: 'Conflict' },
  { value: 'cleared', label: 'Cleared' },
];

function StatusChip({ children, tone = 'default' }) {
  const map = {
    default: { bg: '#f5f5f4', color: '#57534e' },
    green: { bg: C.greenSoft, color: C.green },
    amber: { bg: C.amberSoft, color: C.amber },
    red: { bg: C.redSoft, color: C.red },
    blue: { bg: C.blueSoft, color: C.blue },
    purple: { bg: C.purpleSoft, color: C.purple },
  };

  const s = map[tone] || map.default;

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      {children}
    </span>
  );
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function getAssignmentTone(value) {
  const status = normalizeStatus(value);

  if (status === 'cleared') return 'green';
  if (status === 'conflict reported') return 'red';
  if (status === 'for validation') return 'blue';
  if (status === 'in progress') return 'purple';
  if (status === 'acknowledged') return 'blue';
  if (status === 'assigned') return 'amber';
  if (status === 'unassigned') return 'default';

  return 'default';
}

function matchesStatusTab(scholar, viewMode) {
  if (viewMode === 'all') return true;

  const assignmentStatus = normalizeStatus(
    scholar.assignment_status || scholar.assignmentStatus
  );

  const progressStatus = normalizeStatus(
    scholar.progress_status || scholar.progressStatus
  );

  const roStatus = normalizeStatus(scholar.ro_status);
  const hasAssignment = !!scholar.ro_id;

  const pendingLogCount = Number(
    scholar.pendingLogCount || scholar.pending_log_count || 0
  );

  const isCleared =
    scholar.is_cleared === true ||
    roStatus === 'cleared' ||
    assignmentStatus === 'cleared';

  if (viewMode === 'unassigned') return !hasAssignment;
  if (viewMode === 'assigned') return assignmentStatus === 'assigned';
  if (viewMode === 'acknowledged') return assignmentStatus === 'acknowledged';

  if (viewMode === 'in_progress') {
    return assignmentStatus === 'in progress' || progressStatus === 'in progress';
  }

  if (viewMode === 'for_validation') {
    return (
      assignmentStatus === 'for validation' ||
      progressStatus === 'for validation' ||
      pendingLogCount > 0
    );
  }

  if (viewMode === 'conflict') return assignmentStatus === 'conflict reported';
  if (viewMode === 'cleared') return isCleared;

  return true;
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

function clampPercent(value) {
  return Math.min(100, Math.max(0, Number(value || 0)));
}

function ProgressLine({ label, value, caption, color }) {
  const percent = clampPercent(value);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold text-stone-700">{label}</p>
        <p className="text-[11px] font-black" style={{ color }}>
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
        Try changing the search/filter, or check the unassigned tab to assign RO notices to approved scholars.
      </p>

      <Button
        onClick={onAssignMode}
        variant="outline"
        size="sm"
        className="mt-4 rounded-lg border-stone-200 text-xs"
      >
        Show Unassigned Scholars
      </Button>
    </div>
  );
}

function FilterModal({
  open,
  onClose,
  courses,
  openings,
  courseId,
  setCourseId,
  yearLevel,
  setYearLevel,
  openingId,
  setOpeningId,
  onReset,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <Card className="relative w-full max-w-xl overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">
              Filter RO Scholars
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Refine the list by course, year level, or scholarship batch.
            </p>
          </div>

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
                Course
              </label>

              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
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

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                Year Level
              </label>

              <select
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="all">All Year Levels</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
                <option value="5">5th Year</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                Scholarship Batch
              </label>

              <select
                value={openingId}
                onChange={(e) => setOpeningId(e.target.value)}
                className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="all">All Batches</option>
                {openings.map((opening) => (
                  <option
                    key={opening.opening_id || opening.id}
                    value={opening.opening_id || opening.id}
                  >
                    {opening.opening_title ||
                      opening.title ||
                      opening.program_name ||
                      'Unnamed Batch'}
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
              Reset Filters
            </Button>

            <Button
              type="button"
              onClick={onClose}
              className="rounded-xl border-none px-5 text-xs font-bold text-white"
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

function AssignModal({
  open,
  scholar,
  departments = [],
  defaultRequiredHours = 20,
  loading,
  error,
  onClose,
  onSubmit,
}) {
  const [assignedArea, setAssignedArea] = useState('');
  const [requiredHours, setRequiredHours] = useState('20');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!open || !scholar) return;

    setAssignedArea(scholar.assigned_area || scholar.assignedArea || '');
    setRequiredHours(String(defaultRequiredHours || 20));
    setRemarks(scholar.remarks || '');
  }, [open, scholar, defaultRequiredHours]);

  if (!open || !scholar) return null;

  const name = getScholarName(scholar);

  const submit = () => {
    onSubmit({
      applicationId: scholar.application_id || null,
      openingId: scholar.opening_id || null,
      programId: scholar.program_id || null,
      assignedArea,
      requiredHours: Number(requiredHours || 0),
      remarks,
    });
  };

  const currentDepartmentExists = departments.some(
    (department) => department.department_name === assignedArea
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={loading ? undefined : onClose} />

      <Card className="relative w-full max-w-xl overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">
              Assign Return of Obligation
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              This creates a direct RO notice for the selected scholar.
            </p>
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

        <CardContent className="space-y-4 p-5">
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 px-4 py-3">
            <p className="text-xs font-black text-stone-900">{name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-stone-400">
              {scholar.pdm_id || scholar.student_id}
            </p>
            <p className="mt-1 text-[11px] font-semibold text-stone-500">
              {scholar.program_name || 'Scholarship Program'}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-stone-400">
                Assigned Area / Department
              </span>

              <select
                value={assignedArea}
                onChange={(e) => setAssignedArea(e.target.value)}
                className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="">Select RO department</option>

                {assignedArea && !currentDepartmentExists ? (
                  <option value={assignedArea}>{assignedArea} (current)</option>
                ) : null}

                {departments.map((department) => (
                  <option
                    key={department.department_id}
                    value={department.department_name}
                  >
                    {department.department_name}
                  </option>
                ))}
              </select>

              <p className="mt-1 text-[11px] text-stone-400">
                Manage this list in Maintenance → RO Settings.
              </p>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-stone-400">
                Required Hours
              </span>

              <Input
                type="number"
                min="0"
                value={requiredHours}
                readOnly
                disabled
                className="rounded-xl border-stone-200 bg-stone-100 text-stone-500"
              />

              <p className="mt-1 text-[11px] text-stone-400">
                Locked from the active RO setting.
              </p>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-stone-400">
                Remarks <span className="font-medium normal-case text-stone-400">(optional)</span>
              </span>

              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Optional note for this RO assignment."
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
              disabled={loading || !assignedArea}
              className="rounded-xl border-none px-5 text-xs font-bold text-white disabled:opacity-50"
              style={{ background: C.brownMid }}
            >
              {loading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Send Assignment Notice
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
  defaultRequiredHours = 20,
  loading,
  error,
  onClose,
  onSubmit,
}) {
  const [assignedArea, setAssignedArea] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!open) return;

    setAssignedArea('');
    setRemarks('');
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={loading ? undefined : onClose} />

      <Card className="relative w-full max-w-xl overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">
              Batch Assign Return of Obligation
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              This will send RO assignment notices to {selectedCount} selected scholar
              {selectedCount > 1 ? 's' : ''}.
            </p>
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

        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-stone-400">
                Assigned Area / Department
              </span>

              <select
                value={assignedArea}
                onChange={(e) => setAssignedArea(e.target.value)}
                className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="">Select RO department</option>
                {departments.map((department) => (
                  <option
                    key={department.department_id}
                    value={department.department_name}
                  >
                    {department.department_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-stone-400">
                Required Hours
              </span>

              <Input
                type="number"
                value={defaultRequiredHours}
                readOnly
                disabled
                className="rounded-xl border-stone-200 bg-stone-100 text-stone-500"
              />

              <p className="mt-1 text-[11px] text-stone-400">
                Locked from the active RO setting.
              </p>
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wide text-stone-400">
                Remarks <span className="font-medium normal-case text-stone-400">(optional)</span>
              </span>

              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
                placeholder="Optional note for this batch assignment."
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
              disabled={loading || !assignedArea || selectedCount === 0}
              onClick={() => onSubmit({ assignedArea, remarks })}
              className="rounded-xl border-none px-5 text-xs font-bold text-white disabled:opacity-50"
              style={{ background: C.brownMid }}
            >
              {loading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-2 h-3.5 w-3.5" />
              )}
              Send Batch Notice
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LogsModal({
  open,
  scholar,
  loading,
  error,
  onClose,
  onValidate,
}) {
  if (!open || !scholar) return null;

  const logs = Array.isArray(scholar.logs) ? scholar.logs : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={loading ? undefined : onClose} />

      <Card className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">
              RO Time Logs
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              {getScholarName(scholar)} · {scholar.pdm_id || 'No PDM ID'}
            </p>
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

        <CardContent className="flex-1 space-y-3 overflow-y-auto p-5">
          {logs.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-8 text-center">
              <p className="text-sm font-semibold text-stone-700">
                No time logs yet
              </p>
              <p className="mt-1 text-xs text-stone-400">
                The scholar’s time-in/time-out records will appear here.
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const status = log.validationStatus || log.validation_status;
              const pending = status === 'Pending Validation';

              return (
                <div
                  key={log.logId || log.log_id}
                  className="rounded-xl border border-stone-200 bg-white p-4"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
                          {status || 'Pending Validation'}
                        </StatusChip>

                        <StatusChip tone="default">
                          {log.logStatus || log.log_status || 'Timed Out'}
                        </StatusChip>
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

                      {(log.validationRemarks || log.validation_remarks) ? (
                        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                          {log.validationRemarks || log.validation_remarks}
                        </p>
                      ) : null}
                    </div>

                    {pending ? (
                      <div className="flex shrink-0 gap-2">
                        <Button
                          size="sm"
                          disabled={loading}
                          onClick={() =>
                            onValidate(log, {
                              validationStatus: 'Approved',
                              validatedMinutes:
                                log.durationMinutes || log.duration_minutes || 0,
                              remarks: 'Approved by RO admin.',
                            })
                          }
                          className="rounded-lg border-none text-xs text-white"
                          style={{ background: C.green }}
                        >
                          Approve
                        </Button>

                        <Button
                          size="sm"
                          disabled={loading}
                          onClick={() =>
                            onValidate(log, {
                              validationStatus: 'Rejected',
                              validatedMinutes: 0,
                              remarks: 'Rejected by RO admin.',
                            })
                          }
                          className="rounded-lg border-none text-xs text-white"
                          style={{ background: C.red }}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
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

function ScholarCard({
  scholar,
  loading,
  onAssign,
  onLogs,
  onClear,
}) {
  const name = getScholarName(scholar);
  const assignmentStatus = scholar.assignment_status || scholar.assignmentStatus || 'Unassigned';
  const progressStatus = scholar.progress_status || scholar.progressStatus || 'Not Started';
  const requiredMinutes = scholar.requiredMinutes || scholar.required_minutes || 0;
  const submittedMinutes = scholar.submittedMinutes || scholar.submitted_minutes || 0;
  const validatedMinutes = scholar.validatedMinutes || scholar.validated_minutes || 0;
  const submittedProgress = scholar.submittedProgress || scholar.submitted_progress || 0;
  const validatedProgress = scholar.validatedProgress || scholar.ro_progress || 0;
  const pendingLogCount = scholar.pendingLogCount || scholar.pending_log_count || 0;
  const isCleared = scholar.is_cleared || normalizeStatus(scholar.ro_status) === 'cleared';

  return (
    <Card className="overflow-hidden rounded-2xl border-stone-200 bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11 shrink-0 rounded-full border border-stone-200 shadow-sm">
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
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-stone-900">
                  {name}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-stone-400">
                  {scholar.pdm_id || scholar.student_id || 'No Student ID'}
                </p>
              </div>

              <StatusChip tone={getAssignmentTone(assignmentStatus)}>
                {assignmentStatus}
              </StatusChip>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-stone-500 sm:grid-cols-2">
              <p>
                <span className="font-bold text-stone-700">Course:</span>{' '}
                {scholar.course_code || 'N/A'}
              </p>
              <p>
                <span className="font-bold text-stone-700">Year:</span>{' '}
                {formatYearLevel(scholar.year_level)}
              </p>
              <p className="sm:col-span-2">
                <span className="font-bold text-stone-700">Program:</span>{' '}
                {scholar.program_name || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-stone-100 bg-stone-50/70 p-3">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
            <div>
              <p className="text-xs font-black text-stone-800">
                {scholar.assigned_area || scholar.assignedArea || 'No assigned area'}
              </p>
              <p className="mt-0.5 text-[11px] text-stone-500">
                RO assignment department
              </p>
            </div>
          </div>

          {scholar.remarks ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-white px-3 py-2">
              <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" />
              <p className="text-xs leading-5 text-stone-600">
                {scholar.remarks}
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
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

          <div className="flex flex-wrap gap-2">
            <StatusChip tone={getAssignmentTone(progressStatus)}>
              {progressStatus}
            </StatusChip>

            {pendingLogCount > 0 ? (
              <StatusChip tone="blue">
                {pendingLogCount} log{pendingLogCount > 1 ? 's' : ''} for validation
              </StatusChip>
            ) : null}
          </div>
        </div>

        {scholar.conflict_reason || scholar.conflictReason ? (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2">
            <p className="text-[11px] font-black uppercase tracking-wide text-red-500">
              Conflict Reported
            </p>
            <p className="mt-1 text-xs leading-5 text-red-600">
              {scholar.conflict_reason || scholar.conflictReason}
            </p>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={onAssign}
            variant="outline"
            size="sm"
            disabled={loading}
            className="rounded-xl border-stone-200 text-xs"
          >
            <Send className="mr-2 h-3.5 w-3.5" />
            Edit Notice
          </Button>

          <Button
            onClick={onLogs}
            variant="outline"
            size="sm"
            disabled={loading}
            className="rounded-xl border-stone-200 text-xs"
          >
            <Eye className="mr-2 h-3.5 w-3.5" />
            Check Logs
          </Button>

          {!isCleared ? (
            <Button
              onClick={onClear}
              size="sm"
              disabled={loading}
              className="rounded-xl border-none text-xs text-white"
              style={{ background: C.green }}
            >
              <ShieldCheck className="mr-2 h-3.5 w-3.5" />
              Mark Cleared
            </Button>
          ) : (
            <div className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              RO Cleared
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function AssignedCardsWindow({
  open,
  scholars,
  loading,
  onClose,
  onAssign,
  onLogs,
  onClear,
}) {
  if (!open) return null;

  const assigned = scholars.filter((scholar) => !!scholar.ro_id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <Card className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">
              Assigned RO Scholars
            </h3>
            <p className="mt-1 text-xs text-stone-500">
              Card view for scholars who already have an RO assignment notice.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CardContent className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-stone-300" />
            </div>
          ) : assigned.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
              <ClipboardCheck className="h-8 w-8 text-stone-300" />
              <p className="mt-3 text-sm font-semibold text-stone-700">
                No assigned RO cards found
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Scholars with RO assignment notices will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              {assigned.map((scholar) => {
                const key = `${scholar.student_id}-${scholar.application_id || scholar.ro_id || 'assigned'}`;

                return (
                  <ScholarCard
                    key={key}
                    scholar={scholar}
                    loading={loading}
                    onAssign={() => onAssign(scholar)}
                    onLogs={() => onLogs(scholar)}
                    onClear={() => onClear(scholar)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ROAdmin() {
  const token = sessionStorage.getItem('adminToken');

  const [scholars, setScholars] = useState([]);
  const [assignedCards, setAssignedCards] = useState([]);
  const [courses, setCourses] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [activeRoSetting, setActiveRoSetting] = useState(null);

  const [viewMode, setViewMode] = useState('all');
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('all');
  const [yearLevel, setYearLevel] = useState('all');
  const [openingId, setOpeningId] = useState('all');

  const [selectedIds, setSelectedIds] = useState([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchError, setBatchError] = useState('');

  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [assignedLoading, setAssignedLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const [filterOpen, setFilterOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [assignedWindowOpen, setAssignedWindowOpen] = useState(false);
  const [selectedScholar, setSelectedScholar] = useState(null);
  const [actionError, setActionError] = useState('');

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }),
    [token]
  );

  const activeRequiredHours = Number(activeRoSetting?.required_hours || 20);

  const displayedScholars = useMemo(() => {
    return scholars.filter((scholar) => matchesStatusTab(scholar, viewMode));
  }, [scholars, viewMode]);

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

  const selectableScholars = displayedScholars.filter(isBatchSelectable);

  const selectedScholars = scholars.filter((scholar) =>
    selectedIds.includes(String(scholar.student_id))
  );

  const activeFilterCount = [
    courseId !== 'all',
    yearLevel !== 'all',
    openingId !== 'all',
  ].filter(Boolean).length;

  const buildScholarQuery = () => {
    const params = new URLSearchParams();

    params.set('status', 'all');

    if (search.trim()) params.set('search', search.trim());
    if (courseId !== 'all') params.set('courseId', courseId);
    if (yearLevel !== 'all') params.set('yearLevel', yearLevel);
    if (openingId !== 'all') params.set('openingId', openingId);

    return params.toString();
  };

  const parseScholarRows = (data) => {
    return Array.isArray(data)
      ? data
      : Array.isArray(data.scholars)
        ? data.scholars
        : Array.isArray(data.data)
          ? data.data
          : [];
  };

  const loadFilterData = async () => {
    try {
      const [coursesRes, openingsRes, departmentsRes, activeSettingRes] = await Promise.all([
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
        setOpenings(Array.isArray(openingsData) ? openingsData : openingsData.data || []);
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

  const loadAssignedCards = async () => {
    try {
      setAssignedLoading(true);

      const query = buildScholarQuery();

      const res = await fetch(buildApiUrl(`/api/ro/scholars?${query}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to load assigned RO cards');
      }

      setAssignedCards(parseScholarRows(data).filter((item) => !!item.ro_id));
    } catch (err) {
      console.error('LOAD ASSIGNED RO CARDS ERROR:', err);
      setAssignedCards([]);
    } finally {
      setAssignedLoading(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadFilterData(), loadScholars()]);

    if (assignedWindowOpen) {
      await loadAssignedCards();
    }
  };

  useEffect(() => {
    loadFilterData();
    loadScholars({ initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadScholars();

      if (assignedWindowOpen) {
        loadAssignedCards();
      }
    }, 350);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, courseId, yearLevel, openingId]);

  useSocketEvent(
    'ro:updated',
    () => {
      refreshAll();
    },
    [search, courseId, yearLevel, openingId, assignedWindowOpen]
  );

  useSocketEvent(
    'roUpdated',
    () => {
      refreshAll();
    },
    [search, courseId, yearLevel, openingId, assignedWindowOpen]
  );

  const handleResetFilters = () => {
    setSearch('');
    setCourseId('all');
    setYearLevel('all');
    setOpeningId('all');
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
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedIds.includes(id));

    setSelectedIds((current) => {
      if (allSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return [...new Set([...current, ...visibleIds])];
    });
  };

  const openAssignModal = (scholar) => {
    setSelectedScholar(scholar);
    setActionError('');
    setAssignModalOpen(true);
  };

  const closeAssignModal = () => {
    if (actionLoading) return;

    setSelectedScholar(null);
    setActionError('');
    setAssignModalOpen(false);
  };

  const openLogsModal = (scholar) => {
    setSelectedScholar(scholar);
    setActionError('');
    setLogsModalOpen(true);
  };

  const closeLogsModal = () => {
    if (actionLoading) return;

    setSelectedScholar(null);
    setActionError('');
    setLogsModalOpen(false);
  };

  const openAssignedWindow = async () => {
    setAssignedWindowOpen(true);
    await loadAssignedCards();
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
            requiredHours: activeRequiredHours,
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
          requiredHours: activeRequiredHours,
          remarks,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to batch assign RO.');
      }

      if (Number(data.failed_count || 0) > 0) {
        setBatchError(
          `${data.success_count || 0} assigned, ${data.failed_count || 0} failed.`
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

  const handleValidateLog = async (log, payload) => {
    const logId = log.logId || log.log_id;

    if (!logId) return;

    try {
      setActionLoading(true);
      setActionError('');

      const res = await fetch(buildApiUrl(`/api/ro/time-logs/${logId}/validate`), {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to validate time log');
      }

      setLogsModalOpen(false);
      setSelectedScholar(null);
      await refreshAll();
    } catch (err) {
      console.error('VALIDATE RO LOG ERROR:', err);
      setActionError(err.message || 'Failed to validate time log');
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

      await refreshAll();
    } catch (err) {
      console.error('CLEAR RO ERROR:', err);
      setError(err.message || 'Failed to clear scholar');
    } finally {
      setActionLoading(false);
    }
  };

  const hasFilters =
    search.trim() ||
    courseId !== 'all' ||
    yearLevel !== 'all' ||
    openingId !== 'all';

  const allVisibleSelected =
    selectableScholars.length > 0 &&
    selectableScholars.every((scholar) =>
      selectedIds.includes(String(scholar.student_id))
    );

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-stone-300" />
        <p className="text-xs uppercase tracking-widest text-stone-400">
          Loading RO admin...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-1 py-3" style={{ background: C.bg }}>
      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        courses={courses}
        openings={openings}
        courseId={courseId}
        setCourseId={setCourseId}
        yearLevel={yearLevel}
        setYearLevel={setYearLevel}
        openingId={openingId}
        setOpeningId={setOpeningId}
        onReset={handleResetFilters}
      />

      <AssignModal
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
        onValidate={handleValidateLog}
      />

      <AssignedCardsWindow
        open={assignedWindowOpen}
        scholars={assignedCards}
        loading={assignedLoading || actionLoading}
        onClose={() => setAssignedWindowOpen(false)}
        onAssign={openAssignModal}
        onLogs={openLogsModal}
        onClear={handleClear}
      />

      <section
        className="rounded-2xl border bg-white p-3 sm:p-4"
        style={{ borderColor: C.line }}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scholar, PDM ID, area..."
              className="h-10 rounded-xl border-stone-200 bg-stone-50 pl-10 text-sm shadow-none focus-visible:ring-1"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {selectedIds.length > 0 ? (
              <Button
                onClick={() => {
                  setBatchError('');
                  setBatchModalOpen(true);
                }}
                size="sm"
                className="h-10 rounded-xl border-none px-3 text-white"
                style={{ background: C.brownMid }}
              >
                <Send className="mr-2 h-4 w-4" />
                Batch Assign ({selectedIds.length})
              </Button>
            ) : null}

            <Button
              onClick={openAssignedWindow}
              variant="outline"
              size="sm"
              className="h-10 rounded-xl border-stone-200 bg-white px-3 text-stone-700"
            >
              <LayoutGrid className="mr-2 h-4 w-4" />
              Assigned Cards
            </Button>

            <Button
              onClick={() => setFilterOpen(true)}
              variant="outline"
              size="sm"
              className="h-10 rounded-xl border-stone-200 bg-white px-3 text-stone-700"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

            <Button
              onClick={() => refreshAll()}
              variant="outline"
              size="sm"
              className="h-10 rounded-xl border-stone-200 bg-white px-3 text-stone-700"
              disabled={filterLoading}
            >
              {filterLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>

            {hasFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-10 rounded-xl border-stone-200 bg-white px-3 text-xs text-stone-700"
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setViewMode(tab.value)}
              className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition ${viewMode === tab.value
                  ? 'text-white shadow-sm'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              style={viewMode === tab.value ? { background: C.brownMid } : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <div className="flex gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <section
        className="overflow-hidden rounded-2xl border bg-white"
        style={{ borderColor: C.line }}
      >
        <CardContent className="p-4">
          {displayedScholars.length === 0 ? (
            <EmptyState onAssignMode={() => setViewMode('unassigned')} />
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
                      Course / Year
                    </th>

                    <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                      Assignment
                    </th>

                    <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                      Progress
                    </th>

                    <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                      Logs
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
                    const assignmentStatus =
                      scholar.assignment_status || scholar.assignmentStatus || 'Unassigned';
                    const progressStatus =
                      scholar.progress_status || scholar.progressStatus || 'Not Started';
                    const requiredMinutes =
                      scholar.requiredMinutes || scholar.required_minutes || 0;
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
                    const isCleared =
                      scholar.is_cleared || normalizeStatus(scholar.ro_status) === 'cleared';
                    const selectable = isBatchSelectable(scholar);
                    const selected = selectedIds.includes(String(scholar.student_id));

                    return (
                      <tr
                        key={key}
                        className="transition-colors hover:bg-stone-50/70"
                      >
                        <td className="px-3 py-3 align-top">
                          <input
                            type="checkbox"
                            disabled={!selectable}
                            checked={selected}
                            onChange={() => toggleSelected(scholar.student_id)}
                          />
                        </td>

                        <td className="px-3 py-3 align-top">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-8 w-8 shrink-0 rounded-full border border-stone-200 shadow-sm">
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
                              <p className="max-w-[190px] truncate text-sm font-semibold text-stone-900">
                                {name}
                              </p>
                              <p className="mt-0.5 font-mono text-[11px] text-stone-400">
                                {scholar.pdm_id || scholar.student_id || 'No PDM ID'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 align-top">
                          <p className="max-w-[210px] text-xs font-semibold leading-5 text-stone-900">
                            {scholar.program_name || 'N/A'}
                          </p>
                          {scholar.opening_title ? (
                            <p className="mt-0.5 max-w-[210px] text-[11px] leading-4 text-stone-400">
                              {scholar.opening_title}
                            </p>
                          ) : null}
                        </td>

                        <td className="px-3 py-3 align-top">
                          <p className="text-xs font-semibold text-stone-800">
                            {scholar.course_code || 'N/A'}
                          </p>
                          <p className="mt-0.5 text-[11px] text-stone-400">
                            {formatYearLevel(scholar.year_level)}
                          </p>
                        </td>

                        <td className="px-3 py-3 align-top">
                          <div className="space-y-1.5">
                            <StatusChip tone={getAssignmentTone(assignmentStatus)}>
                              {assignmentStatus}
                            </StatusChip>

                            {hasAssignment ? (
                              <>
                                <p className="max-w-[220px] text-xs font-bold text-stone-800">
                                  {scholar.assigned_area || scholar.assignedArea || 'No area'}
                                </p>

                                {scholar.remarks ? (
                                  <p className="max-w-[220px] text-[11px] leading-4 text-stone-400">
                                    {scholar.remarks}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <p className="text-[11px] font-semibold text-amber-600">
                                No RO notice sent yet
                              </p>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3 align-top">
                          {hasAssignment ? (
                            <div className="min-w-[190px] space-y-2">
                              <ProgressLine
                                label="Submitted"
                                value={submittedProgress}
                                color={C.amber}
                                caption={`${formatMinutes(submittedMinutes)} / ${formatMinutes(requiredMinutes)}`}
                              />

                              <ProgressLine
                                label="Validated"
                                value={validatedProgress}
                                color={C.green}
                                caption={`${formatMinutes(validatedMinutes)} / ${formatMinutes(requiredMinutes)}`}
                              />

                              <StatusChip tone={getAssignmentTone(progressStatus)}>
                                {progressStatus}
                              </StatusChip>
                            </div>
                          ) : (
                            <p className="text-xs text-stone-400">N/A</p>
                          )}
                        </td>

                        <td className="px-3 py-3 align-top">
                          {hasAssignment ? (
                            <div className="space-y-1.5">
                              {pendingLogCount > 0 ? (
                                <StatusChip tone="blue">
                                  {pendingLogCount} pending
                                </StatusChip>
                              ) : (
                                <StatusChip tone="default">No pending logs</StatusChip>
                              )}

                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openLogsModal(scholar)}
                                disabled={actionLoading}
                                className="h-8 rounded-lg border-stone-200 px-2 text-xs"
                              >
                                <Eye className="mr-1.5 h-3.5 w-3.5" />
                                Check
                              </Button>
                            </div>
                          ) : (
                            <p className="text-xs text-stone-400">N/A</p>
                          )}
                        </td>

                        <td className="px-3 py-3 text-right align-top">
                          <div className="flex flex-col items-end gap-2">
                            <Button
                              onClick={() => openAssignModal(scholar)}
                              variant="outline"
                              size="sm"
                              disabled={actionLoading}
                              className="h-8 rounded-lg border-stone-200 px-3 text-xs"
                            >
                              <Send className="mr-1.5 h-3.5 w-3.5" />
                              {hasAssignment ? 'Edit' : 'Assign'}
                            </Button>

                            {hasAssignment && !isCleared ? (
                              <Button
                                onClick={() => handleClear(scholar)}
                                size="sm"
                                disabled={actionLoading}
                                className="h-8 rounded-lg border-none px-3 text-xs text-white"
                                style={{ background: C.green }}
                              >
                                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                                Clear
                              </Button>
                            ) : null}

                            {isCleared ? (
                              <div className="inline-flex items-center gap-1.5 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Cleared
                              </div>
                            ) : null}
                          </div>
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
    </div>
  );
}