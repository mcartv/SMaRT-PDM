import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';

const API_BASE = buildApiUrl('/api');

const DOC_STATUS = {
  verified: {
    label: 'Verified',
    color: '#16a34a',
    bg: '#F0FDF4',
  },
  uploaded: {
    label: 'Pending Review',
    color: '#d97706',
    bg: '#FFF7ED',
  },
  rejected: {
    label: 'Re-upload',
    color: '#dc2626',
    bg: '#FEF2F2',
  },
  pending: {
    label: 'Missing',
    color: '#7c4a2e',
    bg: '#EFF6FF',
  },
};

export default function RenewalDocumentVerification() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [renewal, setRenewal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [docKey, setDocKey] = useState('');
  const [docStatuses, setDocStatuses] = useState({});
  const [docComments, setDocComments] = useState({});
  const [comment, setComment] = useState('');
  const [finalComment, setFinalComment] = useState('');
  const [submittingAction, setSubmittingAction] = useState('');

  const loadRenewal = useCallback(
    async ({ quiet = false } = {}) => {
      try {
        if (!quiet) setLoading(true);
        setError('');

        const response = await fetch(`${API_BASE}/renewals/${id}`, {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
            'Content-Type': 'application/json',
          },
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load renewal details');
        }

        setRenewal(payload);

        const initialDocuments = payload?.documents || [];
        const firstAvailable =
          initialDocuments.find((doc) => doc.url)?.id ||
          initialDocuments[0]?.id ||
          '';

        setDocKey((current) =>
          initialDocuments.some((doc) => doc.id === current)
            ? current
            : firstAvailable
        );

        const nextStatuses = {};
        const nextComments = {};

        initialDocuments.forEach((doc) => {
          nextStatuses[doc.id] = doc.status || 'pending';
          nextComments[doc.id] = doc.admin_comment || '';
        });

        setDocStatuses(nextStatuses);
        setDocComments(nextComments);
        setFinalComment(payload?.renewal?.admin_comment || '');
      } catch (err) {
        setError(err.message || 'Failed to load renewal details');
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [id]
  );

  useEffect(() => {
    loadRenewal();
  }, [loadRenewal]);

  useSocketEvent(
    'renewal:updated',
    (event) => {
      if (!event?.renewal_id || String(event.renewal_id) === String(id)) {
        loadRenewal({ quiet: true });
      }
    },
    [id, loadRenewal]
  );

  useSocketEvent(
    'renewal:approved',
    (event) => {
      if (!event?.renewal_id || String(event.renewal_id) === String(id)) {
        loadRenewal({ quiet: true });
      }
    },
    [id, loadRenewal]
  );

  const documents = useMemo(() => {
    const rawDocs = renewal?.documents || [];

    return rawDocs.map((doc) => ({
      ...doc,
      status: docStatuses[doc.id] || doc.status || 'pending',
      admin_comment: docComments[doc.id] || '',
    }));
  }, [renewal, docStatuses, docComments]);

  const activeDoc =
    documents.find((doc) => doc.id === docKey) || documents[0] || null;

  const isHistorical =
    renewal?.is_current_period === false ||
    renewal?.renewal?.is_current_period === false;

  useEffect(() => {
    if (activeDoc) {
      setComment(docComments[activeDoc.id] || '');
    }
  }, [activeDoc, docComments]);

  const setActiveStatus = (nextStatus) => {
    if (isHistorical || !activeDoc || !activeDoc.url) return;

    setDocStatuses((prev) => ({
      ...prev,
      [activeDoc.id]: nextStatus,
    }));

    setDocComments((prev) => ({
      ...prev,
      [activeDoc.id]: comment,
    }));
  };

  const handleSubmitReview = async (finalAction) => {
    if (isHistorical) {
      alert(
        'This renewal belongs to a historical semester and is read-only. Reactivate that semester from Maintenance > Academic Years if you need to continue its exact previous state.'
      );
      return;
    }

    try {
      setSubmittingAction(finalAction);

      const payload = {
        final_action: finalAction,
        final_comment: finalComment,
        document_reviews: documents.map((doc) => ({
          document_type: doc.document_type,
          name: doc.name,
          status: docStatuses[doc.id] || doc.status,
          comment: docComments[doc.id] || '',
          url: doc.url || null,
        })),
      };

      const response = await fetch(`${API_BASE}/renewals/${id}/review`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save renewal review');
      }

      alert('Renewal review saved successfully.');
      navigate('/admin/scholars?tab=renewals');
    } catch (err) {
      alert(err.message || 'Failed to save renewal review');
    } finally {
      setSubmittingAction('');
    }
  };

  if (loading) {
    return <PageLoadingSkeleton label="Loading renewal documents" variant="cards" />;
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center">
        <p className="text-sm font-semibold text-red-800">
          Failed to load renewal review
        </p>
        <p className="mt-1 text-xs text-red-600">{error}</p>
        <Button
          onClick={() => loadRenewal()}
          variant="outline"
          size="sm"
          className="mt-3"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-2.5 py-1 lg:h-[calc(100vh-118px)] lg:overflow-hidden">
      {isHistorical ? (
        <div className="shrink-0 rounded-lg border border-stone-200 bg-stone-100 px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-xs font-semibold text-stone-700">
              Historical semester · Read-only
            </p>
            <span className="text-xs text-stone-400">•</span>
            <p className="text-xs text-stone-500">
              {renewal?.renewal?.semester_label || 'Semester'}
              {renewal?.renewal?.school_year_label
                ? ` · AY ${renewal.renewal.school_year_label}`
                : ''}
            </p>
          </div>
        </div>
      ) : null}

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/scholars?tab=renewals')}
          className="h-8 w-8 rounded-lg border-stone-200 bg-white p-0"
        >
          <ArrowLeft size={14} />
        </Button>

        <div className="min-w-0">
          <p className="truncate text-xs text-stone-400">
            Scholar Monitoring / Renewals
          </p>
          <h1 className="text-base font-semibold text-stone-900">
            Renewal Verification
          </h1>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2.5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col gap-2.5">
          <Card className="shrink-0 border-stone-200 bg-white p-3 shadow-none">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-blue-900 text-xs text-white">
                  {renewal?.student?.initials || 'NA'}
                </AvatarFallback>
              </Avatar>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stone-900">
                  {renewal?.student?.name}
                </p>
                <p className="truncate text-xs text-stone-400">
                  {renewal?.student?.pdm_id}
                </p>
              </div>
            </div>

            <div className="mt-2.5 space-y-1 text-xs text-stone-500">
              <p className="truncate">{renewal?.student?.program}</p>
              <div className="flex items-center justify-between gap-2">
                <span>Status</span>
                <Badge
                  variant="outline"
                  className="h-6 max-w-[130px] truncate border-stone-200 px-2 text-xs font-medium text-stone-600"
                >
                  {renewal?.renewal_status || 'Pending'}
                </Badge>
              </div>
            </div>
          </Card>

          <Card className="min-h-0 flex-1 border-stone-200 bg-white p-2 shadow-none">
            <p className="px-1 pb-1.5 text-xs font-medium text-stone-500">
              Requirements
            </p>

            <div className="space-y-1 lg:max-h-full lg:overflow-y-auto">
              {documents.map((doc) => {
                const meta = DOC_STATUS[doc.status] || DOC_STATUS.pending;
                const isActive = activeDoc?.id === doc.id;

                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setDocKey(doc.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${isActive
                        ? 'bg-blue-50 text-blue-900'
                        : 'text-stone-600 hover:bg-stone-50'
                      }`}
                  >
                    <span className="min-w-0 flex-1 truncate">{doc.name}</span>

                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-xs"
                      style={{
                        background: meta.bg,
                        color: meta.color,
                      }}
                    >
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </aside>

        <main className="grid min-h-0 grid-cols-1 gap-2.5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <Card className="flex min-h-[360px] min-w-0 flex-col overflow-hidden border-stone-200 bg-white shadow-none lg:min-h-0">
            <div className="flex h-10 shrink-0 items-center justify-between border-b border-stone-100 bg-stone-50 px-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-stone-800">
                  {activeDoc?.name || 'Document'}
                </p>
              </div>

              {activeDoc?.url ? (
                <a
                  href={activeDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-3 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-blue-700 hover:underline"
                >
                  Open
                  <ExternalLink size={12} />
                </a>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center bg-stone-50/40">
              {activeDoc?.url ? (
                <iframe
                  src={activeDoc.url}
                  className="h-full min-h-[360px] w-full bg-white lg:min-h-0"
                  title={activeDoc.name || 'Renewal document'}
                />
              ) : (
                <div className="px-4 text-center">
                  <p className="text-sm font-medium text-stone-500">
                    No document uploaded
                  </p>
                  <p className="mt-1 text-xs text-stone-400">
                    This requirement has not been submitted yet.
                  </p>
                </div>
              )}
            </div>
          </Card>

          <div className="grid min-h-0 grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-1 xl:grid-rows-2">
            <Card className="flex min-h-0 flex-col border-stone-200 bg-white p-3 shadow-none">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
                  Document Feedback
                </p>

                {activeDoc ? (
                  <Badge
                    variant="outline"
                    className="h-6 border-stone-200 px-2 text-xs font-medium"
                  >
                    {(DOC_STATUS[activeDoc.status] || DOC_STATUS.pending).label}
                  </Badge>
                ) : null}
              </div>

              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                disabled={isHistorical || !activeDoc?.url}
                placeholder="Optional document remarks"
                className="min-h-[72px] flex-1 resize-none text-sm disabled:bg-stone-100 disabled:text-stone-500 xl:min-h-0"
              />

              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  onClick={() => setActiveStatus('verified')}
                  disabled={isHistorical || !activeDoc?.url}
                  className="h-8 bg-green-600 text-xs text-white hover:bg-green-700"
                >
                  Verify
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={isHistorical || !activeDoc?.url}
                  onClick={() => setActiveStatus('rejected')}
                  className="h-8 text-xs"
                >
                  Re-upload
                </Button>
              </div>
            </Card>

            <Card className="flex min-h-0 flex-col border-stone-200 bg-white p-3 shadow-none">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-stone-400">
                Final Decision
              </p>

              <Textarea
                value={finalComment}
                onChange={(event) => setFinalComment(event.target.value)}
                disabled={isHistorical}
                placeholder="Optional final remarks"
                className="min-h-[72px] flex-1 resize-none text-sm disabled:bg-stone-100 disabled:text-stone-500 xl:min-h-0"
              />

              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <Button
                  size="sm"
                  className="h-8 bg-green-700 px-2 text-xs hover:bg-green-800"
                  disabled={isHistorical || Boolean(submittingAction)}
                  onClick={() => handleSubmitReview('approve')}
                >
                  {submittingAction === 'approve' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Approve'
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-2 text-xs"
                  disabled={isHistorical || Boolean(submittingAction)}
                  onClick={() => handleSubmitReview('reupload')}
                >
                  {submittingAction === 'reupload' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Re-upload'
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 border-red-200 px-2 text-xs text-red-600"
                  disabled={isHistorical || Boolean(submittingAction)}
                  onClick={() => handleSubmitReview('reject')}
                >
                  {submittingAction === 'reject' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    'Reject'
                  )}
                </Button>
              </div>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}