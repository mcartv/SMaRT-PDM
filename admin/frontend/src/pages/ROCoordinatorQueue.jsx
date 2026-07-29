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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [decisionState, setDecisionState] = useState({ request: null, decision: '' });
  const [saving, setSaving] = useState(false);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ status });
    if (search.trim()) params.set('search', search.trim());
    return `/api/ro-coordinator/requests?${params.toString()}`;
  }, [search, status]);

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

  useEffect(() => {
    const timer = window.setTimeout(() => loadRequests(), 220);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  useSocketEvent('ro:updated', () => loadRequests({ soft: true }), [loadRequests]);

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
          <h1 className="mt-1 text-2xl font-semibold text-stone-900">Approval Requests</h1>
          <p className="mt-1 text-sm text-stone-500">{department || 'Your assigned area'} · Review requests before scholars begin RO work.</p>
        </div>
        <Button variant="outline" onClick={() => loadRequests({ soft: true })} disabled={refreshing} className="border-stone-200">
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-3">
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
      </div>

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[340px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin" style={{ color: theme.base }} />
        </div>
      ) : items.length ? (
        <div className="space-y-3">
          {items.map((request) => {
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
          <p className="mt-1 text-xs text-stone-500">{status === 'pending' ? 'You are caught up. New requests appear here automatically.' : 'Try another status or clear your search.'}</p>
        </div>
      )}
    </div>
  );
}
