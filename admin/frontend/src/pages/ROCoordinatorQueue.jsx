import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useSocketEvent } from '@/hooks/useSocket';
import usePortalTheme from '@/hooks/usePortalTheme';
import { SectionLoadingSkeleton } from '@/components/system/PageLoadingSkeleton';
import ROCoordinatorScholarRequests from './ROCoordinatorScholarRequests';

const FILTERS = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Returned' },
  { key: 'all', label: 'All Requests' },
];

function authHeaders(tokenStorageKey) {
  return {
    Authorization: `Bearer ${sessionStorage.getItem(tokenStorageKey) || ''}`,
    'Content-Type': 'application/json',
  };
}

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function DecisionModal({ request, decision, loading, onClose, onConfirm, theme }) {
  const [remarks, setRemarks] = useState('');

  if (!request || !decision) return null;
  const rejecting = decision === 'reject';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && !loading && onClose()}>
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${rejecting ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {rejecting ? <RotateCcw className="h-5 w-5" /> : <Check className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="text-base font-semibold text-stone-900">{rejecting ? 'Return request to Admin' : 'Approve RO request'}</h2>
              <p className="mt-1 text-xs text-stone-500">
                {request.first_name} {request.last_name} · {request.pdm_id}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-4 p-5">
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
            {rejecting
              ? 'Admin will receive your remarks and can correct or reassign this request. The scholar will not be notified.'
              : 'The scholar and Admin will be notified, and this RO assignment will become active.'}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-stone-700">
              {rejecting ? 'Reason for returning' : 'Remarks (optional)'}
            </span>
            <textarea
              rows={4}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder={rejecting ? 'Explain what Admin needs to correct...' : 'Add an optional note...'}
              className="w-full resize-none rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none focus:ring-2"
              style={{ '--tw-ring-color': `${theme.base}22` }}
            />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-3">
          <Button variant="outline" onClick={onClose} disabled={loading} className="border-stone-200">Cancel</Button>
          <Button
            onClick={() => onConfirm(remarks)}
            disabled={loading || (rejecting && !remarks.trim())}
            className={rejecting ? 'bg-red-600 text-white hover:bg-red-700' : 'text-white'}
            style={rejecting ? undefined : { background: theme.base }}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {rejecting ? 'Return to Admin' : 'Confirm Approval'}
          </Button>
        </footer>
      </section>
    </div>
  );
}

export default function ROCoordinatorQueue({
  tokenStorageKey = 'roCoordinatorToken',
  portalKey = 'ro_coordinator',
}) {
  const { theme } = usePortalTheme(portalKey);
  const [department, setDepartment] = useState('');
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [decisionState, setDecisionState] = useState({ request: null, decision: '' });
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState('placements');
  const [attendance, setAttendance] = useState([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceSavingId, setAttendanceSavingId] = useState('');

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ status });
    if (search.trim()) params.set('search', search.trim());
    return `/api/ro-coordinator/requests?${params.toString()}`;
  }, [search, status]);

  const courseOptions = useMemo(
    () => [...new Set(items.map((item) => item.course_code).filter(Boolean))].sort(),
    [items]
  );
  const yearOptions = useMemo(
    () => [...new Set(items.map((item) => String(item.year_level || '')).filter(Boolean))]
      .sort((a, b) => Number(a) - Number(b)),
    [items]
  );
  const programOptions = useMemo(
    () => [...new Set(items.map((item) => item.program_name).filter(Boolean))].sort(),
    [items]
  );
  const filteredItems = useMemo(
    () => items.filter((item) =>
      (courseFilter === 'all' || item.course_code === courseFilter)
      && (yearFilter === 'all' || String(item.year_level || '') === yearFilter)
      && (programFilter === 'all' || item.program_name === programFilter)),
    [courseFilter, items, programFilter, yearFilter]
  );
  const hasDetailFilters = courseFilter !== 'all' || yearFilter !== 'all' || programFilter !== 'all';

  const loadRequests = useCallback(async ({ soft = false } = {}) => {
    try {
      soft ? setRefreshing(true) : setLoading(true);
      setError('');
      const response = await fetch(buildApiUrl(requestUrl), {
        headers: authHeaders(tokenStorageKey),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Failed to load RO requests.');
      setDepartment(payload.department || '');
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load RO requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [requestUrl, tokenStorageKey]);

  const loadAttendance = useCallback(async () => {
    try {
      setAttendanceLoading(true);
      const response = await fetch(buildApiUrl('/api/ro-coordinator/attendance?status=pending'), {
        headers: authHeaders(tokenStorageKey),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Failed to load attendance evidence.');
      setAttendance(Array.isArray(payload.items) ? payload.items : []);
    } catch (attendanceError) {
      toast.error('Attendance evidence was not loaded', { description: attendanceError.message });
    } finally {
      setAttendanceLoading(false);
    }
  }, [tokenStorageKey]);

  const decideAttendance = async (log, decision) => {
    const remarks = decision === 'return'
      ? window.prompt('Reason for returning this attendance evidence:')
      : window.prompt('Optional validation remarks:') || '';
    if (decision === 'return' && !remarks?.trim()) return;
    try {
      setAttendanceSavingId(log.log_id);
      const response = await fetch(buildApiUrl(`/api/ro-coordinator/attendance/${log.log_id}/decision`), {
        method: 'PATCH',
        headers: authHeaders(tokenStorageKey),
        body: JSON.stringify({ decision, remarks: remarks?.trim() || '' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Failed to validate attendance.');
      toast.success(decision === 'approve' ? 'Attendance validated' : 'Attendance returned', {
        description: payload.message,
      });
      await Promise.all([loadAttendance(), loadRequests({ soft: true })]);
    } catch (attendanceError) {
      toast.error('Attendance decision was not saved', { description: attendanceError.message });
    } finally {
      setAttendanceSavingId('');
    }
  };

  useEffect(() => {
    if (viewMode === 'attendance') {
      loadAttendance();
    }
  }, [viewMode, loadAttendance]);

  useEffect(() => {
    const timer = window.setTimeout(() => loadRequests(), 220);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  useSocketEvent('ro:updated', () => {
    loadRequests({ soft: true });
    if (viewMode === 'attendance') loadAttendance();
  }, [loadRequests, loadAttendance, viewMode]);

  const submitDecision = async (remarks) => {
    const { request, decision } = decisionState;
    if (!request?.placement_id || !decision) return;
    try {
      setSaving(true);
      const response = await fetch(buildApiUrl(`/api/ro-coordinator/requests/${request.placement_id}/decision`), {
        method: 'PATCH',
        headers: authHeaders(tokenStorageKey),
        body: JSON.stringify({ decision, remarks: remarks.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Failed to save RO decision.');
      setDecisionState({ request: null, decision: '' });
      toast.success(decision === 'approve' ? 'RO request approved' : 'RO request returned to Admin', {
        description: decision === 'approve'
          ? 'The scholar can now begin the approved RO assignment.'
          : 'Admin received your remarks for correction or reassignment.',
      });
      await loadRequests({ soft: true });
    } catch (decisionError) {
      toast.error('Decision was not saved', { description: decisionError.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <DecisionModal
        key={`${decisionState.request?.placement_id || 'none'}-${decisionState.decision || 'none'}`}
        request={decisionState.request}
        decision={decisionState.decision}
        loading={saving}
        onClose={() => setDecisionState({ request: null, decision: '' })}
        onConfirm={submitDecision}
        theme={theme}
      />

      <div className="flex flex-col gap-4 rounded-[24px] border border-stone-200 bg-white p-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.base }}>My RO Area</p>
          <h1 className="mt-1 text-2xl font-semibold text-stone-900">RO Requests</h1>
          <p className="mt-1 text-sm text-stone-500">{department || 'Your assigned area'} · Review requests before scholars begin RO work.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => viewMode === 'attendance' ? loadAttendance() : loadRequests({ soft: true })}
          disabled={viewMode === 'attendance' ? attendanceLoading : refreshing}
          className="border-stone-200"
        >
          {(viewMode === 'attendance' ? attendanceLoading : refreshing)
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="inline-flex rounded-xl border border-stone-200 bg-white p-1">
        {[
          { value: 'placements', label: 'Placement Approvals' },
          { value: 'attendance', label: 'Attendance Validation' },
          { value: 'scholars', label: 'Scholar Requests' },
        ].map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setViewMode(tab.value)}
            className="rounded-lg px-4 py-2 text-xs font-semibold transition-colors"
            style={
              viewMode === tab.value
                ? { background: theme.base, color: '#fff' }
                : { color: '#57534e' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {viewMode === 'placements' ? (
        <>
      <div className="rounded-2xl border border-stone-200 bg-white p-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => setStatus(filter.key)}
                className="rounded-xl border px-3 py-2 text-xs font-semibold transition"
                style={status === filter.key
                  ? { background: theme.base, borderColor: theme.base, color: '#fff' }
                  : { background: '#fff', borderColor: '#e7e5e4', color: '#57534e' }}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, PDM ID, or course..." className="h-10 rounded-xl border-stone-200 pl-9" />
          </div>
          </div>
          <div className="grid gap-2 border-t border-stone-100 pt-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_140px_minmax(0,1.35fr)_auto]">
            <select
              value={courseFilter}
              onChange={(event) => setCourseFilter(event.target.value)}
              className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:ring-2"
              style={{ '--tw-ring-color': `${theme.base}22` }}
              aria-label="Filter RO requests by course"
            >
              <option value="all">All Courses</option>
              {courseOptions.map((course) => <option key={course} value={course}>{course}</option>)}
            </select>
            <select
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
              className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:ring-2"
              style={{ '--tw-ring-color': `${theme.base}22` }}
              aria-label="Filter RO requests by year level"
            >
              <option value="all">All Years</option>
              {yearOptions.map((year) => <option key={year} value={year}>Year {year}</option>)}
            </select>
            <select
              value={programFilter}
              onChange={(event) => setProgramFilter(event.target.value)}
              className="h-10 rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:ring-2"
              style={{ '--tw-ring-color': `${theme.base}22` }}
              aria-label="Filter RO requests by scholarship program"
            >
              <option value="all">All Scholarship Programs</option>
              {programOptions.map((program) => <option key={program} value={program}>{program}</option>)}
            </select>
            <Button
              type="button"
              variant="outline"
              disabled={!hasDetailFilters}
              onClick={() => {
                setCourseFilter('all');
                setYearFilter('all');
                setProgramFilter('all');
              }}
              className="h-10 border-stone-200"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <SectionLoadingSkeleton label="Loading coordinator queue" rows={5} />
      ) : filteredItems.length ? (
        <div className="space-y-3">
          {filteredItems.map((request) => {
            const pending = request.coordinator_status === 'Pending';
            return (
              <Card key={request.placement_id || request.ro_id} className="overflow-hidden rounded-[22px] border-stone-200 shadow-none">
                <CardContent className="p-0">
                  <div className="grid gap-0 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
                    <div className="p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-semibold text-stone-900">{request.first_name} {request.last_name}</h2>
                            <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ background: theme.accentSoft, color: theme.base }}>
                              {request.coordinator_status === 'Rejected' ? 'Returned' : request.coordinator_status}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-stone-500">{request.pdm_id} · {request.course_code || 'Course not set'} · Year {request.year_level || 'N/A'}</p>
                          <p className="mt-2 text-sm font-medium text-stone-700">{request.program_name || 'Scholarship program not set'}</p>
                        </div>
                        <div className="shrink-0 text-left sm:text-right">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Requested</p>
                          <p className="mt-1 text-xs font-medium text-stone-600">{formatDate(request.assigned_at || request.created_at)}</p>
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Required Hours</p>
                          <p className="mt-1 text-sm font-semibold text-stone-900">{request.required_hours || 0} hours</p>
                        </div>
                        <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 sm:col-span-2">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Admin Remarks</p>
                          <p className="mt-1 text-sm text-stone-700">{request.remarks || 'No additional remarks.'}</p>
                        </div>
                      </div>
                      {request.coordinator_remarks ? (
                        <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Coordinator Remarks</p>
                          <p className="mt-1 text-sm text-amber-900">{request.coordinator_remarks}</p>
                        </div>
                      ) : null}
                    </div>

                    <aside className="flex flex-col justify-center border-t border-stone-100 bg-stone-50/70 p-5 xl:border-l xl:border-t-0">
                      {pending ? (
                        <>
                          <p className="text-sm font-semibold text-stone-900">Choose a decision</p>
                          <p className="mt-1 text-xs leading-5 text-stone-500">Approve when this area can accept the scholar. Return it when Admin needs to correct the request.</p>
                          <div className="mt-4 grid grid-cols-2 gap-2">
                            <Button onClick={() => setDecisionState({ request, decision: 'approve' })} className="text-white" style={{ background: theme.base }}>
                              <Check className="mr-2 h-4 w-4" />
                              Approve
                            </Button>
                            <Button variant="outline" onClick={() => setDecisionState({ request, decision: 'reject' })} className="border-red-200 text-red-700 hover:bg-red-50">
                              <RotateCcw className="mr-2 h-4 w-4" />
                              Return
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center">
                          {request.coordinator_status === 'Approved'
                            ? <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                            : <RotateCcw className="mx-auto h-8 w-8 text-amber-500" />}
                          <p className="mt-2 text-sm font-semibold text-stone-800">Decision completed</p>
                          <p className="mt-1 text-xs text-stone-500">{formatDate(request.coordinator_decided_at)}</p>
                        </div>
                      )}
                    </aside>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[22px] border border-dashed border-stone-200 bg-white px-6 py-16 text-center">
          {status === 'pending' ? <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" /> : <Clock3 className="mx-auto h-9 w-9 text-stone-300" />}
          <p className="mt-3 text-sm font-semibold text-stone-800">No {FILTERS.find((filter) => filter.key === status)?.label.toLowerCase()} found</p>
          <p className="mt-1 text-xs text-stone-500">{hasDetailFilters ? 'Try clearing or changing the Course, Year, or Scholarship Program filters.' : status === 'pending' ? 'You are caught up. New requests appear here automatically.' : 'Try another status or clear your search.'}</p>
        </div>
      )}
        </>
      ) : viewMode === 'scholars' ? (
        <ROCoordinatorScholarRequests
          tokenStorageKey={tokenStorageKey}
          portalKey={portalKey}
        />
      ) : (
        <section className="space-y-3 rounded-[24px] border border-stone-200 bg-white p-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.base }}>Completion Validation</p>
          <h2 className="mt-1 text-xl font-semibold text-stone-900">Attendance Evidence</h2>
          <p className="mt-1 text-sm text-stone-500">Validate the scholar's time-in and time-out evidence before OSFA can mark the obligation cleared.</p>
        </div>
        {attendanceLoading ? (
          <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
        ) : attendance.length ? (
          <div className="space-y-3">
            {attendance.map((log) => {
              const proofs = Array.isArray(log.proofs) ? log.proofs : [];
              const hasValidProof = (type) => proofs.some((proof) =>
                proof.proof_type === type &&
                Boolean(proof.file_url || proof.file_path) &&
                proof.latitude != null &&
                proof.longitude != null
              );
              const evidenceComplete = hasValidProof('time_in') && hasValidProof('time_out');

              return (
              <Card key={log.log_id} className="rounded-2xl border-stone-200 shadow-none">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="font-semibold text-stone-900">{log.first_name} {log.last_name}</p>
                      <p className="text-xs text-stone-500">{log.pdm_id} · {log.course_code || 'Course not set'} · {log.assigned_area}</p>
                    </div>
                    <p className="text-xs text-stone-500">{Math.round(Number(log.duration_minutes || 0))} minutes · {formatDate(log.time_out_at)}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {proofs.map((proof) => (
                      <a key={proof.proof_id} href={proof.file_url || '#'} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                        {proof.file_url ? <img src={proof.file_url} alt={proof.proof_type || 'RO attendance proof'} className="h-56 w-full object-cover" /> : <div className="flex h-40 items-center justify-center text-xs text-stone-400">Image unavailable</div>}
                        <div className="px-3 py-2 text-xs font-medium text-stone-600">{proof.proof_type === 'time_in' ? 'Time In' : 'Time Out'} · {proof.latitude || 'No GPS'}, {proof.longitude || 'No GPS'}</div>
                      </a>
                    ))}
                  </div>
                  {!evidenceComplete ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      Validation is locked until both time-in and time-out photos contain GPS coordinates.
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="outline" disabled={attendanceSavingId === log.log_id} onClick={() => decideAttendance(log, 'return')} className="border-red-200 text-red-700"><RotateCcw className="mr-2 h-4 w-4" />Return Evidence</Button>
                    <Button disabled={attendanceSavingId === log.log_id || !evidenceComplete} title={evidenceComplete ? 'Validate this attendance record.' : 'Both GPS-stamped time-in and time-out photos are required.'} onClick={() => decideAttendance(log, 'approve')} className="text-white disabled:cursor-not-allowed disabled:opacity-50" style={{ background: theme.base }}>{attendanceSavingId === log.log_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Validate Attendance</Button>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-stone-200 px-5 py-10 text-center text-sm text-stone-500">No completed attendance evidence is waiting for validation.</div>
        )}
        </section>
      )}
    </div>
  );
}


