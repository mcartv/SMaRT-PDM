import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Loader2,
  Plus,
  RefreshCw,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { useSocketEvent } from '@/hooks/useSocket';
import usePortalTheme from '@/hooks/usePortalTheme';
import { SectionLoadingSkeleton } from '@/components/system/PageLoadingSkeleton';

function headers(tokenStorageKey) {
  return {
    Authorization: `Bearer ${sessionStorage.getItem(tokenStorageKey) || ''}`,
    'Content-Type': 'application/json',
  };
}

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

function statusLabel(request = {}) {
  const status = request.request_status;
  if (['Fulfilled', 'Declined', 'Cancelled'].includes(status)) return status;
  return request.assignment_stage || (status === 'Acknowledged' ? 'Assigned' : status);
}

function statusStyle(status) {
  if (status === 'Fulfilled') return 'border-emerald-100 bg-emerald-50 text-emerald-700';
  if (status === 'Declined' || status === 'Cancelled') {
    return 'border-red-100 bg-red-50 text-red-700';
  }
  if (status === 'Partially Assigned' || status === 'Fully Assigned') return 'border-blue-100 bg-blue-50 text-blue-700';
  return 'border-amber-100 bg-amber-50 text-amber-700';
}

function RequestModal({ open, areas, loading, onClose, onSubmit, theme }) {
  const [roAreaId, setRoAreaId] = useState(areas.length === 1 ? areas[0].ro_area_id : '');
  const [requestedCount, setRequestedCount] = useState(1);
  const [preferredDate, setPreferredDate] = useState('');
  const [purpose, setPurpose] = useState('');

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onMouseDown={(event) => event.target === event.currentTarget && !loading && onClose()}
    >
      <section className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Request Scholars</h2>
            <p className="mt-1 text-xs text-stone-500">
              Tell Admin how many scholars your RO Area currently needs.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-stone-700">RO Area</span>
            <select
              value={roAreaId}
              onChange={(event) => setRoAreaId(event.target.value)}
              className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none"
            >
              <option value="">Select an RO Area</option>
              {areas.map((area) => (
                <option key={area.ro_area_id} value={area.ro_area_id}>
                  {area.department_name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-stone-700">
              Scholars Needed
            </span>
            <input
              type="number"
              min="1"
              max="20"
              value={requestedCount}
              onChange={(event) => setRequestedCount(event.target.value)}
              className="h-10 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-stone-700">
              Preferred Date
            </span>
            <input
              type="date"
              value={preferredDate}
              onChange={(event) => setPreferredDate(event.target.value)}
              className="h-10 w-full rounded-xl border border-stone-200 px-3 text-sm outline-none"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold text-stone-700">
              Purpose or Task
            </span>
            <textarea
              rows={4}
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="Example: Help organize student records and prepare event materials."
              className="w-full resize-none rounded-xl border border-stone-200 px-3 py-2.5 text-sm outline-none"
            />
          </label>
        </div>

        <footer className="flex justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-3">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onSubmit({
                roAreaId,
                requestedScholarCount: Number(requestedCount),
                preferredDate,
                purpose,
              })
            }
            disabled={
              loading ||
              !roAreaId ||
              !purpose.trim() ||
              Number(requestedCount) < 1 ||
              Number(requestedCount) > 20
            }
            className="text-white"
            style={{ background: theme.base }}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send to Admin
          </Button>
        </footer>
      </section>
    </div>
  );
}

export default function ROCoordinatorScholarRequests({
  tokenStorageKey = 'roCoordinatorToken',
  portalKey = 'ro_coordinator',
}) {
  const { theme } = usePortalTheme(portalKey);
  const [areas, setAreas] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async ({ soft = false } = {}) => {
    try {
      soft ? setRefreshing(true) : setLoading(true);
      setError('');
      const response = await fetch(buildApiUrl('/api/ro-coordinator/scholar-requests'), {
        headers: headers(tokenStorageKey),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Failed to load scholar requests.');
      setAreas(Array.isArray(payload.areas) ? payload.areas : []);
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load scholar requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tokenStorageKey]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useSocketEvent('ro:updated', () => loadRequests({ soft: true }), [loadRequests]);

  const submitRequest = async (payload) => {
    try {
      setSaving(true);
      const response = await fetch(buildApiUrl('/api/ro-coordinator/scholar-requests'), {
        method: 'POST',
        headers: headers(tokenStorageKey),
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed to send scholar request.');
      setModalOpen(false);
      toast.success('Scholar request sent', {
        description: 'Admin has been notified and can review your request.',
      });
      await loadRequests({ soft: true });
    } catch (submitError) {
      toast.error('Request was not sent', { description: submitError.message });
    } finally {
      setSaving(false);
    }
  };

  const cancelRequest = async (requestId) => {
    try {
      const response = await fetch(
        buildApiUrl(`/api/ro-coordinator/scholar-requests/${requestId}/cancel`),
        { method: 'PATCH', headers: headers(tokenStorageKey) }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'Failed to cancel request.');
      toast.success('Scholar request cancelled');
      await loadRequests({ soft: true });
    } catch (cancelError) {
      toast.error('Request was not cancelled', { description: cancelError.message });
    }
  };

  return (
    <div className="space-y-4">
      <RequestModal
        key={modalOpen ? 'request-open' : 'request-closed'}
        open={modalOpen}
        areas={areas}
        loading={saving}
        onClose={() => !saving && setModalOpen(false)}
        onSubmit={submitRequest}
        theme={theme}
      />

      <div className="flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-stone-900">Scholar Requests</h2>
          <p className="mt-1 text-xs text-stone-500">
            Request available scholars from Admin for your area’s service needs.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => loadRequests({ soft: true })}
            disabled={refreshing}
            className="border-stone-200"
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
          <Button
            onClick={() => setModalOpen(true)}
            className="text-white"
            style={{ background: theme.base }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Request
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <SectionLoadingSkeleton label="Loading scholar requests" rows={4} />
      ) : items.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.request_id}
              className="rounded-2xl border border-stone-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-stone-900">{item.assigned_area}</p>
                  <p className="mt-1 text-xs text-stone-400">
                    Sent {formatDate(item.created_at, true)}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusStyle(statusLabel(item))}`}
                >
                  {statusLabel(item)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-stone-50 p-3">
                  <Users className="h-4 w-4 text-stone-400" />
                  <p className="mt-2 text-xs text-stone-500">Scholars needed</p>
                  <p className="text-sm font-semibold text-stone-900">
                    {item.requested_scholar_count}
                  </p>
                </div>
                <div className="rounded-xl bg-stone-50 p-3">
                  <CalendarDays className="h-4 w-4 text-stone-400" />
                  <p className="mt-2 text-xs text-stone-500">Preferred date</p>
                  <p className="text-sm font-semibold text-stone-900">
                    {formatDate(item.preferred_date)}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm leading-6 text-stone-600">{item.purpose}</p>

              {item.request_status !== 'Pending' || Number(item.active_assignment_count || 0) > 0 ? (
                <div className="mt-4 space-y-2 border-t border-stone-100 pt-3">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-emerald-50 px-2 py-2">
                      <p className="text-[10px] text-emerald-700">Confirmed</p>
                      <p className="text-sm font-semibold text-emerald-900">{item.acknowledged_count || 0}</p>
                    </div>
                    <div className="rounded-lg bg-blue-50 px-2 py-2">
                      <p className="text-[10px] text-blue-700">Awaiting</p>
                      <p className="text-sm font-semibold text-blue-900">{item.awaiting_acknowledgment_count || 0}</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 px-2 py-2">
                      <p className="text-[10px] text-amber-700">Concern</p>
                      <p className="text-sm font-semibold text-amber-900">{item.concern_count || 0}</p>
                    </div>
                  </div>
                  {Array.isArray(item.assigned_scholars) && item.assigned_scholars.length ? (
                    <div className="space-y-1">
                      {item.assigned_scholars.map((scholar) => {
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
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-stone-800">{scholar.student_name || 'Scholar'}</p>
                              <p className="text-[10px] text-stone-500">{scholar.pdm_id || ''}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${statusClass}`}>
                              {statusLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  {Number(item.remaining_confirmation_count || 0) > 0 ? (
                    <p className="text-xs text-stone-500">{item.remaining_confirmation_count} more scholar{Number(item.remaining_confirmation_count) === 1 ? '' : 's'} must acknowledge before this request is fulfilled.</p>
                  ) : null}
                </div>
              ) : null}

              {item.admin_remarks ? (
                <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                    Admin Remarks
                  </p>
                  <p className="mt-1 text-sm text-blue-900">{item.admin_remarks}</p>
                </div>
              ) : null}

              {item.request_status === 'Pending' ? (
                <div className="mt-4 flex justify-end border-t border-stone-100 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancelRequest(item.request_id)}
                    className="border-red-200 text-red-700 hover:bg-red-50"
                  >
                    Cancel Request
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-6 py-14 text-center">
          <Users className="mx-auto h-9 w-9 text-stone-300" />
          <p className="mt-3 text-sm font-semibold text-stone-800">No scholar requests yet</p>
          <p className="mt-1 text-xs text-stone-500">
            Create one when your RO Area needs scholar assistance.
          </p>
        </div>
      )}
    </div>
  );
}
