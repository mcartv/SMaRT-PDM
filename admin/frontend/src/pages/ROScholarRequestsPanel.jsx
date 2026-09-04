import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Loader2,
  RefreshCw,
  Search,
  Users,
  UserPlus,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/api';
import { SectionLoadingSkeleton } from '@/components/system/PageLoadingSkeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSocketEvent } from '@/hooks/useSocket';

function formatDate(value, includeTime = false) {
  if (!value) return 'No preferred date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  });
}

function statusClass(status) {
  if (status === 'Fulfilled') return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (status === 'Acknowledged') return 'border-blue-100 bg-blue-50 text-blue-700';
  if (status === 'Declined' || status === 'Cancelled') {
    return 'border-red-100 bg-red-50 text-red-700';
  }
  return 'border-amber-100 bg-amber-50 text-amber-700';
}

function ActionModal({ action, request, loading, onClose, onConfirm }) {
  const [remarks, setRemarks] = useState('');
  if (!action || !request) return null;

  const declining = action === 'Declined';
  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4 font-sans backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && !loading && onClose()}
    >
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              Decline scholar request
            </h2>
            <p className="mt-1 text-xs text-stone-500">{request.assigned_area}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-3 p-5">
          <p className="rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-600">
            The coordinator will receive your reason for declining the request. Requests that are being fulfilled by assigned scholars are updated automatically instead.
          </p>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-stone-700">
              {declining ? 'Reason for declining' : 'Admin remarks (optional)'}
            </span>
            <textarea
              rows={4}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              className="w-full resize-none rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none"
            />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={loading} className="h-10 rounded-xl border-stone-200 px-3 text-sm font-medium text-stone-700">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(remarks)}
            disabled={loading || (declining && !remarks.trim())}
            className={`${declining ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'} h-10 rounded-xl px-3 text-sm font-medium`}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm
          </Button>
        </footer>
      </section>
    </div>
  );
}

function requestStatusLabel(status) {
  return status === 'Acknowledged' ? 'In Progress' : status;
}

function scholarName(scholar = {}) {
  return scholar.name || scholar.student_name || [
    scholar.first_name,
    scholar.middle_name,
    scholar.last_name,
  ].filter(Boolean).join(' ') || 'Scholar';
}

function hasActivePlacement(scholar = {}) {
  const placements = Array.isArray(scholar.placements) ? scholar.placements : [];
  if (placements.length) {
    return placements.some((placement) =>
      ['Pending', 'Approved'].includes(placement.placement_status)
    );
  }
  const status = String(scholar.assignment_status || scholar.assignmentStatus || '').trim();
  return Boolean(scholar.ro_id) && !['', 'Coordinator Rejected', 'Cleared'].includes(status);
}

function AssignScholarsModal({ request, token, loading, onClose, onAssigned }) {
  const [scholars, setScholars] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingScholars, setLoadingScholars] = useState(true);
  const [loadError, setLoadError] = useState('');

  const remaining = Math.max(0, Number(request?.remaining_assignment_count || 0));

  useEffect(() => {
    if (!request) return undefined;
    let active = true;
    (async () => {
      try {
        setLoadingScholars(true);
        setLoadError('');
        const response = await fetch(buildApiUrl('/api/ro/scholars?status=all'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Failed to load eligible scholars.');
        if (active) setScholars(Array.isArray(payload.scholars) ? payload.scholars : []);
      } catch (error) {
        if (active) setLoadError(error.message || 'Failed to load eligible scholars.');
      } finally {
        if (active) setLoadingScholars(false);
      }
    })();
    return () => { active = false; };
  }, [request, token]);

  if (!request) return null;

  const needle = search.trim().toLowerCase();
  const visible = scholars.filter((scholar) => {
    const haystack = [
      scholarName(scholar),
      scholar.pdm_id,
      scholar.course_code,
      scholar.course_name,
      scholar.program_name,
    ].filter(Boolean).join(' ').toLowerCase();
    return !needle || haystack.includes(needle);
  });

  const toggleScholar = (scholar) => {
    const id = String(scholar.student_id || '');
    if (!id || hasActivePlacement(scholar)) return;
    setSelectedIds((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= remaining) return current;
      return [...current, id];
    });
  };

  const submit = async () => {
    if (!selectedIds.length) return;
    try {
      await onAssigned(selectedIds);
    } catch (_) {
      // Parent owns toast/error state.
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 font-sans backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && !loading && onClose()}
    >
      <section className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Assign Scholars</h2>
            <p className="mt-1 text-xs text-stone-500">
              {request.assigned_area} · {remaining} more scholar{remaining === 1 ? '' : 's'} needed
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="rounded-lg p-2 text-stone-400 hover:bg-stone-100">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-stone-100 p-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-xl bg-stone-50 p-3 text-sm">
              <p className="text-xs text-stone-500">Requested</p>
              <p className="mt-1 font-semibold text-stone-900">{request.requested_scholar_count}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-3 text-sm">
              <p className="text-xs text-emerald-700">Acknowledged</p>
              <p className="mt-1 font-semibold text-emerald-900">{request.acknowledged_count || 0}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-3 text-sm">
              <p className="text-xs text-blue-700">Awaiting acknowledgment</p>
              <p className="mt-1 font-semibold text-blue-900">{request.awaiting_acknowledgment_count || 0}</p>
            </div>
          </div>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search scholar, ID, course, or scholarship..." className="h-10 rounded-xl border-stone-200 bg-white pl-10 text-sm" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {loadError ? (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</div>
          ) : loadingScholars ? (
            <SectionLoadingSkeleton label="Loading eligible scholars" rows={5} />
          ) : visible.length ? (
            <div className="space-y-2">
              {visible.map((scholar) => {
                const id = String(scholar.student_id || '');
                const unavailable = hasActivePlacement(scholar);
                const selected = selectedIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleScholar(scholar)}
                    disabled={unavailable}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${
                      unavailable
                        ? 'cursor-not-allowed border-stone-100 bg-stone-50 opacity-55'
                        : selected
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-900">{scholarName(scholar)}</p>
                      <p className="mt-0.5 truncate text-xs text-stone-500">
                        {[scholar.pdm_id, scholar.course_code || scholar.course_name, scholar.program_name].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${unavailable ? 'bg-stone-200 text-stone-600' : selected ? 'bg-blue-600 text-white' : 'bg-emerald-50 text-emerald-700'}`}>
                      {unavailable ? 'Already assigned' : selected ? 'Selected' : 'Eligible'}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-stone-200 px-5 py-10 text-center text-sm text-stone-500">No matching scholars.</div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-stone-100 bg-stone-50 px-5 py-3">
          <p className="text-xs text-stone-500">Selected {selectedIds.length} / {remaining}</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button onClick={submit} disabled={loading || !selectedIds.length || remaining <= 0} className="bg-blue-600 text-white hover:bg-blue-700">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
              Send Assignments
            </Button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default function ROScholarRequestsPanel({ token }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState('Pending');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState({ action: '', request: null });
  const [assignRequest, setAssignRequest] = useState(null);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== 'All') params.set('status', status);
    if (search.trim()) params.set('search', search.trim());
    return `/api/ro/scholar-requests?${params.toString()}`;
  }, [search, status]);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch(buildApiUrl(requestUrl), {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to load area requests.');
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load area requests.');
    } finally {
      setLoading(false);
    }
  }, [requestUrl, token]);

  useEffect(() => {
    const timeout = window.setTimeout(loadRequests, 180);
    return () => window.clearTimeout(timeout);
  }, [loadRequests]);

  useSocketEvent('ro:updated', loadRequests, [loadRequests]);

  const updateRequest = async (remarks) => {
    const { action, request } = actionState;
    if (!action || !request) return;
    try {
      setSaving(true);
      const response = await fetch(buildApiUrl(`/api/ro/scholar-requests/${request.request_id}`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: action, remarks: remarks.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to update request.');
      setActionState({ action: '', request: null });
      toast.success(payload.message || 'Scholar request updated.');
      await loadRequests();
    } catch (updateError) {
      toast.error('Request was not updated', { description: updateError.message });
    } finally {
      setSaving(false);
    }
  };

  const assignScholars = async (studentIds) => {
    if (!assignRequest) return;
    try {
      setSaving(true);
      const response = await fetch(
        buildApiUrl(`/api/ro/scholar-requests/${assignRequest.request_id}/assign`),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ studentIds }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to assign scholars.');
      setAssignRequest(null);
      if (payload.failed_count) {
        toast.warning('Some scholars were not assigned', {
          description: `${payload.success_count || 0} assigned, ${payload.failed_count} failed.`,
        });
      } else {
        toast.success(payload.message || 'Scholars assigned.');
      }
      await loadRequests();
    } catch (assignError) {
      toast.error('Scholars were not assigned', { description: assignError.message });
      throw assignError;
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 font-sans">
      <ActionModal
        key={`${actionState.request?.request_id || 'none'}-${actionState.action || 'none'}`}
        action={actionState.action}
        request={actionState.request}
        loading={saving}
        onClose={() => !saving && setActionState({ action: '', request: null })}
        onConfirm={updateRequest}
      />

      <AssignScholarsModal
        key={assignRequest?.request_id || 'no-assignment-request'}
        request={assignRequest}
        token={token}
        loading={saving}
        onClose={() => !saving && setAssignRequest(null)}
        onAssigned={assignScholars}
      />

      <div className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-sm font-semibold leading-5 text-stone-900">RO Area Requests</h2>
            <p className="mt-1 text-sm text-stone-500">
              Offices requesting scholars for Return of Obligation service.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex w-full rounded-xl bg-stone-100 p-1 sm:w-auto">
              {['Pending', 'Acknowledged', 'Fulfilled', 'All'].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStatus(item)}
                  className={`inline-flex flex-1 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${
                    status === item
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-600'
                  }`}
                >
                  {item === 'Acknowledged' ? 'In Progress' : item}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search area or purpose..."
                className="h-10 min-w-64 rounded-xl border-stone-200 bg-stone-50 pl-10 text-sm"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadRequests}
              disabled={loading}
              className="h-10 rounded-xl border-stone-200 bg-white px-3 text-sm font-medium text-stone-700"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <SectionLoadingSkeleton label="Loading RO scholar requests" rows={4} />
      ) : items.length ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map((request) => {
            const active = ['Pending', 'Acknowledged'].includes(request.request_status);
            return (
              <article
                key={request.request_id}
                className="rounded-2xl border border-stone-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">
                      {request.assigned_area}
                    </p>
                    <p className="mt-1 text-xs text-stone-400">
                      {request.requested_by_name || 'RO Coordinator'} - {formatDate(request.created_at, true)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusClass(request.request_status)}`}
                  >
                    {requestStatusLabel(request.request_status)}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-stone-50 p-3">
                    <Users className="h-4 w-4 text-stone-400" />
                    <p className="mt-2 text-xs text-stone-500">Scholars needed</p>
                    <p className="text-sm font-medium text-stone-900">
                      {request.requested_scholar_count}
                    </p>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-3">
                    <CalendarDays className="h-4 w-4 text-stone-400" />
                    <p className="mt-2 text-xs text-stone-500">Preferred date</p>
                    <p className="text-sm font-medium text-stone-900">
                      {formatDate(request.preferred_date)}
                    </p>
                  </div>
                </div>

                <p className="mt-3 text-sm leading-6 text-stone-600">{request.purpose}</p>
                {request.admin_remarks ? (
                  <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-900">
                    {request.admin_remarks}
                  </p>
                ) : null}

                {Array.isArray(request.assigned_scholars) && request.assigned_scholars.length ? (
                  <div className="mt-4 space-y-2 border-t border-stone-100 pt-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-emerald-50 px-2 py-2"><p className="text-[10px] text-emerald-700">Confirmed</p><p className="text-sm font-semibold text-emerald-900">{request.acknowledged_count || 0}</p></div>
                      <div className="rounded-lg bg-blue-50 px-2 py-2"><p className="text-[10px] text-blue-700">Awaiting</p><p className="text-sm font-semibold text-blue-900">{request.awaiting_acknowledgment_count || 0}</p></div>
                      <div className="rounded-lg bg-amber-50 px-2 py-2"><p className="text-[10px] text-amber-700">Concern</p><p className="text-sm font-semibold text-amber-900">{request.concern_count || 0}</p></div>
                    </div>
                    <div className="space-y-1">
                      {request.assigned_scholars.map((scholar) => {
                        const replaced = String(scholar.placement_status || '').toLowerCase() === 'cancelled';
                        const concern = Boolean(scholar.conflict_reason) && !replaced;
                        const acknowledged = Boolean(scholar.acknowledged_at) && !concern && !replaced;
                        const statusClass = replaced
                          ? 'bg-stone-200 text-stone-700'
                          : concern
                            ? 'bg-amber-100 text-amber-800'
                            : acknowledged
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800';
                        const statusLabel = replaced
                          ? 'Replaced'
                          : concern
                            ? 'Concern reported'
                            : acknowledged
                              ? 'Acknowledged'
                              : 'Awaiting acknowledgment';
                        return (
                          <div key={scholar.placement_id} className="flex items-center justify-between gap-2 rounded-lg bg-stone-50 px-3 py-2">
                            <div className="min-w-0"><p className="truncate text-xs font-medium text-stone-800">{scholar.student_name || 'Scholar'}</p><p className="text-[10px] text-stone-500">{scholar.pdm_id || ''}</p></div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass}`}>{statusLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {active ? (
                  <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-3">
                    {Number(request.remaining_assignment_count || 0) > 0 ? (
                      <Button
                        size="sm"
                        onClick={() => setAssignRequest(request)}
                        className="h-9 rounded-xl bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700"
                      >
                        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                        Assign Scholars ({request.remaining_assignment_count})
                      </Button>
                    ) : (
                      <span className="inline-flex items-center rounded-xl bg-stone-100 px-3 py-2 text-xs font-medium text-stone-600">
                        Waiting for scholar acknowledgment
                      </span>
                    )}
                    {request.request_status === 'Pending' && Number(request.active_assignment_count || 0) === 0 ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setActionState({ action: 'Declined', request })}
                        className="h-9 rounded-xl border-red-200 px-3 text-sm font-medium text-red-700"
                      >
                        Decline
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-14 text-center">
          <Users className="mx-auto h-9 w-9 text-stone-300" />
          <p className="mt-3 text-sm font-semibold text-stone-800">
            No {status === 'All' ? '' : status.toLowerCase()} area requests
          </p>
        </div>
      )}
    </section>
  );
}
