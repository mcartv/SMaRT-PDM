import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Eye,
  Search,
  XCircle,
} from 'lucide-react';
import { buildApiUrl } from '../config/api';
import { useSocketEvent } from '@/hooks/useSocket';
import ProfilePhotoPreviewDialog from '@/components/profile/ProfilePhotoPreviewDialog';
import { showAppToast } from '@/utils/appToast';

const STATUS_OPTIONS = ['pending', 'approved', 'rejected', 'superseded'];
// SMART-PDM_PROFILE_PHOTO_PENDING_SUPERSEDED_V2
// SMART-PDM_PROFILE_PHOTO_UI_CLEANUP_V2

function getToken() {
  return sessionStorage.getItem('adminToken') || '';
}

function authHeaders(extra = {}) {
  return {
    ...extra,
    Authorization: `Bearer ${getToken()}`,
  };
}

function formatDate(value) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleString();
}

function getStudentCode(student = {}) {
  return (
    student.pdm_id ||
    student.registrar_student_number ||
    student.student_id ||
    'No student ID'
  );
}

function statusClass(status) {
  switch (status) {
    case 'approved':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'rejected':
      return 'bg-red-50 text-red-700 ring-red-200';
    case 'superseded':
      return 'bg-stone-100 text-stone-600 ring-stone-200';
    default:
      return 'bg-amber-50 text-amber-800 ring-amber-200';
  }
}

function StatusPill({ status }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium capitalize ring-1 ${statusClass(
        status
      )}`}
    >
      {status || 'pending'}
    </span>
  );
}

function RejectModal({ onClose, onSubmit, busy, error }) {
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setValidationError('Enter a rejection reason before continuing.');
      return;
    }
    setValidationError('');
    onSubmit({ reason: trimmedReason, remarks: remarks.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-stone-900">
            Reject Profile Photo
          </h2>
          <p className="mt-1 text-sm text-stone-500">
            The reason will be shown to the student.
          </p>
        </div>

        <label className="text-sm font-semibold text-stone-700">
          Rejection reason
        </label>
        <textarea
          required
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            if (validationError) setValidationError('');
          }}
          aria-invalid={Boolean(validationError || error)}
          aria-describedby={validationError || error ? 'profile-photo-rejection-error' : undefined}
          className="mt-2 min-h-28 w-full rounded-md border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]"
        />

        {validationError || error ? (
          <p id="profile-photo-rejection-error" role="alert" className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {validationError || error}
          </p>
        ) : null}

        <label className="mt-4 block text-sm font-semibold text-stone-700">
          Remarks
        </label>
        <textarea
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          className="mt-2 min-h-20 w-full rounded-md border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-lg border border-stone-200 px-3 text-xs font-medium text-stone-700 hover:bg-stone-50"
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
            disabled={busy}
          >
            <XCircle className="h-4 w-4" />
            Reject
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ProfilePhotoQueue() {
  const navigate = useNavigate();
  const { reviewId } = useParams();
  const [items, setItems] = useState([]);
  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    superseded: 0,
  });
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  const isDetail = Boolean(reviewId);

  const openPhotoPreview = useCallback((src, label) => {
    if (!src) return;
    setPhotoPreview({ src, label });
  }, []);

  const closePhotoPreview = useCallback(() => setPhotoPreview(null), []);

  const loadQueue = useCallback(async (nextStatus = status, { quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await fetch(
        buildApiUrl(`/api/admin/profile-photos?status=${nextStatus}`),
        { headers: authHeaders() }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load profile photo reviews.');
      }
      const expectedStatus = String(nextStatus || 'pending').toLowerCase();
      const nextItems = Array.isArray(data.items) ? data.items : [];

      // Keep each queue defensive: even if a stale API/cache response ever
      // includes a different lifecycle state, it cannot leak into Pending.
      setItems(
        nextItems.filter(
          (item) => String(item?.status || '').toLowerCase() === expectedStatus
        )
      );

      setStatusCounts({
        pending: Number(data?.status_counts?.pending) || 0,
        approved: Number(data?.status_counts?.approved) || 0,
        rejected: Number(data?.status_counts?.rejected) || 0,
        superseded: Number(data?.status_counts?.superseded) || 0,
      });
    } catch (err) {
      setError(err.message || 'Failed to load profile photo reviews.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [status]);

  const loadDetail = useCallback(async ({ quiet = false } = {}) => {
    if (!reviewId) return;

    if (!quiet) setLoading(true);
    setError('');
    try {
      const response = await fetch(
        buildApiUrl(`/api/admin/profile-photos/${reviewId}`),
        { headers: authHeaders() }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load profile photo review.');
      }
      setDetail(data.review || null);
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch (err) {
      setError(err.message || 'Failed to load profile photo review.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    if (isDetail) {
      loadDetail();
    } else {
      loadQueue(status);
    }
  }, [isDetail, loadDetail, loadQueue, status]);

  const handleRealtimeReviewChange = useCallback((event) => {
    if (isDetail) {
      if (!event?.review_id || String(event.review_id) === String(reviewId)) {
        loadDetail({ quiet: true });
      }
      return;
    }

    loadQueue(status, { quiet: true });
  }, [isDetail, loadDetail, loadQueue, reviewId, status]);

  useSocketEvent('profile-photo-review:created', handleRealtimeReviewChange, [handleRealtimeReviewChange]);
  useSocketEvent('profile-photo-review:updated', handleRealtimeReviewChange, [handleRealtimeReviewChange]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => {
      const student = item.student || {};
      return [
        student.display_name,
        student.pdm_id,
        student.registrar_student_number,
        student.email_address,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [items, search]);

  const handleStatusChange = (nextStatus) => {
    setStatus(nextStatus);
    setSearch('');
  };

  const handleApprove = async () => {
    if (!detail?.review_id) return;

    setActionBusy(true);
    setError('');
    try {
      const response = await fetch(
        buildApiUrl(`/api/admin/profile-photos/${detail.review_id}/approve`),
        {
          method: 'PATCH',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({}),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve profile photo.');
      }
      await Promise.all([
        loadQueue('pending', { quiet: true }),
        loadDetail(),
      ]);
    } catch (err) {
      setError(err.message || 'Failed to approve profile photo.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleReject = async ({ reason, remarks }) => {
    if (!detail?.review_id) return;

    setActionBusy(true);
    setError('');
    try {
      const response = await fetch(
        buildApiUrl(`/api/admin/profile-photos/${detail.review_id}/reject`),
        {
          method: 'PATCH',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            rejection_reason: reason,
            remarks,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject profile photo.');
      }
      setShowRejectModal(false);
      showAppToast('success', 'Profile photo rejected', 'The student will see the rejection reason.');
      await Promise.all([
        loadQueue('pending', { quiet: true }),
        loadDetail(),
      ]);
    } catch (err) {
      const message = err.message || 'Failed to reject profile photo.';
      setError(message);
      showAppToast('error', 'Could not reject profile photo', message);
    } finally {
      setActionBusy(false);
    }
  };

  if (isDetail) {
    const student = detail?.student || {};
    const canReview = detail?.status === 'pending';

    return (
      <div className="space-y-5 py-3" style={{ background: 'var(--portal-main-bg, #faf7f2)' }}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => navigate('/admin/profile-photos')}
            className="inline-flex h-9 w-fit items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to queue
          </button>
          {detail?.status ? <StatusPill status={detail.status} /> : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
            Loading profile photo review...
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-[24px] border border-stone-200 bg-white">
              <div className="flex flex-col gap-3 border-b border-stone-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--portal-base)]">
                    Profile Photo Review
                  </p>
                  <h1 className="mt-1 break-words text-lg font-semibold text-stone-900 sm:text-xl">
                    {student.display_name || 'Student profile photo'}
                  </h1>
                  <p className="mt-1 text-sm text-stone-500">
                    {getStudentCode(student)} · Submitted {formatDate(detail?.submitted_at)}
                  </p>
                </div>
              </div>

              <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_360px]">
                <div className="min-w-0 border-b border-stone-100 p-4 sm:p-5 xl:border-b-0 xl:border-r">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold text-stone-900">Submitted Photo</h2>
                      <p className="mt-1 text-sm text-stone-500">Primary image for this review.</p>
                    </div>
                    {detail?.submitted_url ? (
                      <span className="text-xs font-medium text-stone-400">Latest upload</span>
                    ) : null}
                  </div>

                  <div className="flex min-h-[260px] items-center justify-center overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 p-3 sm:min-h-[360px] sm:p-4 lg:min-h-[460px]">
                    {detail?.submitted_url ? (
                      <button
                        type="button"
                        onClick={() => openPhotoPreview(detail.submitted_url, 'Submitted Profile Photo')}
                        className="max-w-full cursor-zoom-in rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--portal-base)] focus:ring-offset-2"
                        aria-label="Enlarge submitted profile photo"
                      >
                        <img
                          src={detail.submitted_url}
                          alt="Submitted profile photo"
                          className="max-h-[620px] max-w-full rounded-xl bg-white object-contain"
                        />
                      </button>
                    ) : (
                      <div className="flex flex-col items-center justify-center px-6 py-14 text-center text-sm text-stone-500">
                        <Camera className="mb-3 h-6 w-6 text-stone-300" />
                        No submitted photo available
                      </div>
                    )}
                  </div>
                </div>

                <aside className="min-w-0 bg-stone-50/35 p-4 sm:p-5 xl:sticky xl:top-4 xl:self-start">
                  <div className="space-y-4">
                    <section className="rounded-2xl border border-stone-200 bg-white p-4">
                      <h2 className="text-sm font-semibold text-stone-900">Student Information</h2>

                      <dl className="mt-4 grid gap-3 text-sm">
                        <div>
                          <dt className="text-xs font-medium text-stone-500">Name</dt>
                          <dd className="mt-1 font-semibold text-stone-900">
                            {student.display_name || 'Not recorded'}
                          </dd>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <dt className="text-xs font-medium text-stone-500">Student ID</dt>
                            <dd className="mt-1 break-words font-semibold text-stone-900">
                              {getStudentCode(student)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-medium text-stone-500">Course</dt>
                            <dd className="mt-1 font-semibold text-stone-900">
                              {student.course_code || 'Not recorded'}
                            </dd>
                          </div>
                        </div>
                        <div>
                          <dt className="text-xs font-medium text-stone-500">Email</dt>
                          <dd className="mt-1 break-all font-semibold text-stone-900">
                            {student.email_address || 'Not recorded'}
                          </dd>
                        </div>
                      </dl>
                    </section>

                    <section className="rounded-2xl border border-stone-200 bg-white p-4">
                      <h2 className="text-sm font-semibold text-stone-900">Current Approved Photo</h2>
                      <p className="mt-1 text-xs text-stone-500">Current profile image used as a reference.</p>

                      <div className="mt-3 flex h-[170px] items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-stone-50 p-3">
                        {student.current_avatar_url ? (
                          <button
                            type="button"
                            onClick={() => openPhotoPreview(student.current_avatar_url, 'Current Approved Profile Photo')}
                            className="h-full w-full cursor-zoom-in rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--portal-base)] focus:ring-offset-2"
                            aria-label="Enlarge current approved profile photo"
                          >
                            <img
                              src={student.current_avatar_url}
                              alt="Current approved profile photo"
                              className="h-full w-full rounded-lg object-contain"
                            />
                          </button>
                        ) : (
                          <div className="flex flex-col items-center justify-center text-center text-xs text-stone-500">
                            <Camera className="mb-2 h-5 w-5 text-stone-300" />
                            No approved photo yet
                          </div>
                        )}
                      </div>
                    </section>

                    {canReview ? (
                      <section className="rounded-2xl border border-stone-200 bg-white p-4">
                        <h2 className="text-sm font-semibold text-stone-900">Review Decision</h2>
                        <p className="mt-1 text-xs leading-5 text-stone-500">
                          Approve the image or reject it with a reason for the student.
                        </p>

                        <div className="mt-4 grid gap-2">
                          <button
                            type="button"
                            onClick={handleApprove}
                            disabled={actionBusy}
                            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            Approve Photo
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setError('');
                              setShowRejectModal(true);
                            }}
                            disabled={actionBusy}
                            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                          >
                            <XCircle className="h-4 w-4" />
                            Reject Photo
                          </button>
                        </div>
                      </section>
                    ) : null}

                    {detail?.rejection_reason ? (
                      <section className="rounded-2xl border border-red-100 bg-red-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Rejection Reason</p>
                        <p className="mt-2 text-sm font-semibold leading-6 text-red-700">
                          {detail.rejection_reason}
                        </p>
                        {detail?.remarks ? (
                          <p className="mt-2 text-sm leading-6 text-red-700/90">
                            <span className="font-semibold">Remarks:</span> {detail.remarks}
                          </p>
                        ) : null}
                      </section>
                    ) : null}
                  </div>
                </aside>
              </div>
            </section>

            <section className="rounded-[24px] border border-stone-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-stone-900">Review History</h2>
                  <p className="mt-1 text-sm text-stone-500">Previous profile-photo decisions for this student.</p>
                </div>
                <span className="text-xs text-stone-400">
                  {history.length} record{history.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {history.length > 0 ? (
                  history.map((item) => (
                    <div
                      key={item.review_id}
                      className="rounded-2xl border border-stone-100 bg-stone-50/60 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={item.status} />
                          {item.is_current_profile_photo ? (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                              Current
                            </span>
                          ) : null}
                        </div>
                        <span className="text-xs text-stone-500">{formatDate(item.submitted_at)}</span>
                      </div>
                      {item.rejection_reason ? (
                        <p className="mt-3 text-sm leading-6 text-red-700">
                          <span className="font-semibold">Reason:</span> {item.rejection_reason}
                        </p>
                      ) : null}
                      {item.remarks ? (
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          <span className="font-semibold">Remarks:</span> {item.remarks}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/60 px-4 py-8 text-center text-sm text-stone-500 lg:col-span-2">
                    No prior review records.
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        <ProfilePhotoPreviewDialog
        open={Boolean(photoPreview?.src)}
        onOpenChange={(open) => {
          if (!open) closePhotoPreview();
        }}
        src={photoPreview?.src || ''}
        name={photoPreview?.label || 'Profile photo'}
      />

        {showRejectModal ? (
          <RejectModal
            busy={actionBusy}
            error={error}
            onClose={() => {
              setError('');
              setShowRejectModal(false);
            }}
            onSubmit={handleReject}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 py-3" style={{ background: 'var(--portal-main-bg, #faf7f2)' }}>
      <div>
        <section className="mb-4 rounded-2xl border border-stone-200 bg-white p-4">
          <div className="mb-4">
            <p className="text-base font-semibold text-stone-900">Profile Photos</p>
            <p className="mt-1 text-sm text-stone-500">Review submitted student profile pictures before they become the active profile photo.</p>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid w-full grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 sm:inline-flex sm:w-auto sm:flex-wrap">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleStatusChange(option)}
                className={`h-9 rounded-lg px-4 text-sm font-medium capitalize transition ${
                  status === option
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                <span>{option}</span>
                <span
                  className={`ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    status === option
                      ? 'bg-stone-100 text-stone-700'
                      : 'bg-white/80 text-stone-500'
                  }`}
                >
                  {statusCounts[option] ?? 0}
                </span>
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search student"
              className="h-9 w-full rounded-lg border border-stone-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--portal-base)] focus:ring-2 focus:ring-[var(--portal-accent-soft)]"
            />
          </div>
          </div>
        </section>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
          <div className="divide-y divide-stone-100 md:hidden">
            {loading ? (
              <div className="px-4 py-10 text-center text-sm text-stone-500">
                Loading profile photo reviews...
              </div>
            ) : filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const student = item.student || {};

                return (
                  <article key={item.review_id} className="space-y-3 p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
                        {item.submitted_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              openPhotoPreview(
                                item.submitted_url,
                                `${student.display_name || 'Student'} Profile Photo`
                              )
                            }
                            className="h-full w-full cursor-zoom-in focus:outline-none"
                            aria-label={`Enlarge ${student.display_name || 'student'} profile photo`}
                          >
                            <img
                              src={item.submitted_url}
                              alt={`${student.display_name || 'Student'} submitted profile`}
                              className="h-full w-full object-cover"
                            />
                          </button>
                        ) : (
                          <Camera className="h-4 w-4 text-stone-500" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-semibold text-stone-900">
                              {student.display_name || 'Not recorded'}
                            </p>
                            <p className="mt-0.5 text-xs text-stone-500">
                              {student.course_code || 'No course'}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusPill status={item.status} />
                            {item.is_current_profile_photo ? (
                              <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                                Current
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <dl className="grid grid-cols-1 gap-2 rounded-xl bg-stone-50 p-3 text-xs sm:grid-cols-2">
                      <div className="min-w-0">
                        <dt className="font-medium text-stone-500">PDM / Student ID</dt>
                        <dd className="mt-1 break-words text-stone-800">
                          {getStudentCode(student)}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="font-medium text-stone-500">Submitted</dt>
                        <dd className="mt-1 break-words text-stone-800">
                          {formatDate(item.submitted_at)}
                        </dd>
                      </div>
                    </dl>

                    <button
                      type="button"
                      onClick={() => navigate(`/admin/profile-photos/${item.review_id}`)}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
                    >
                      <Eye className="h-4 w-4" />
                      Open Review
                    </button>
                  </article>
                );
              })
            ) : (
              <div className="px-4 py-10 text-center text-sm text-stone-500">
                No {status} profile photo reviews found.
              </div>
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[760px] w-full divide-y divide-stone-100">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Student
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                    PDM / Student ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Submitted
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-stone-500"
                    >
                      Loading profile photo reviews...
                    </td>
                  </tr>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((item) => {
                    const student = item.student || {};
                    return (
                      <tr key={item.review_id} className="hover:bg-stone-50/80">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-stone-100">
                              {item.submitted_url ? (
                                <button
                                  type="button"
                                  onClick={() => openPhotoPreview(item.submitted_url, `${student.display_name || 'Student'} Profile Photo`)}
                                  className="h-full w-full cursor-zoom-in focus:outline-none"
                                  aria-label={`Enlarge ${student.display_name || 'student'} profile photo`}
                                >
                                  <img
                                    src={item.submitted_url}
                                    alt={`${student.display_name || 'Student'} submitted profile`}
                                    className="h-full w-full object-cover"
                                  />
                                </button>
                              ) : (
                                <Camera className="h-4 w-4 text-stone-500" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-stone-900">
                                {student.display_name || 'Not recorded'}
                              </p>
                              <p className="text-xs text-stone-500">
                                {student.course_code || 'No course'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-700">
                          {getStudentCode(student)}
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-700">
                          {formatDate(item.submitted_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={item.status} />
                          {item.is_current_profile_photo ? (
                            <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-emerald-700">
                              Current
                            </span>
                          ) : null}
                        </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/admin/profile-photos/${item.review_id}`)
                            }
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-700 transition hover:bg-stone-50"
                          >
                            <Eye className="h-4 w-4" />
                            Open
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-12 text-center text-sm text-stone-500"
                    >
                      No profile photo reviews found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <ProfilePhotoPreviewDialog
        open={Boolean(photoPreview?.src)}
        onOpenChange={(open) => {
          if (!open) closePhotoPreview();
        }}
        src={photoPreview?.src || ''}
        name={photoPreview?.label || 'Profile photo'}
      />
    </div>
  );
}
