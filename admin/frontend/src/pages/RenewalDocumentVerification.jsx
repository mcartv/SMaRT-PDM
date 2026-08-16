import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Loader2,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';
import {
  MAJOR_REJECTION_OPTIONS,
  MINOR_REUPLOAD_OPTIONS,
} from '@/utils/documentReviewPolicy';

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
    label: 'Needs Re-upload',
    color: '#dc2626',
    bg: '#FEF2F2',
  },
  pending: {
    label: 'Missing',
    color: '#7c4a2e',
    bg: '#EFF6FF',
  },
};

function normalizedStatus(value) {
  return String(value || '').trim().toLowerCase();
}

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
  const [reviewIssueMode, setReviewIssueMode] = useState('');
  const [reasonCode, setReasonCode] = useState('');
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

  const allDocumentsUploaded =
    documents.length > 0 &&
    documents.every((doc) => Boolean(doc.url));

  const allVerified =
    documents.length > 0 &&
    documents.every(
      (doc) => normalizedStatus(doc.status) === 'verified'
    );

  const hasReupload =
    documents.some(
      (doc) => normalizedStatus(doc.status) === 'rejected'
    );

  useEffect(() => {
    if (activeDoc) {
      setComment(docComments[activeDoc.id] || '');
    }
  }, [activeDoc, docComments]);

  const persistActiveComment = (nextComment = comment) => {
    if (!activeDoc) return;

    setDocComments((prev) => ({
      ...prev,
      [activeDoc.id]: nextComment,
    }));
  };

  const setActiveStatus = (nextStatus, nextComment = comment) => {
    if (isHistorical || !activeDoc || !activeDoc.url) return;

    setDocStatuses((prev) => ({
      ...prev,
      [activeDoc.id]: nextStatus,
    }));

    setDocComments((prev) => ({
      ...prev,
      [activeDoc.id]: nextComment,
    }));
  };

  const buildDocumentReviews = (overrides = {}) =>
    documents.map((doc) => ({
      document_type: doc.document_type,
      name: doc.name,
      status:
        overrides[doc.id]?.status ||
        docStatuses[doc.id] ||
        doc.status,
      comment:
        overrides[doc.id]?.comment ??
        docComments[doc.id] ??
        '',
      url: doc.url || null,
    }));

  const reviewReasonOptions =
    reviewIssueMode === 'reject'
      ? MAJOR_REJECTION_OPTIONS
      : MINOR_REUPLOAD_OPTIONS;

  const selectedReviewReason = reviewReasonOptions.find(
    (option) => option.code === reasonCode
  );

  const openReviewIssue = (mode) => {
    if (isHistorical || !activeDoc?.url) return;

    setReviewIssueMode(mode);
    setReasonCode('');
    setComment('');
  };

  const closeReviewIssue = () => {
    if (submittingAction) return;

    setReviewIssueMode('');
    setReasonCode('');
    setComment('');
  };

  const buildReviewComment = () =>
    [
      selectedReviewReason
        ? `Reason: ${selectedReviewReason.label}`
        : '',
      comment.trim()
        ? `Remarks: ${comment.trim()}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

  const submitReview = async ({
    finalAction,
    finalComment = '',
    overrides = {},
  }) => {
    if (isHistorical) {
      window.alert(
        'This renewal belongs to a historical semester and is read-only.'
      );
      return;
    }

    try {
      setSubmittingAction(finalAction);

      const response = await fetch(`${API_BASE}/renewals/${id}/review`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          final_action: finalAction,
          final_comment: finalComment,
          document_reviews: buildDocumentReviews(overrides),
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save renewal review');
      }

      window.alert('Renewal review saved successfully.');
      navigate('/admin/scholars?tab=renewals');
    } catch (err) {
      window.alert(err.message || 'Failed to save renewal review');
    } finally {
      setSubmittingAction('');
    }
  };

  const handleVerify = () => {
    setActiveStatus('verified', '');
    setComment('');
  };

  const handleReviewIssueConfirm = async () => {
    if (!selectedReviewReason || !activeDoc?.url) {
      return;
    }

    const resolvedComment = buildReviewComment();

    if (reviewIssueMode === 'reupload') {
      const overrides = {
        [activeDoc.id]: {
          status: 'rejected',
          comment: resolvedComment,
        },
      };

      setActiveStatus('rejected', resolvedComment);

      await submitReview({
        finalAction: 'reupload',
        finalComment: resolvedComment,
        overrides,
      });

      return;
    }

    if (reviewIssueMode === 'reject') {
      const confirmed = window.confirm(
        'Reject this renewal entirely? Use Request Re-upload instead when the scholar can correct the document.'
      );

      if (!confirmed) return;

      const overrides = {
        [activeDoc.id]: {
          status: 'rejected',
          comment: resolvedComment,
        },
      };

      await submitReview({
        finalAction: 'reject',
        finalComment: resolvedComment,
        overrides,
      });
    }
  };

  const handleSaveReview = async () => {
    persistActiveComment();

    if (!allDocumentsUploaded) {
      window.alert(
        'Both renewal documents must be uploaded before the renewal can be approved.'
      );
      return;
    }

    if (hasReupload) {
      const firstRejected = documents.find(
        (doc) => normalizedStatus(doc.status) === 'rejected'
      );
      const reason =
        docComments[firstRejected?.id] ||
        'One or more renewal documents must be replaced and resubmitted.';

      await submitReview({
        finalAction: 'reupload',
        finalComment: reason,
      });
      return;
    }

    if (allVerified) {
      await submitReview({
        finalAction: 'approve',
        finalComment: 'Renewal requirements verified.',
      });
      return;
    }

    await submitReview({
      finalAction: 'under_review',
      finalComment: 'Renewal review is still in progress.',
    });
  };

  if (loading) {
    return (
      <PageLoadingSkeleton
        label="Loading renewal documents"
        variant="cards"
      />
    );
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
    <div className="space-y-3 py-1">
      {reviewIssueMode ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
          onClick={closeReviewIssue}
        >
          <Card
            className="w-full max-w-lg overflow-hidden border-stone-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-stone-100 bg-stone-50 px-5 py-4">
              <h3 className="text-base font-semibold text-stone-800">
                {reviewIssueMode === 'reject'
                  ? 'Reject Renewal'
                  : 'Request Document Re-upload'}
              </h3>
              <p className="mt-0.5 text-sm text-stone-500">
                {activeDoc?.name || 'Selected renewal document'}
              </p>
            </div>

            <div className="space-y-4 p-5">
              <div
                className={`rounded-xl border px-3 py-3 text-sm leading-relaxed ${reviewIssueMode === 'reject'
                    ? 'border-red-200 bg-red-50 text-red-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                  }`}
              >
                {reviewIssueMode === 'reject'
                  ? 'Major action: this rejects the entire renewal. Use only for serious or disqualifying violations.'
                  : 'Minor issue: the renewal stays correctable and the scholar can replace the affected document.'}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-stone-400">
                  {reviewIssueMode === 'reject'
                    ? 'Major rejection reason'
                    : 'Reason for re-upload'}
                </label>

                <Select value={reasonCode} onValueChange={setReasonCode}>
                  <SelectTrigger className="h-10 rounded-lg border-stone-200 bg-white text-sm">
                    <SelectValue
                      placeholder={
                        reviewIssueMode === 'reject'
                          ? 'Select rejection reason'
                          : 'Select re-upload reason'
                      }
                    />
                  </SelectTrigger>

                  <SelectContent className="z-[120]">
                    {reviewReasonOptions.map((option) => (
                      <SelectItem
                        key={option.code}
                        value={option.code}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-stone-400">
                  Admin remarks
                </label>

                <Textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Optional additional remarks..."
                  className="min-h-[90px] resize-none rounded-lg border-stone-200 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={closeReviewIssue}
                disabled={Boolean(submittingAction)}
                className="h-9 rounded-lg border-stone-200 text-sm"
              >
                Cancel
              </Button>

              <Button
                type="button"
                disabled={
                  !selectedReviewReason ||
                  Boolean(submittingAction)
                }
                onClick={handleReviewIssueConfirm}
                className={`h-9 rounded-lg border-none text-sm text-white disabled:opacity-50 ${reviewIssueMode === 'reject'
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                  }`}
              >
                {submittingAction ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}

                {reviewIssueMode === 'reject'
                  ? 'Confirm Rejection'
                  : 'Request Re-upload'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}
      {isHistorical ? (
        <div className="rounded-lg border border-stone-200 bg-stone-100 px-3 py-2">
          <p className="text-xs font-semibold text-stone-700">
            Historical semester · Read-only
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            {renewal?.renewal?.semester_label || 'Semester'}
            {renewal?.renewal?.school_year_label
              ? ` · AY ${renewal.renewal.school_year_label}`
              : ''}
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
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

      <div className="grid gap-3 xl:grid-cols-[230px_minmax(340px,560px)_minmax(300px,1fr)]">
        <aside className="space-y-3">
          <Card className="border-stone-200 bg-white p-3 shadow-none">
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
              <p>
                {renewal?.renewal?.semester_label || 'Current Semester'}
                {renewal?.renewal?.school_year_label
                  ? ` · AY ${renewal.renewal.school_year_label}`
                  : ''}
              </p>
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

          <Card className="border-stone-200 bg-white p-2 shadow-none">
            <p className="px-1 pb-1.5 text-xs font-medium text-stone-500">
              Requirements
            </p>

            <div className="space-y-1">
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
                    <span className="min-w-0 flex-1 truncate">
                      {doc.name}
                    </span>

                    <span
                      className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
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

        <Card className="self-start overflow-hidden border-stone-200 bg-white shadow-none">
          <div className="flex h-10 items-center justify-between border-b border-stone-100 bg-stone-50 px-3">
            <p className="truncate text-sm font-medium text-stone-800">
              {activeDoc?.name || 'Document Preview'}
            </p>

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

          <div className="flex h-[390px] items-center justify-center overflow-hidden bg-stone-100 p-3">
            {activeDoc?.url ? (
              /\.(png|jpe?g|webp)(\?|$)/i.test(activeDoc.url) ? (
                <img
                  src={activeDoc.url}
                  alt={activeDoc.name || 'Renewal document'}
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <iframe
                  src={activeDoc.url}
                  className="h-full w-full rounded-lg border border-stone-200 bg-white"
                  title={activeDoc.name || 'Renewal document'}
                />
              )
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

        <Card className="self-start border-stone-200 bg-white p-4 shadow-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-400">
                Review Selected Document
              </p>
              <p className="mt-1 text-sm font-semibold text-stone-800">
                {activeDoc?.name || 'Requirement'}
              </p>
            </div>

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
            onChange={(event) => {
              const value = event.target.value;
              setComment(value);
              persistActiveComment(value);
            }}
            disabled={isHistorical || !activeDoc?.url}
            placeholder="Optional review note for the selected document."
            className="mt-3 min-h-[110px] resize-none text-sm disabled:bg-stone-100 disabled:text-stone-500"
          />

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              size="sm"
              onClick={handleVerify}
              disabled={
                isHistorical ||
                !activeDoc?.url ||
                Boolean(submittingAction)
              }
              className="h-9 bg-green-600 text-xs text-white hover:bg-green-700"
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Verify
            </Button>

            <Button
              size="sm"
              variant="outline"
              disabled={
                isHistorical ||
                !activeDoc?.url ||
                Boolean(submittingAction)
              }
              onClick={() => openReviewIssue('reupload')}
              className="h-9 border-amber-200 text-xs text-amber-700"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Request Re-upload
            </Button>
          </div>

          <div className="my-4 border-t border-stone-100" />

          <div className="rounded-lg border border-stone-100 bg-stone-50 px-3 py-2.5 text-xs text-stone-500">
            {allVerified
              ? 'All renewal requirements are verified. Saving will approve the renewal.'
              : hasReupload
                ? 'One or more requirements need replacement. Saving will keep the renewal in re-upload status.'
                : 'Verify each requirement before approving the renewal.'}
          </div>

          <div className="mt-3 space-y-2">
            <Button
              size="sm"
              className="h-9 w-full bg-[#7c4a2e] text-xs text-white hover:bg-[#6b3f27]"
              disabled={isHistorical || Boolean(submittingAction)}
              onClick={handleSaveReview}
            >
              {submittingAction &&
                submittingAction !== 'reject' &&
                submittingAction !== 'reupload' ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Save Renewal Review
            </Button>

            <Button
              size="sm"
              variant="outline"
              className="h-9 w-full border-red-200 text-xs text-red-600"
              disabled={isHistorical || Boolean(submittingAction)}
              onClick={() => openReviewIssue('reject')}
            >
              {submittingAction === 'reject' ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
              )}
              Reject Renewal
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
