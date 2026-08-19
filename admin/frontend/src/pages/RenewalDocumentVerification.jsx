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
    color: '#57534e',
    bg: '#F5F5F4',
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
        'The renewal review cannot be saved until all required documents are uploaded.'
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
    <div className="space-y-4 py-2">
      {reviewIssueMode ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
          onClick={closeReviewIssue}
        >
          <Card
            className="w-full max-w-lg gap-0 overflow-hidden bg-white py-0 shadow-xl ring-stone-200/80"
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
          <p className="truncate text-xs font-medium text-stone-500">
            Scholar Monitoring / Renewals
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-stone-900">
            Renewal Verification
          </h1>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[300px_minmax(520px,1fr)_390px]">
        <aside className="space-y-4">
          <Card className="gap-0 overflow-hidden rounded-2xl bg-white py-0 shadow-[0_1px_2px_rgba(28,25,23,0.04)] ring-stone-200/80">
            <div className="p-4">
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
                  avatarClassName="h-12 w-12 shrink-0 border border-stone-100 bg-stone-100"
                  imageClassName="object-cover"
                  fallbackClassName="bg-blue-900 text-sm font-semibold text-white"
                />

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="truncate text-[15px] font-semibold leading-5 text-stone-900">
                    {renewal?.student?.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs font-medium text-stone-500">
                    {renewal?.student?.pdm_id}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-stone-100/80 bg-stone-50/60 px-4 py-3.5">
              <div className="space-y-3">
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500">
                    <GraduationCap className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                      Scholarship Program
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium leading-5 text-stone-700">
                      {renewal?.student?.program || 'Not available'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                      Renewal Cycle
                    </p>
                    <p className="mt-0.5 text-xs font-medium leading-5 text-stone-700">
                      {renewal?.renewal?.semester_label || 'Current Semester'}
                      {renewal?.renewal?.school_year_label
                        ? ` · AY ${renewal.renewal.school_year_label}`
                        : ''}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-stone-100 px-4 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                    Renewal Status
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    Current submission state
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="h-7 max-w-[145px] truncate rounded-full border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-700"
                >
                  {renewal?.renewal_status || 'Pending'}
                </Badge>
              </div>

              <div className="mt-3 rounded-xl bg-stone-50 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-stone-500">
                    Submission progress
                  </span>
                  <span className="text-xs font-semibold text-stone-700">
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
            <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3.5">
              <div>
                <p className="text-sm font-semibold text-stone-900">Requirements</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  Select a document to review
                </p>
              </div>
              <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-stone-600">
                {documents.length}
              </span>
            </div>

            <div className="space-y-1.5 p-2.5">
              {documents.map((doc) => {
                const meta = DOC_STATUS[doc.status] || DOC_STATUS.pending;
                const isActive = activeDoc?.id === doc.id;

                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => setDocKey(doc.id)}
                    className={`group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${isActive
                        ? 'border-[#eadfd7] bg-[#faf7f2]'
                        : 'border-transparent bg-white hover:border-stone-100 hover:bg-stone-50'
                      }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${isActive
                          ? 'border-[#eadfd7] bg-white text-[var(--portal-base)]'
                          : 'border-stone-200 bg-stone-50 text-stone-400'
                        }`}
                    >
                      <FileText className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-xs font-medium ${isActive ? 'text-stone-900' : 'text-stone-700'}`}>
                        {doc.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-stone-400">
                        {doc.url ? 'File submitted' : 'Awaiting upload'}
                      </p>
                    </div>

                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold"
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

        <Card className="self-start gap-0 overflow-hidden rounded-2xl bg-white py-0 shadow-[0_1px_2px_rgba(28,25,23,0.04)] ring-stone-200/80">
          <div className="flex min-h-[62px] items-center justify-between gap-4 border-b border-stone-100 px-4 py-3.5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-50 text-stone-500">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                  Document Preview
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold text-stone-900">
                  {activeDoc?.name || 'Select a requirement'}
                </p>
              </div>
            </div>

            {activeDoc?.url ? (
              <a
                href={activeDoc.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-600 transition hover:bg-stone-50 hover:text-stone-900"
              >
                Open File
                <ExternalLink size={12} />
              </a>
            ) : null}
          </div>

          <div className="flex h-[min(66vh,650px)] min-h-[500px] items-center justify-center overflow-hidden bg-stone-50 p-5">
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

        <Card className="self-start gap-0 overflow-hidden rounded-2xl bg-white py-0 shadow-[0_1px_2px_rgba(28,25,23,0.04)] ring-stone-200/80">
          <div className="border-b border-stone-100/80 bg-stone-50/60 px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                  Review Selected Document
                </p>
                <p className="mt-1 truncate text-sm font-semibold text-stone-900">
                  {activeDoc?.name || 'Requirement'}
                </p>
              </div>

              {activeDoc ? (
                <span
                  className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold"
                  style={{
                    background: activeDocMeta.bg,
                    color: activeDocMeta.color,
                  }}
                >
                  {activeDocMeta.label}
                </span>
              ) : null}
            </div>
          </div>

          <div className="p-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                Review Note
              </label>
              <Textarea
                value={comment}
                onChange={(event) => {
                  const value = event.target.value;
                  setComment(value);
                  persistActiveComment(value);
                }}
                disabled={isHistorical || !activeDoc?.url}
                placeholder={activeDoc?.url
                  ? 'Add an optional review note for this document...'
                  : 'A file must be uploaded before adding a review note.'}
                className="mt-2 min-h-[112px] resize-none rounded-xl border-stone-200 bg-white text-sm leading-5 placeholder:text-stone-400 disabled:bg-stone-50 disabled:text-stone-400"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <Button
                size="sm"
                onClick={handleVerify}
                disabled={
                  isHistorical ||
                  !activeDoc?.url ||
                  Boolean(submittingAction)
                }
                className="h-9 rounded-lg bg-green-600 text-xs font-medium text-white hover:bg-green-700 disabled:bg-stone-200 disabled:text-stone-400"
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
                className="h-9 rounded-lg border-amber-200 bg-white text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-400"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Request Re-upload
              </Button>
            </div>

            <div className="my-4 border-t border-stone-100" />

            <div className="rounded-xl bg-stone-50 p-3.5">
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
                  <p className="text-xs font-semibold text-stone-800">
                    {!hasAnyUploadedDocument
                      ? 'Waiting for submission'
                      : !allDocumentsUploaded
                        ? 'Submission incomplete'
                        : allVerified
                          ? 'Ready for approval'
                          : hasReupload
                            ? 'Replacement required'
                            : 'Review in progress'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    {!hasAnyUploadedDocument
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
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                    Uploaded
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-stone-700">
                    {uploadedDocumentCount} / {documents.length}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400">
                    Verified
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-stone-700">
                    {verifiedDocumentCount} / {documents.length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-stone-100/80 bg-stone-50/60 p-4">
            <div className="space-y-2.5">
              <Button
                size="sm"
                className="h-10 w-full rounded-xl bg-[var(--portal-base)] text-xs font-semibold text-white hover:opacity-95 disabled:bg-stone-200 disabled:text-stone-400"
                disabled={
                  isHistorical ||
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
                className="h-10 w-full rounded-xl border-red-200 bg-white text-xs font-medium text-red-600 hover:bg-red-50 disabled:border-stone-200 disabled:bg-stone-50 disabled:text-stone-400"
                disabled={
                  isHistorical ||
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
          </div>
        </Card>
      </div>
    </div>
  );
}
