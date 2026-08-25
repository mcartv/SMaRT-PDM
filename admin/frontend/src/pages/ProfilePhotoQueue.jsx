import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Eye,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react';
import { buildApiUrl } from '../config/api';

const STATUS_OPTIONS = ['pending', 'approved', 'rejected', 'superseded'];

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
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${statusClass(
        status
      )}`}
    >
      {status || 'pending'}
    </span>
  );
}

function ImagePreview({ src, label }) {
  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
      <div className="border-b border-stone-100 px-4 py-3">
        <p className="text-sm font-semibold text-stone-800">{label}</p>
      </div>
      <div className="flex min-h-80 items-center justify-center bg-stone-50 p-4">
        {src ? (
          <img
            src={src}
            alt={label}
            className="max-h-[440px] w-full rounded-md object-contain"
          />
        ) : (
          <div className="text-center text-sm text-stone-500">
            No image available
          </div>
        )}
      </div>
    </div>
  );
}

function RejectModal({ onClose, onSubmit, busy }) {
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({ reason, remarks });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl"
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
          onChange={(event) => setReason(event.target.value)}
          className="mt-2 min-h-28 w-full rounded-md border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#9a5d3a] focus:ring-2 focus:ring-[#9a5d3a]/15"
        />

        <label className="mt-4 block text-sm font-semibold text-stone-700">
          Remarks
        </label>
        <textarea
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          className="mt-2 min-h-20 w-full rounded-md border border-stone-200 px-3 py-2 text-sm outline-none focus:border-[#9a5d3a] focus:ring-2 focus:ring-[#9a5d3a]/15"
        />

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-stone-200 px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
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
  const [status, setStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  const isDetail = Boolean(reviewId);

  async function loadQueue(nextStatus = status) {
    setLoading(true);
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
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err.message || 'Failed to load profile photo reviews.');
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail() {
    if (!reviewId) return;

    setLoading(true);
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
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isDetail) {
      loadDetail();
    } else {
      loadQueue(status);
    }
  }, [isDetail, reviewId, status]);

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
          body: JSON.stringify({ remarks: 'Approved' }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve profile photo.');
      }
      await loadDetail();
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
      await loadDetail();
    } catch (err) {
      setError(err.message || 'Failed to reject profile photo.');
    } finally {
      setActionBusy(false);
    }
  };

  if (isDetail) {
    const student = detail?.student || {};
    const canReview = detail?.status === 'pending';

    return (
      <div className="h-full overflow-y-auto bg-[#faf7f2] p-5 md:p-6">
        <div className="mx-auto max-w-7xl">
          <button
            type="button"
            onClick={() => navigate('/admin/profile-photos')}
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-600 hover:text-stone-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to queue
          </button>

          <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#9a5d3a]">
                Profile Photo Review
              </p>
              <h1 className="mt-1 text-2xl font-bold text-stone-900">
                {student.display_name || 'Student profile photo'}
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                {getStudentCode(student)} · Submitted {formatDate(detail?.submitted_at)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {detail?.status && <StatusPill status={detail.status} />}
              <button
                type="button"
                onClick={loadDetail}
                className="inline-flex items-center gap-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="rounded-lg border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">
              Loading profile photo review...
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="grid gap-5 md:grid-cols-2">
                <ImagePreview
                  src={detail?.submitted_url}
                  label="Submitted Photo"
                />
                <ImagePreview
                  src={student.current_avatar_url}
                  label="Current Approved Photo"
                />
              </div>

              <div className="space-y-5">
                <section className="rounded-lg border border-stone-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-stone-900">
                    Student Details
                  </h2>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div>
                      <dt className="text-stone-500">Name</dt>
                      <dd className="font-semibold text-stone-900">
                        {student.display_name || 'Not recorded'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Student ID</dt>
                      <dd className="font-semibold text-stone-900">
                        {getStudentCode(student)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Course</dt>
                      <dd className="font-semibold text-stone-900">
                        {student.course_code || 'Not recorded'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">Email</dt>
                      <dd className="font-semibold text-stone-900">
                        {student.email_address || 'Not recorded'}
                      </dd>
                    </div>
                    {detail?.rejection_reason && (
                      <div>
                        <dt className="text-stone-500">Rejection Reason</dt>
                        <dd className="font-semibold text-red-700">
                          {detail.rejection_reason}
                        </dd>
                      </div>
                    )}
                  </dl>

                  {canReview && (
                    <div className="mt-5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleApprove}
                        disabled={actionBusy}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowRejectModal(true)}
                        disabled={actionBusy}
                        className="inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </button>
                    </div>
                  )}
                </section>

                <section className="rounded-lg border border-stone-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-stone-900">
                    Review History
                  </h2>
                  <div className="mt-4 space-y-3">
                    {history.length > 0 ? (
                      history.map((item) => (
                        <div
                          key={item.review_id}
                          className="rounded-md border border-stone-100 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <StatusPill status={item.status} />
                            <span className="text-xs text-stone-500">
                              {formatDate(item.submitted_at)}
                            </span>
                          </div>
                          {item.rejection_reason && (
                            <p className="mt-2 text-xs text-red-700">
                              {item.rejection_reason}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-stone-500">
                        No prior review records.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          )}
        </div>

        {showRejectModal && (
          <RejectModal
            busy={actionBusy}
            onClose={() => setShowRejectModal(false)}
            onSubmit={handleReject}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#faf7f2] p-5 md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9a5d3a]">
              Admin Review
            </p>
            <h1 className="mt-1 text-2xl font-bold text-stone-900">
              Profile Photos
            </h1>
            <p className="mt-1 text-sm text-stone-500">
              Review submitted student profile pictures before they go live.
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadQueue(status)}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="mb-4 flex flex-col gap-3 rounded-lg border border-stone-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleStatusChange(option)}
                className={`rounded-md px-3 py-2 text-sm font-semibold capitalize ${
                  status === option
                    ? 'bg-[#9a5d3a] text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-80">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search student"
              className="w-full rounded-md border border-stone-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#9a5d3a] focus:ring-2 focus:ring-[#9a5d3a]/15"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-stone-100">
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
                                <img
                                  src={item.submitted_url}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
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
                          <StatusPill status={item.status} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              navigate(`/admin/profile-photos/${item.review_id}`)
                            }
                            className="inline-flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
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
    </div>
  );
}
