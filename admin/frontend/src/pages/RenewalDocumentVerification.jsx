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
import PreviewableProfileAvatar from '@/components/profile/PreviewableProfileAvatar';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileCheck2,
  FileClock,
  FileText,
  GraduationCap,
  Loader2,
  RotateCcw,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { showAppToast } from '@/utils/appToast';
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
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  uploaded: {
    label: 'Pending Review',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  rejected: {
    label: 'Needs Re-upload',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  pending: {
    label: 'Missing',
    className: 'border-stone-200 bg-stone-100 text-stone-600',
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

  const normalizedRenewalStatus = normalizedStatus(renewal?.renewal_status);
  const isFinalized = ['approved', 'rejected'].includes(normalizedRenewalStatus);
  const isReadOnly = isHistorical || isFinalized;
  const renewalStatusClass = normalizedRenewalStatus === 'approved'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : normalizedRenewalStatus === 'rejected'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';

  const uploadedDocumentCount = documents.filter((doc) => Boolean(doc.url)).length;

  const hasAnyUploadedDocument = uploadedDocumentCount > 0;

  const allDocumentsUploaded =
    documents.length > 0 &&
    uploadedDocumentCount === documents.length;

  const uploadProgressLabel = `${uploadedDocumentCount} of ${documents.length} uploaded`;

  const allVerified =
    documents.length > 0 &&
    documents.every(
      (doc) => normalizedStatus(doc.status) === 'verified'
    );

  const hasReupload =
    documents.some(
      (doc) => normalizedStatus(doc.status) === 'rejected'
    );

  const verifiedDocumentCount = documents.filter(
    (doc) => normalizedStatus(doc.status) === 'verified'
  ).length;

  const activeDocMeta = activeDoc
    ? DOC_STATUS[activeDoc.status] || DOC_STATUS.pending
    : DOC_STATUS.pending;

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
    if (isReadOnly || !activeDoc || !activeDoc.url) return;

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
    if (isReadOnly || !activeDoc?.url) return;

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
    if (isReadOnly) {
      showAppToast(
        'info',
        'Read-only renewal',
        isFinalized
          ? 'This renewal is already finalized and cannot be changed.'
          : 'This renewal belongs to a historical semester and is read-only.'
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

      showAppToast('success', 'Renewal review saved', 'The renewal review was saved successfully.');
      navigate('/admin/scholars?tab=renewals');
    } catch (err) {
      showAppToast(
        'error',
        'Renewal review not saved',
        err.message || 'Failed to save renewal review.'
      );
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
      showAppToast(
        'warning',
        'Renewal submission incomplete',
        'The review cannot be saved until all required documents are uploaded.'
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
    <div className="mx-auto w-full max-w-[1500px] space-y-5 py-3">
      {reviewIssueMode ? (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/35 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={closeReviewIssue}
        >
          <Card
            className="max-h-[100dvh] w-full max-w-lg gap-0 overflow-y-auto rounded-b-none bg-white py-0 shadow-xl ring-stone-200/80 sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
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

            <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-stone-50 px-5 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={closeReviewIssue}
                disabled={Boolean(submittingAction)}
                className="h-10 w-full rounded-lg border-stone-200 text-sm sm:w-auto"
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
                className={`h-10 w-full rounded-lg border-none text-sm text-white disabled:opacity-50 sm:w-auto ${reviewIssueMode === 'reject'
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
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/admin/scholars?tab=renewals')}
          className="h-10 w-10 shrink-0 rounded-xl border-stone-200 bg-white p-0"
        >
          <ArrowLeft size={16} />
        </Button>

        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-stone-500">
            Scholar Monitoring / Renewals
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-stone-900">
            Renewal Verification
          </h1>
          <p className="mt-1 hidden text-sm text-stone-500 sm:block">
            Review each submitted requirement before completing the renewal decision.
          </p>
        </div>
      </div>

      <div className="compact-review-workspace grid min-w-0 gap-5 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(440px,1fr)_380px]">
        <aside className="space-y-5 2xl:sticky 2xl:top-4 2xl:self-start">
          <Card className="gap-0 overflow-hidden rounded-2xl bg-white py-0 shadow-[0_1px_2px_rgba(28,25,23,0.04)] ring-stone-200/80">
            <div className="p-5">
              <div className="flex items-start gap-3">
                <PreviewableProfileAvatar
                  src={
                    renewal?.student?.avatar_url ||
                    renewal?.student?.avatarUrl ||
                    renewal?.student?.profile_photo_url ||
                    ''
                  }
                  name={`${renewal?.student?.name || 'Scholar'} profile photo`}
                  fallback={renewal?.student?.initials || 'NA'}
                  avatarClassName="h-14 w-14 shrink-0 border border-stone-100 bg-stone-100"
                  imageClassName="object-cover"
                  fallbackClassName="bg-[var(--portal-base)] text-sm font-semibold text-white"
                />

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="break-words text-base font-semibold leading-6 text-stone-900">
                    {renewal?.student?.name || 'Scholar name unavailable'}
                  </p>
                  <p className="mt-1 break-all text-sm font-medium text-stone-500">
                    {renewal?.student?.pdm_id || 'No PDM ID'}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-stone-100/80 bg-stone-50/60 px-5 py-4">
              <div className="space-y-4">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500">
                    <GraduationCap className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-stone-500">
                      Scholarship Program
                    </p>
                    <p className="mt-1 break-words text-sm font-medium leading-5 text-stone-800">
                      {renewal?.student?.program || 'Not available'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-stone-500">
                      Renewal Cycle
                    </p>
                    <p className="mt-1 text-sm font-medium leading-5 text-stone-800">
                      {renewal?.renewal?.semester_label || 'Current Semester'}
                      {renewal?.renewal?.school_year_label
                        ? ` · AY ${renewal.renewal.school_year_label}`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-stone-100 px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-stone-500">
                    Renewal Status
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    Current submission state
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`h-8 max-w-[160px] rounded-full px-3 text-sm font-semibold ${renewalStatusClass}`}
                >
                  {renewal?.renewal_status || 'Pending'}
                </Badge>
              </div>

              <div className="mt-4 rounded-xl bg-stone-50 px-3.5 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-stone-600">
                    Submission progress
                  </span>
                  <span className="text-sm font-semibold text-stone-800">
                    {uploadProgressLabel}
                  </span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200">
                  <div
                    className="h-full rounded-full bg-[var(--portal-base)] transition-all"
                    style={{
                      width: documents.length
                        ? `${Math.round((uploadedDocumentCount / documents.length) * 100)}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>

          <Card className="gap-0 overflow-hidden rounded-2xl bg-white py-0 shadow-[0_1px_2px_rgba(28,25,23,0.04)] ring-stone-200/80">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
              <div>
                <p className="text-base font-semibold text-stone-900">Requirements</p>
                <p className="mt-1 text-sm text-stone-500">
                  Select a document to review
                </p>
              </div>
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                {documents.length}
              </span>
            </div>

            <div className="space-y-2 p-3">
              {documents.map((doc) => {
                const meta = DOC_STATUS[doc.status] || DOC_STATUS.pending;
                const isActive = activeDoc?.id === doc.id;

                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setDocKey(doc.id)}
                    className={`group flex w-full items-start gap-3 rounded-xl border px-3.5 py-3.5 text-left transition ${isActive
                        ? 'border-[var(--portal-soft)] bg-[var(--portal-soft)]'
                        : 'border-transparent bg-white hover:border-stone-100 hover:bg-stone-50'
                      }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${isActive
                          ? 'border-[var(--portal-base)] bg-white text-[var(--portal-base)]'
                          : 'border-stone-200 bg-stone-50 text-stone-400'
                        }`}
                    >
                      <FileText className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`break-words text-sm font-semibold leading-5 ${isActive ? 'text-stone-900' : 'text-stone-700'}`}>
                        {doc.name}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {doc.url ? 'File submitted' : 'Awaiting upload'}
                      </p>
                    </div>

                    <span
                      className={`mt-0.5 shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </aside>

        <Card className="self-start gap-0 overflow-hidden rounded-2xl bg-white py-0 shadow-[0_1px_2px_rgba(28,25,23,0.04)] ring-stone-200/80">
          <div className="flex min-h-[76px] items-center justify-between gap-4 border-b border-stone-100 px-5 py-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-500">
                <FileText className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-stone-500">
                  Document Preview
                </p>
                <p className="mt-1 break-words text-base font-semibold leading-5 text-stone-900">
                  {activeDoc?.name || 'Select a requirement'}
                </p>
              </div>
            </div>

            {activeDoc?.url ? (
              <a
                href={activeDoc.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50 hover:text-stone-900"
              >
                Open File
                <ExternalLink size={12} />
              </a>
            ) : null}
          </div>

          <div className="flex h-[52vh] min-h-[340px] items-center justify-center overflow-hidden bg-stone-50 p-3 sm:min-h-[420px] sm:p-5 lg:h-[min(68vh,720px)]">
            {activeDoc?.url ? (
              <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-white p-2">
                {/\.(png|jpe?g|webp)(\?|$)/i.test(activeDoc.url) ? (
                  <img
                    src={activeDoc.url}
                    alt={activeDoc.name || 'Renewal document'}
                    className="max-h-full max-w-full rounded-lg object-contain"
                  />
                ) : (
                  <iframe
                    src={activeDoc.url}
                    className="h-full w-full rounded-lg border-0 bg-white"
                    title={activeDoc.name || 'Renewal document'}
                  />
                )}
              </div>
            ) : (
              <div className="w-full max-w-md rounded-2xl border border-dashed border-stone-200 bg-white px-8 py-10 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-400">
                  <FileClock className="h-5 w-5" />
                </div>
                <p className="mt-4 text-sm font-semibold text-stone-800">
                  Waiting for document upload
                </p>
                <p className="mx-auto mt-1.5 max-w-xs text-xs leading-5 text-stone-500">
                  The scholar has not submitted this requirement yet. Verification actions will become available after a file is uploaded.
                </p>
              </div>
            )}
          </div>
        </Card>

        <Card className="self-start gap-0 overflow-hidden rounded-2xl bg-white py-0 shadow-[0_1px_2px_rgba(28,25,23,0.04)] ring-stone-200/80 lg:col-span-2 2xl:col-span-1">
          <div className="border-b border-stone-100/80 bg-stone-50/60 px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-stone-500">
                  Selected requirement
                </p>
                <p className="mt-1 break-words text-base font-semibold leading-5 text-stone-900">
                  {activeDoc?.name || 'Requirement'}
                </p>
              </div>

              {activeDoc ? (
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${activeDocMeta.className}`}
                >
                  {activeDocMeta.label}
                </span>
              ) : null}
            </div>
          </div>

          <div className="p-5">
            <div>
              <label className="text-sm font-semibold text-stone-700">
                Review Note
              </label>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                Add context that should remain with this document review.
              </p>
              <Textarea
                value={comment}
                onChange={(event) => {
                  const value = event.target.value;
                  setComment(value);
                  persistActiveComment(value);
                }}
                disabled={isReadOnly || !activeDoc?.url}
                placeholder={activeDoc?.url
                  ? 'Add an optional review note for this document...'
                  : 'A file must be uploaded before adding a review note.'}
                className="mt-2.5 min-h-[124px] resize-y rounded-xl border-stone-200 bg-white text-sm leading-6 placeholder:text-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
              />
            </div>

            {isReadOnly ? (
              <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-3 text-sm leading-5 text-stone-600">
                Review actions are unavailable because this renewal is read-only.
              </div>
            ) : (
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 2xl:grid-cols-1">
                <Button
                  size="sm"
                  onClick={handleVerify}
                  disabled={!activeDoc?.url || Boolean(submittingAction)}
                  className="h-11 rounded-xl bg-[var(--portal-base)] text-sm font-semibold text-white hover:brightness-95 disabled:bg-stone-200 disabled:text-stone-400"
                >
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                  Verify Document
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={!activeDoc?.url || Boolean(submittingAction)}
                  onClick={() => openReviewIssue('reupload')}
                  className="h-11 rounded-xl border-amber-300 bg-white text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-400"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Request Re-upload
                </Button>
              </div>
            )}

            <div className="my-5 border-t border-stone-100" />

            <div className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-white ${allVerified
                      ? 'border-green-200 text-green-600'
                      : !hasAnyUploadedDocument
                        ? 'border-amber-200 text-amber-600'
                        : 'border-stone-200 text-stone-500'
                    }`}
                >
                  {allVerified ? (
                    <ShieldCheck className="h-4 w-4" />
                  ) : (
                    <FileClock className="h-4 w-4" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-stone-900">
                    {isFinalized
                      ? `Renewal ${renewal?.renewal_status || 'finalized'}`
                      : !hasAnyUploadedDocument
                      ? 'Waiting for submission'
                      : !allDocumentsUploaded
                        ? 'Submission incomplete'
                        : allVerified
                          ? 'Ready for approval'
                          : hasReupload
                            ? 'Replacement required'
                            : 'Review in progress'}
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-stone-600">
                    {isFinalized
                      ? 'The renewal decision is complete. Submitted requirements remain available for reference.'
                      : !hasAnyUploadedDocument
                      ? 'Save and Reject remain disabled until at least one renewal file has been submitted.'
                      : !allDocumentsUploaded
                        ? `${uploadProgressLabel}. Save Review unlocks once every required file is uploaded.`
                        : allVerified
                          ? 'Every required document is verified. Saving this review will approve the renewal.'
                          : hasReupload
                            ? 'One or more requirements must be replaced before this renewal can be approved.'
                            : 'Review each submitted requirement and verify all documents before approval.'}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-stone-200 pt-3">
                <div>
                  <p className="text-xs font-semibold text-stone-500">
                    Uploaded
                  </p>
                  <p className="mt-1 text-sm font-semibold text-stone-800">
                    {uploadedDocumentCount} / {documents.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-500">
                    Verified
                  </p>
                  <p className="mt-1 text-sm font-semibold text-stone-800">
                    {verifiedDocumentCount} / {documents.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-stone-100/80 bg-stone-50/60 p-5">
            {isReadOnly ? (
              <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3">
                <ShieldCheck className="h-5 w-5 shrink-0 text-[var(--portal-base)]" />
                <div>
                  <p className="text-sm font-semibold text-stone-800">Review complete</p>
                  <p className="mt-0.5 text-xs leading-5 text-stone-500">
                    No further action is required on this renewal.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
              <Button
                size="sm"
                className="h-11 w-full rounded-xl bg-[var(--portal-base)] text-sm font-semibold text-white hover:brightness-95 disabled:bg-stone-200 disabled:text-stone-400"
                disabled={
                  isReadOnly ||
                  !allDocumentsUploaded ||
                  Boolean(submittingAction)
                }
                onClick={handleSaveReview}
              >
                {submittingAction &&
                  submittingAction !== 'reject' &&
                  submittingAction !== 'reupload' ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileCheck2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Renewal Review
              </Button>

              <Button
                size="sm"
                variant="outline"
                className="h-11 w-full rounded-xl border-red-200 bg-white text-sm font-semibold text-red-600 hover:bg-red-50 disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-400"
                disabled={
                  isReadOnly ||
                  !hasAnyUploadedDocument ||
                  Boolean(submittingAction)
                }
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
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
