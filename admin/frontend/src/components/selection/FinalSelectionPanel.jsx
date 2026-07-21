import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Trophy,
  Users,
  UsersRound,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

async function responseMessage(response, fallback) {
  try {
    const payload = await response.json();
    return payload?.message || payload?.error || fallback;
  } catch {
    return fallback;
  }
}

function formatDateTime(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function DecisionBadge({ value }) {
  const normalized = String(value || '').toLowerCase();
  const classes = normalized === 'selected'
    ? 'border-green-200 bg-green-50 text-green-700'
    : normalized === 'promoted'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : normalized === 'waitlisted'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : 'border-stone-200 bg-stone-50 text-stone-600';

  return (
    <Badge variant="outline" className={`rounded-full px-2.5 py-1 text-[11px] ${classes}`}>
      {value || 'Qualified'}
    </Badge>
  );
}

export default function FinalSelectionPanel({ openingId, onFinalized }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState('');

  const load = async ({ soft = false } = {}) => {
    try {
      soft ? setRefreshing(true) : setLoading(true);
      setError('');
      const response = await fetch(
        buildApiUrl(`/api/selections/openings/${openingId}/preview`),
        {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) {
        throw new Error(await responseMessage(response, 'Failed to load final selection preview.'));
      }
      setData(await response.json());
    } catch (err) {
      setError(err.message || 'Failed to load final selection preview.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [openingId]);

  const finalize = async () => {
    const selected = Number(data?.summary?.selected_count || 0);
    const waitlisted = Number(data?.summary?.waitlisted_count || 0);
    const confirmed = window.confirm(
      `Finalize this applicant list?\n\n${selected} applicant(s) will become scholars and ${waitlisted} applicant(s) will be placed on the waiting list. This list will be locked.`
    );
    if (!confirmed) return;

    try {
      setFinalizing(true);
      setError('');
      const response = await fetch(
        buildApiUrl(`/api/selections/openings/${openingId}/finalize`),
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            notes: 'Finalized using requirements-completion FCFS ordering.',
          }),
        }
      );
      if (!response.ok) {
        throw new Error(await responseMessage(response, 'Failed to finalize applicant list.'));
      }
      await load({ soft: true });
      onFinalized?.();
    } catch (err) {
      setError(err.message || 'Failed to finalize applicant list.');
    } finally {
      setFinalizing(false);
    }
  };

  const entries = useMemo(() => data?.entries || [], [data]);
  const summary = data?.summary || {};

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center gap-2 text-sm text-stone-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Preparing the FCFS list...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="rounded-2xl border-stone-200 shadow-none">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                {data?.finalized ? (
                  <LockKeyhole className="h-5 w-5 text-green-600" />
                ) : (
                  <Clock3 className="h-5 w-5 text-amber-600" />
                )}
                <h2 className="text-base font-semibold text-stone-900">
                  {data?.finalized ? 'Final Applicant List' : 'Final Selection Preview'}
                </h2>
              </div>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
                Applicants are ordered by the time their last valid required document was submitted.
                Administrative verification time does not change the queue order. Only applicants with
                verified requirements and a completed endorsement are included.
              </p>
              {data?.finalized && data?.batch?.finalized_at ? (
                <p className="mt-2 text-xs font-medium text-green-700">
                  Finalized {formatDateTime(data.batch.finalized_at)}
                </p>
              ) : null}
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => load({ soft: true })}
                disabled={refreshing || finalizing}
                className="rounded-xl border-stone-200"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {!data?.finalized ? (
                <Button
                  type="button"
                  onClick={finalize}
                  disabled={finalizing || entries.length === 0}
                  className="rounded-xl bg-stone-900 text-white hover:bg-stone-800"
                >
                  {finalizing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                  Finalize List
                </Button>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      {error ? (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Allocated Slots', summary.capacity, Trophy],
          ['Already Occupied', summary.occupied_before, Users],
          ['Available Slots', summary.available_slots, CheckCircle2],
          ['Selected', summary.selected_count, UsersRound],
          ['Waiting List', summary.waitlisted_count, Clock3],
        ].map(([label, value, Icon]) => (
          <div key={label} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-stone-500">{label}</p>
              <Icon className="h-4 w-4 text-stone-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold text-stone-900">{Number(value || 0)}</p>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden rounded-2xl border-stone-200 shadow-none">
        <div className="border-b border-stone-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-stone-900">Requirements-Completion Queue</h3>
          <p className="mt-1 text-xs text-stone-500">
            Tie-breakers: application submission time, then application ID.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-stone-50 text-left text-[11px] uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-5 py-3">Queue</th>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Course / Year</th>
                <th className="px-4 py-3">Requirements Completed</th>
                <th className="px-4 py-3">Result</th>
                <th className="px-4 py-3">Waiting Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-stone-400">
                    No applicants have completed both requirements and endorsement yet.
                  </td>
                </tr>
              ) : entries.map((entry) => (
                <tr key={entry.application_id} className="hover:bg-stone-50/70">
                  <td className="px-5 py-4">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-stone-900 text-xs font-semibold text-white">
                      {entry.queue_position}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-stone-900">{entry.applicant_name || 'Applicant'}</p>
                    <p className="mt-1 text-xs text-stone-500">{entry.pdm_id || 'No PDM ID'}</p>
                  </td>
                  <td className="px-4 py-4 text-stone-600">
                    <p>{entry.course_code || entry.course_name || '—'}</p>
                    <p className="mt-1 text-xs text-stone-400">Year {entry.year_level || '—'}</p>
                  </td>
                  <td className="px-4 py-4 text-stone-600">
                    {formatDateTime(entry.requirements_completed_at)}
                  </td>
                  <td className="px-4 py-4"><DecisionBadge value={entry.decision} /></td>
                  <td className="px-4 py-4 text-stone-600">
                    {entry.waitlist_position ? `#${entry.waitlist_position}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
