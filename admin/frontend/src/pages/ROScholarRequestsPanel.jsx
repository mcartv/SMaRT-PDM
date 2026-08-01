import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Loader2,
  RefreshCw,
  Search,
  Users,
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
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && !loading && onClose()}
    >
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">
              Mark request as {action}
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
            {action === 'Acknowledged'
              ? 'The coordinator will know that Admin has received and is reviewing the request.'
              : action === 'Fulfilled'
                ? 'Use this after the requested scholar placements have been arranged.'
                : 'The coordinator will receive your reason for declining the request.'}
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
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(remarks)}
            disabled={loading || (declining && !remarks.trim())}
            className={declining ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Confirm
          </Button>
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

  return (
    <section className="space-y-4">
      <ActionModal
        key={`${actionState.request?.request_id || 'none'}-${actionState.action || 'none'}`}
        action={actionState.action}
        request={actionState.request}
        loading={saving}
        onClose={() => !saving && setActionState({ action: '', request: null })}
        onConfirm={updateRequest}
      />

      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-900">RO Area Requests</h2>
            <p className="mt-1 text-xs text-stone-500">
              Offices requesting scholars for Return of Obligation service.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex flex-wrap gap-1 rounded-xl bg-stone-50 p-1">
              {['Pending', 'Acknowledged', 'Fulfilled', 'All'].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setStatus(item)}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                    status === item
                      ? 'bg-white text-stone-900 shadow-sm'
                      : 'text-stone-500'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search area or purpose..."
                className="h-10 min-w-64 rounded-xl border-stone-200 pl-9"
              />
            </div>
            <Button
              variant="outline"
              onClick={loadRequests}
              disabled={loading}
              className="h-10 border-stone-200"
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
                    className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusClass(request.request_status)}`}
                  >
                    {request.request_status}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-stone-50 p-3">
                    <Users className="h-4 w-4 text-stone-400" />
                    <p className="mt-2 text-xs text-stone-500">Scholars needed</p>
                    <p className="text-sm font-semibold text-stone-900">
                      {request.requested_scholar_count}
                    </p>
                  </div>
                  <div className="rounded-xl bg-stone-50 p-3">
                    <CalendarDays className="h-4 w-4 text-stone-400" />
                    <p className="mt-2 text-xs text-stone-500">Preferred date</p>
                    <p className="text-sm font-semibold text-stone-900">
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

                {active ? (
                  <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-3">
                    {request.request_status === 'Pending' ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setActionState({ action: 'Acknowledged', request })
                        }
                        className="border-blue-200 text-blue-700"
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5" />
                        Acknowledge
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      onClick={() => setActionState({ action: 'Fulfilled', request })}
                      className="bg-emerald-600 text-white"
                    >
                      Mark Fulfilled
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActionState({ action: 'Declined', request })}
                      className="border-red-200 text-red-700"
                    >
                      Decline
                    </Button>
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
