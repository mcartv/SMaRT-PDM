import { createElement, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Loader2,
  RefreshCw,
  RotateCcw,
  UsersRound,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSocketEvent } from '@/hooks/useSocket';
import usePortalTheme from '@/hooks/usePortalTheme';

const tokenKey = 'roCoordinatorToken';

function authHeaders() {
  return {
    Authorization: `Bearer ${sessionStorage.getItem(tokenKey) || ''}`,
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

function SummaryCard({ icon, label, value, detail, theme }) {
  return (
    <Card className="rounded-2xl border-stone-200 bg-white shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-stone-400">{label}</p>
            <p className="mt-2 text-3xl font-semibold text-stone-900">{value}</p>
            <p className="mt-1 text-xs text-stone-500">{detail}</p>
          </div>
          <span
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ background: theme.accentSoft, color: theme.base }}
          >
            {createElement(icon, { className: 'h-5 w-5' })}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ROCoordinatorDashboard() {
  const navigate = useNavigate();
  const { theme } = usePortalTheme('ro_coordinator');
  const [summary, setSummary] = useState({});
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async ({ soft = false } = {}) => {
    try {
      soft ? setRefreshing(true) : setLoading(true);
      setError('');
      const [summaryResponse, queueResponse] = await Promise.all([
        fetch(buildApiUrl('/api/ro-coordinator/summary'), { headers: authHeaders() }),
        fetch(buildApiUrl('/api/ro-coordinator/requests?status=pending'), { headers: authHeaders() }),
      ]);
      const summaryPayload = await summaryResponse.json().catch(() => ({}));
      const queuePayload = await queueResponse.json().catch(() => ({}));
      if (!summaryResponse.ok) throw new Error(summaryPayload.message || 'Failed to load dashboard summary.');
      if (!queueResponse.ok) throw new Error(queuePayload.message || 'Failed to load pending requests.');
      setSummary(summaryPayload);
      setRequests(Array.isArray(queuePayload.items) ? queuePayload.items.slice(0, 5) : []);
    } catch (loadError) {
      setError(loadError.message || 'Failed to load RO Coordinator dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useSocketEvent('ro:updated', () => loadDashboard({ soft: true }), [loadDashboard]);

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin" style={{ color: theme.base }} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section
        className="overflow-hidden rounded-[28px] px-6 py-6 text-white md:px-8"
        style={{ background: `linear-gradient(120deg, ${theme.base}, ${theme.active})` }}
      >
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65">Assigned RO Area</p>
            <h1 className="mt-2 max-w-3xl text-2xl font-semibold md:text-3xl">
              {summary.department || 'RO Coordinator Dashboard'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-white/75">
              Review incoming Return of Obligation requests before scholars begin their assigned work.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => navigate('/ro-coordinator/queue')}
            className="border border-white/20 bg-white text-stone-900 hover:bg-white/90"
          >
            Open My Queue
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard icon={Clock3} label="Approval Requests" value={summary.pending_count || 0} detail="Waiting for your decision" theme={theme} />
        <SummaryCard icon={CheckCircle2} label="Approved Today" value={summary.approved_today || 0} detail="Assignments released today" theme={theme} />
        <SummaryCard icon={RotateCcw} label="Returned Today" value={summary.rejected_today || 0} detail="Sent back to Admin" theme={theme} />
        <SummaryCard icon={UsersRound} label="Active RO" value={summary.active_count || 0} detail="Approved and not yet cleared" theme={theme} />
      </div>

      <Card className="overflow-hidden rounded-[24px] border-stone-200 shadow-none">
        <div className="flex flex-col gap-3 border-b border-stone-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-stone-900">Priority Requests</h2>
            <p className="mt-1 text-sm text-stone-500">The oldest pending requests in your assigned area.</p>
          </div>
          <Button variant="outline" onClick={() => loadDashboard({ soft: true })} disabled={refreshing} className="border-stone-200">
            {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>
        <CardContent className="p-5">
          {error ? <p className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
          {requests.length ? (
            <div className="divide-y divide-stone-100">
              {requests.map((request) => (
                <button
                  key={request.ro_id}
                  type="button"
                  onClick={() => navigate('/ro-coordinator/queue')}
                  className="flex w-full items-center gap-4 py-4 text-left transition hover:bg-stone-50"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: theme.accentSoft, color: theme.base }}>
                    <ClipboardCheck className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-stone-900">
                      {request.first_name} {request.last_name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-stone-500">
                      {request.pdm_id} · {request.course_code || 'Course not set'} · {request.required_hours || 0} hours
                    </span>
                  </span>
                  <span className="hidden shrink-0 text-xs text-stone-400 sm:block">{formatDate(request.assigned_at || request.created_at)}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-stone-400" />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-200 px-6 py-12 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
              <p className="mt-3 text-sm font-semibold text-stone-800">No approval requests waiting</p>
              <p className="mt-1 text-xs text-stone-500">New Admin requests will appear here automatically.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
