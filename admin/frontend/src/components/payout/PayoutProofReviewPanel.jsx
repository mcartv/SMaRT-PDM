import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  Loader2,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { buildApiUrl } from '@/api';

const API_BASE = buildApiUrl('/api');

const STATUS_META = {
  'Pending Review': {
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  Verified: {
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  Rejected: {
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  'Resubmission Required': {
    className: 'border-red-200 bg-red-50 text-red-700',
  },
};

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sessionStorage.getItem('adminToken') || ''}`,
  };
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function proofName(item) {
  return (
    item.student_name ||
    [item.first_name, item.middle_name, item.last_name].filter(Boolean).join(' ') ||
    'Scholar'
  );
}

export default function PayoutProofReviewPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Pending Review');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (status !== 'All') params.set('status', status);
      const response = await fetch(`${API_BASE}/payouts/proofs?${params.toString()}`, {
        headers: authHeaders(),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to load payout proofs.');
      }
      setItems(Array.isArray(payload.items) ? payload.items : []);
    } catch (requestError) {
      setItems([]);
      setError(requestError.message || 'Unable to load payout proofs.');
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [
        proofName(item),
        item.student_id,
        item.pdm_id,
        item.payout_title,
        item.program_name,
        item.file_name,
        item.proof_status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [items, search]);

  const review = async (nextStatus) => {
    if (!selected?.payout_proof_id) return;
    if (nextStatus !== 'Verified' && !comment.trim()) {
      setError('Add a review comment before requesting resubmission.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const response = await fetch(
        `${API_BASE}/payouts/proofs/${selected.payout_proof_id}/review`,
        {
          method: 'PATCH',
          headers: authHeaders(),
          body: JSON.stringify({
            status: nextStatus,
            comment: comment.trim(),
          }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.message || 'Unable to review payout proof.');
      }
      setSelected(null);
      setComment('');
      await load();
    } catch (requestError) {
      setError(requestError.message || 'Unable to review payout proof.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-stone-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-stone-800">Payout Proof Review</h2>
          <p className="mt-1 text-xs text-stone-500">
            Verify scholar acknowledgments or request a clearer replacement file.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm text-stone-700"
          >
            {['Pending Review', 'Verified', 'Resubmission Required', 'Rejected', 'All'].map(
              (option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              )
            )}
          </select>
          <div className="relative min-w-[250px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search scholar or payout..."
              className="h-10 rounded-xl border-stone-200 bg-stone-50 pl-9"
            />
          </div>
          <Button variant="outline" className="h-10 rounded-xl" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <CardContent className="p-4">
        {loading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-stone-400">
            No payout proofs match the selected filter.
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const meta = STATUS_META[item.proof_status] || STATUS_META['Pending Review'];
              return (
                <Card key={item.payout_proof_id} className="border-stone-200 shadow-none">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-900">
                          {proofName(item)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-stone-500">
                          {item.pdm_id || item.student_id || 'No student ID'}
                        </p>
                      </div>
                      <Badge variant="outline" className={meta.className}>
                        {item.proof_status || 'Pending Review'}
                      </Badge>
                    </div>

                    <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
                      <p className="font-medium text-stone-800">
                        {item.payout_title || 'Scholarship Payout'}
                      </p>
                      <p className="mt-1">{item.program_name || 'Scholarship Program'}</p>
                      <p className="mt-1">Submitted: {formatDate(item.submitted_at)}</p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 rounded-xl"
                        onClick={() => window.open(item.signed_url || item.file_url, '_blank', 'noopener,noreferrer')}
                        disabled={!item.signed_url && !item.file_url}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        View File
                      </Button>
                      <Button
                        className="flex-1 rounded-xl bg-[#7c4a2e] text-white hover:bg-[#693e27]"
                        onClick={() => {
                          setSelected(item);
                          setComment(item.admin_comment || '');
                          setError('');
                        }}
                      >
                        <FileCheck2 className="mr-2 h-4 w-4" />
                        Review
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>

      {selected ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => !saving && setSelected(null)}
        >
          <Card className="w-full max-w-lg border-stone-200 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-stone-100 px-5 py-4">
              <h3 className="font-semibold text-stone-900">Review Payout Proof</h3>
              <p className="mt-1 text-xs text-stone-500">
                {proofName(selected)} · {selected.payout_title || 'Scholarship Payout'}
              </p>
            </div>
            <CardContent className="space-y-4 p-5">
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => window.open(selected.signed_url || selected.file_url, '_blank', 'noopener,noreferrer')}
                disabled={!selected.signed_url && !selected.file_url}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open Submitted File
              </Button>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-stone-600">Review comment</label>
                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Required when requesting resubmission."
                  className="min-h-28 rounded-xl border-stone-200"
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl border-red-200 text-red-700 hover:bg-red-50"
                  onClick={() => review('Resubmission Required')}
                  disabled={saving}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Request Resubmission
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => review('Verified')}
                  disabled={saving}
                >
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Verify Proof
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
