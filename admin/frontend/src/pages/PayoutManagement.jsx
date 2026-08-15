import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useSocketEvent } from '@/hooks/useSocket';
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleSlash,
  Clock3,
  Eye,
  Loader2,
  Megaphone,
  Plus,
  Search,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import PayoutProofReviewPanel from '@/components/payout/PayoutProofReviewPanel';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';

const API_BASE = buildApiUrl('/api');
const PAGE_SIZE = 6;

const C = {
  brownMid: '#7c4a2e',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  blue: '#2563EB',
  blueSoft: '#EFF6FF',
  orange: '#d97706',
  orangeSoft: '#FFF7ED',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  slate: '#475569',
  slateSoft: '#F8FAFC',
  bg: '#F8F6F2',
  line: '#e7e5e4',
};

const EMPTY_FORM = {
  opening_id: '',
  semester: '',
  academic_year_id: '',
  school_year: '',
  payout_title: '',
  payout_date: new Date().toISOString().slice(0, 10),
  payment_mode: 'Cash',
  amount_per_scholar: '',
  remarks: '',
  scholar_ids: [],
};

function getAuthHeaders(json = true) {
  const token = sessionStorage.getItem('adminToken');

  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  };
}

function normalizeId(value) {
  return value == null ? '' : String(value).trim();
}

function normalizeReleaseStatus(value) {
  const raw = String(value || 'Pending').trim().toLowerCase();

  if (raw === 'released' || raw === 'release' || raw === 'got payout') {
    return 'Released';
  }
  if (raw === 'absent' || raw === 'still absent') {
    return 'Absent';
  }
  if (raw === 'on hold' || raw === 'hold' || raw === 'held') {
    return 'On Hold';
  }
  if (raw === 'cancelled' || raw === 'canceled') {
    return 'Cancelled';
  }

  return 'Pending';
}

function belongsToOpening(item, openingId) {
  const target = normalizeId(openingId);
  if (!target) return true;

  const candidates = [
    item?.opening_id,
    item?.openingId,
    item?.program_opening_id,
    item?.programOpeningId,
    item?.opening?.opening_id,
    item?.batch_opening_id,
  ].map(normalizeId);

  return candidates.includes(target);
}

function filterScholarsByOpening(scholars = [], openingId) {
  const target = normalizeId(openingId);
  if (!target) return Array.isArray(scholars) ? scholars : [];

  return (Array.isArray(scholars) ? scholars : []).filter((scholar) =>
    belongsToOpening(scholar, target)
  );
}

function getBatchScholars(batch) {
  return filterScholarsByOpening(batch?.scholars, batch?.opening_id);
}

function isTerminalPayoutStatus(status) {
  return ['Released', 'Absent', 'Cancelled'].includes(
    normalizeReleaseStatus(status)
  );
}

function isBatchFinished(batch) {
  const scholars = getBatchScholars(batch);
  return scholars.length > 0 &&
    scholars.every((scholar) => isTerminalPayoutStatus(scholar.release_status));
}

function hasManageablePayoutEntries(batch) {
  return getBatchScholars(batch).some((scholar) => {
    const status = normalizeReleaseStatus(scholar.release_status);
    return status === 'Pending' || status === 'On Hold';
  });
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getEntryId(entry) {
  return (
    entry?.payout_entry_id ||
    entry?.payout_batch_student_id ||
    entry?.entry_id ||
    entry?.id ||
    ''
  );
}

function getPayoutCounts(batch) {
  const scholars = getBatchScholars(batch);

  return {
    total: scholars.length,
    released: scholars.filter(
      (s) => normalizeReleaseStatus(s.release_status) === 'Released'
    ).length,
    pending: scholars.filter(
      (s) => normalizeReleaseStatus(s.release_status) === 'Pending'
    ).length,
    absent: scholars.filter(
      (s) => normalizeReleaseStatus(s.release_status) === 'Absent'
    ).length,
    onHold: scholars.filter(
      (s) => normalizeReleaseStatus(s.release_status) === 'On Hold'
    ).length,
    cancelled: scholars.filter(
      (s) => normalizeReleaseStatus(s.release_status) === 'Cancelled'
    ).length,
  };
}

function getBatchDisplayStatus(batch) {
  if (batch?.is_archived) return 'Archived';
  if (isBatchFinished(batch)) return 'Completed';
  if (hasManageablePayoutEntries(batch)) return 'Active';

  const raw = String(batch?.batch_status || '').trim();
  return raw || 'Active';
}

function getBatchStatusStyles(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'archived') {
    return { background: C.slateSoft, color: C.slate };
  }
  if (normalized === 'completed') {
    return { background: C.greenSoft, color: C.green };
  }
  if (normalized === 'draft') {
    return { background: C.blueSoft, color: C.blue };
  }

  return { background: C.orangeSoft, color: C.orange };
}

function SmallMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 p-3">
      <p className="text-[11px] text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-stone-900">{value || '—'}</p>
    </div>
  );
}

function EmptyState({ title, message }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-100">
        <Wallet className="h-5 w-5 text-stone-400" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-stone-800">{title}</h3>
      <p className="mt-1 max-w-md text-xs leading-5 text-stone-500">
        {message}
      </p>
    </div>
  );
}

function PaginationFooter({
  total,
  page,
  totalPages,
  pageSize,
  onPrev,
  onNext,
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <section
      className="overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: C.line }}
    >
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-stone-400">
          Showing {start}-{end} of {total}
        </p>

        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <button
            type="button"
            disabled={page <= 1}
            onClick={onPrev}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <p className="text-xs font-medium text-stone-600">
            Page {page} / {totalPages}
          </p>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={onNext}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function ArchiveBatchModal({
  batch,
  working,
  onCancel,
  onConfirm,
}) {
  if (!batch) return null;

  const counts = getPayoutCounts(batch);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={working ? undefined : onCancel}
    >
      <Card
        className="w-full max-w-lg overflow-hidden border-stone-200 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Archive className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-stone-900">
                Archive payout batch?
              </h3>
              <p className="mt-0.5 truncate text-xs text-stone-500">
                {batch.payout_title || 'Payout Batch'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            disabled={working}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-600 disabled:opacity-50"
            aria-label="Close archive confirmation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  This does not delete payout records.
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  The batch will disappear from Active/Completed payout lists and
                  remain available under Archived for audit and historical review.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <ReadOnlyField
              label="Program / Benefactor"
              value={[
                batch.program_name,
                batch.benefactor_name,
              ].filter(Boolean).join(' • ') || '—'}
            />
            <ReadOnlyField
              label="Academic Period"
              value={[
                batch.academic_year || batch.school_year,
                batch.semester,
              ].filter(Boolean).join(' • ') || '—'}
            />
            <ReadOnlyField
              label="Scholars"
              value={`${counts.total}`}
            />
            <ReadOnlyField
              label="Total Amount"
              value={formatMoney(batch.total_amount)}
            />
          </div>

          <p className="text-xs leading-5 text-stone-500">
            Archiving is allowed only after all scholars in the batch are in a
            terminal payout state: Released, Absent, or Cancelled.
          </p>
        </CardContent>

        <div className="flex flex-col-reverse gap-2 border-t border-stone-100 bg-stone-50 px-5 py-4 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={working}
            className="h-10 rounded-xl border-stone-200"
          >
            Cancel
          </Button>

          <Button
            type="button"
            onClick={onConfirm}
            disabled={working}
            className="h-10 rounded-xl border-none bg-amber-700 text-white hover:bg-amber-800"
          >
            {working ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Archive className="mr-2 h-4 w-4" />
            )}
            Archive Batch
          </Button>
        </div>
      </Card>
    </div>
  );
}

function PostPayoutCreatePrompt({
  open,
  payout,
  onClose,
  onCreateAnnouncement,
}) {
  if (!open || !payout) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md overflow-hidden border-stone-200 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-stone-100 bg-stone-50 px-5 py-4">
          <h3 className="text-base font-semibold text-stone-900">
            Payout Batch Created
          </h3>
          <p className="mt-0.5 text-xs text-stone-500">
            {payout.payout_title || 'Payout batch created successfully.'}
          </p>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-4">
            <p className="text-sm font-medium text-stone-800">
              Create an announcement for the scholars in this scholarship opening?
            </p>
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              This opens the Announcements module with payout details prefilled.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="h-9 rounded-lg border-stone-200 text-xs"
            >
              Skip for Now
            </Button>

            <Button
              onClick={onCreateAnnouncement}
              className="h-9 rounded-lg border-none text-xs text-white"
              style={{ background: C.brownMid }}
            >
              <Megaphone className="mr-2 h-4 w-4" />
              Create Announcement
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function PayoutManagement() {
  const navigate = useNavigate();

  const [batches, setBatches] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [eligiblePayload, setEligiblePayload] = useState({
    opening: null,
    scholars: [],
  });

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [workingEntryId, setWorkingEntryId] = useState(null);
  const [archivingBatchId, setArchivingBatchId] = useState(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('batches');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [archiveCandidate, setArchiveCandidate] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [postCreateOpen, setPostCreateOpen] = useState(false);
  const [newPayoutForPrompt, setNewPayoutForPrompt] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  const loadAll = async () => {
    try {
      setLoading(true);

      const [batchRes, openingRes, academicYearRes] = await Promise.all([
        fetch(`${API_BASE}/payouts`, { headers: getAuthHeaders(false) }),
        fetch(`${API_BASE}/payouts/openings`, {
          headers: getAuthHeaders(false),
        }),
        fetch(`${API_BASE}/academic-years`, {
          headers: getAuthHeaders(false),
        }),
      ]);

      if (!batchRes.ok) throw new Error('Failed to load payout batches');
      if (!openingRes.ok) throw new Error('Failed to load openings');
      if (!academicYearRes.ok) throw new Error('Failed to load academic years');

      const [batchData, openingData, academicYearData] = await Promise.all([
        batchRes.json(),
        openingRes.json(),
        academicYearRes.json(),
      ]);

      setBatches(Array.isArray(batchData) ? batchData : []);
      setOpenings(
        (Array.isArray(openingData) ? openingData : []).filter(
          (opening) =>
            opening?.is_archived !== true &&
            String(
              opening?.status || opening?.posting_status || ''
            ).toLowerCase() !== 'archived'
        )
      );
      setAcademicYears(
        (Array.isArray(academicYearData) ? academicYearData : []).filter(
          (year) =>
            year?.is_archived !== true &&
            String(year?.status || '').toLowerCase() !== 'archived'
        )
      );
    } catch (error) {
      console.error('PAYOUT MANAGEMENT LOAD ERROR:', error);
      alert(error.message || 'Failed to load payout module');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useSocketEvent('payout:created', loadAll, []);
  useSocketEvent('payout:updated', loadAll, []);
  useSocketEvent('payout:archived', loadAll, []);
  useSocketEvent('payout:restored', loadAll, []);
  useSocketEvent('scholar:released', loadAll, []);

  useEffect(() => {
    setPage(1);
  }, [activeSection, search]);

  const loadOpeningEligibility = async (openingId) => {
    try {
      const response = await fetch(
        `${API_BASE}/payouts/eligible-scholars?opening_id=${encodeURIComponent(
          openingId
        )}`,
        { headers: getAuthHeaders(false) }
      );

      if (!response.ok) {
        throw new Error('Failed to load eligible scholars for opening');
      }

      const data = await response.json();
      const opening = data?.opening || null;
      const scholars = filterScholarsByOpening(
        Array.isArray(data?.scholars) ? data.scholars : [],
        openingId || opening?.opening_id
      );

      setEligiblePayload({ opening, scholars });

      setForm((previous) => ({
        ...previous,
        semester: opening?.semester || '',
        academic_year_id: opening?.academic_year_id || '',
        school_year: opening?.academic_year || '',
        payout_title: opening?.opening_title || '',
        amount_per_scholar:
          opening?.amount_per_scholar ??
          opening?.per_scholar_amount ??
          '',
        scholar_ids: scholars.map(
          (scholar) => scholar.scholar_id || scholar.student_id
        ),
      }));
    } catch (error) {
      console.error('OPENING ELIGIBILITY LOAD ERROR:', error);
      setEligiblePayload({ opening: null, scholars: [] });
    }
  };

  useEffect(() => {
    if (!form.opening_id) {
      setEligiblePayload({ opening: null, scholars: [] });
      return;
    }

    loadOpeningEligibility(form.opening_id);
  }, [form.opening_id]);

  const activeBatches = useMemo(
    () => batches.filter((batch) => batch?.is_archived !== true),
    [batches]
  );

  const archivedBatches = useMemo(
    () => batches.filter((batch) => batch?.is_archived === true),
    [batches]
  );

  const inProgressBatches = useMemo(
    () => activeBatches.filter((batch) => !isBatchFinished(batch)),
    [activeBatches]
  );

  const statusManagerBatches = useMemo(
    () => activeBatches.filter(hasManageablePayoutEntries),
    [activeBatches]
  );

  const completedBatches = useMemo(
    () => activeBatches.filter(isBatchFinished),
    [activeBatches]
  );

  const displayedBatches = useMemo(() => {
    if (activeSection === 'batches') return inProgressBatches;
    if (activeSection === 'status') return statusManagerBatches;
    if (activeSection === 'completed') return completedBatches;
    if (activeSection === 'archived') return archivedBatches;
    return [];
  }, [
    activeSection,
    archivedBatches,
    completedBatches,
    inProgressBatches,
    statusManagerBatches,
  ]);

  const filteredDisplayedBatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return displayedBatches;

    return displayedBatches.filter((batch) =>
      [
        batch.payout_title,
        batch.program_name,
        batch.benefactor_name,
        batch.semester,
        batch.school_year,
        batch.academic_year,
        batch.payout_date,
        batch.batch_status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [displayedBatches, search]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredDisplayedBatches.length / PAGE_SIZE)
  );

  const pageData = useMemo(
    () =>
      filteredDisplayedBatches.slice(
        (page - 1) * PAGE_SIZE,
        page * PAGE_SIZE
      ),
    [filteredDisplayedBatches, page]
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const selectedOpeningDetails = useMemo(
    () =>
      openings.find((opening) => opening.opening_id === form.opening_id) ||
      eligiblePayload.opening ||
      null,
    [eligiblePayload.opening, form.opening_id, openings]
  );

  const filteredEligibleScholars = useMemo(
    () =>
      filterScholarsByOpening(
        eligiblePayload.scholars,
        form.opening_id || selectedOpeningDetails?.opening_id
      ),
    [eligiblePayload.scholars, form.opening_id, selectedOpeningDetails]
  );

  const sectionMeta = useMemo(() => {
    const map = {
      batches: {
        title: 'Active Payout Batches',
        subtitle: `${inProgressBatches.length} active batch${
          inProgressBatches.length === 1 ? '' : 'es'
        } currently being processed`,
        emptyTitle: 'No active payout batches',
        empty:
          'Create a payout batch when active scholars are ready for payout scheduling.',
      },
      status: {
        title: 'Payout Status Manager',
        subtitle: `${statusManagerBatches.length} batch${
          statusManagerBatches.length === 1 ? '' : 'es'
        } with Pending or On Hold scholars`,
        emptyTitle: 'No payout statuses need attention',
        empty:
          'All active payout entries are already in terminal states.',
      },
      completed: {
        title: 'Completed Payouts',
        subtitle: `${completedBatches.length} completed payout batch${
          completedBatches.length === 1 ? '' : 'es'
        } ready for archival`,
        emptyTitle: 'No completed payout batches',
        empty:
          'Completed batches appear here after all scholars are Released, Absent, or Cancelled.',
      },
      archived: {
        title: 'Archived Payout Batches',
        subtitle: `${archivedBatches.length} archived payout batch${
          archivedBatches.length === 1 ? '' : 'es'
        } retained for historical access`,
        emptyTitle: 'No archived payout batches',
        empty:
          'Archived payout records remain available here and are never deleted by the archive action.',
      },
    };

    return map[activeSection] || map.batches;
  }, [
    activeSection,
    archivedBatches.length,
    completedBatches.length,
    inProgressBatches.length,
    statusManagerBatches.length,
  ]);

  const resetCreateForm = () => {
    setForm({
      ...EMPTY_FORM,
      payout_date: new Date().toISOString().slice(0, 10),
    });
    setEligiblePayload({ opening: null, scholars: [] });
  };

  const toggleScholar = (scholarId) => {
    setForm((previous) => ({
      ...previous,
      scholar_ids: previous.scholar_ids.includes(scholarId)
        ? previous.scholar_ids.filter((id) => id !== scholarId)
        : [...previous.scholar_ids, scholarId],
    }));
  };

  const handleCreateBatch = async () => {
    if (!form.opening_id) {
      alert('Please select an opening first.');
      return;
    }
    if (!form.semester) {
      alert('Please select a semester.');
      return;
    }
    if (!form.scholar_ids.length) {
      alert('No scholars selected.');
      return;
    }

    try {
      setCreating(true);

      const response = await fetch(`${API_BASE}/payouts`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          opening_id: form.opening_id,
          semester: form.semester,
          academic_year_id: form.academic_year_id,
          payout_title: form.payout_title,
          payout_date: form.payout_date,
          payment_mode: form.payment_mode,
          remarks: form.remarks,
          scholar_ids: form.scholar_ids,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || 'Failed to create payout batch'
        );
      }

      const createdBatch = data?.data || data || {};
      setNewPayoutForPrompt({
        ...createdBatch,
        opening_id: form.opening_id,
        opening_title:
          selectedOpeningDetails?.opening_title ||
          form.payout_title,
        program_name:
          selectedOpeningDetails?.program_name ||
          createdBatch.program_name ||
          '',
        benefactor_name:
          selectedOpeningDetails?.benefactor_name ||
          createdBatch.benefactor_name ||
          '',
        academic_year:
          form.school_year ||
          selectedOpeningDetails?.academic_year ||
          '',
        semester: form.semester,
        payout_title: form.payout_title,
        payout_date: form.payout_date,
        payment_mode: form.payment_mode,
        amount_per_scholar: form.amount_per_scholar,
        scholar_count: form.scholar_ids.length,
      });
      setPostCreateOpen(true);
      setShowCreateModal(false);
      resetCreateForm();
      await loadAll();
      setActiveSection('batches');
    } catch (error) {
      console.error('CREATE PAYOUT BATCH ERROR:', error);
      alert(error.message || 'Failed to create payout batch');
    } finally {
      setCreating(false);
    }
  };

  const handleCreatePayoutAnnouncementRedirect = () => {
    if (!newPayoutForPrompt) return;

    const payoutDate = formatDate(newPayoutForPrompt.payout_date);
    const amount = formatMoney(newPayoutForPrompt.amount_per_scholar);

    const title = `${
      newPayoutForPrompt.payout_title || 'Scholarship Payout'
    } Announcement`;

    const params = new URLSearchParams({
      prefill: 'payout',
      title,
      subject: title,
      content: [
        'Good day, scholars.',
        '',
        `Please be informed that the payout batch for ${
          newPayoutForPrompt.opening_title ||
          newPayoutForPrompt.payout_title ||
          'your scholarship opening'
        } has been created.`,
        '',
        `Payout Date: ${payoutDate}`,
        `Payment Mode: ${newPayoutForPrompt.payment_mode || 'Cash'}`,
        `Amount per Scholar: ${amount}`,
        `Number of Scholars Included: ${
          newPayoutForPrompt.scholar_count || 0
        }`,
        '',
        'Please wait for further instructions from OSFA regarding the release process.',
      ].join('\n'),
      audience: 'scholars',
      target_audience: 'scholars',
      opening_id: newPayoutForPrompt.opening_id || '',
      payout_batch_id: newPayoutForPrompt.payout_batch_id || '',
      program_id: newPayoutForPrompt.program_id || '',
      academic_year: newPayoutForPrompt.academic_year || '',
      semester: newPayoutForPrompt.semester || '',
    });

    navigate(`/admin/announcements?${params.toString()}`);
  };

  const handleStatusUpdate = async (entry, nextStatus) => {
    const entryId = getEntryId(entry);
    if (!entryId) {
      alert('Missing payout entry ID.');
      return;
    }

    try {
      setWorkingEntryId(entryId);
      const finalStatus = normalizeReleaseStatus(nextStatus);

      const response = await fetch(
        `${API_BASE}/payouts/entries/${entryId}/status`,
        {
          method: 'PATCH',
          headers: getAuthHeaders(true),
          body: JSON.stringify({
            release_status: finalStatus,
            status: finalStatus,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || 'Failed to update payout status'
        );
      }

      setSelectedBatch((previous) => {
        if (!previous) return previous;

        return {
          ...previous,
          scholars: (previous.scholars || []).map((scholar) =>
            String(getEntryId(scholar)) === String(entryId)
              ? { ...scholar, release_status: finalStatus }
              : scholar
          ),
        };
      });

      await loadAll();
    } catch (error) {
      console.error('UPDATE PAYOUT STATUS ERROR:', error);
      alert(error.message || 'Failed to update payout status');
    } finally {
      setWorkingEntryId(null);
    }
  };

  const requestArchiveBatch = (batch) => {
    if (!batch?.payout_batch_id) return;

    if (!isBatchFinished(batch)) {
      alert(
        'This payout batch cannot be archived yet. All scholars must be marked Released, Absent, or Cancelled first.'
      );
      return;
    }

    setArchiveCandidate(batch);
  };

  const confirmArchiveBatch = async () => {
    const batch = archiveCandidate;
    if (!batch?.payout_batch_id) return;

    try {
      setArchivingBatchId(batch.payout_batch_id);

      const response = await fetch(
        `${API_BASE}/payouts/${batch.payout_batch_id}/archive`,
        {
          method: 'PATCH',
          headers: getAuthHeaders(true),
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data?.message || data?.error || 'Failed to archive payout batch'
        );
      }

      setArchiveCandidate(null);
      setSelectedBatch(null);

      // Optimistic removal from all active lists; realtime/loadAll remains the
      // source of truth and keeps other open admin sessions synchronized.
      setBatches((previous) =>
        previous.map((item) =>
          String(item.payout_batch_id) === String(batch.payout_batch_id)
            ? {
                ...item,
                is_archived: true,
                batch_status: 'Archived',
              }
            : item
        )
      );

      setActiveSection('archived');
      await loadAll();
    } catch (error) {
      console.error('ARCHIVE PAYOUT BATCH ERROR:', error);
      alert(error.message || 'Failed to archive payout batch');
    } finally {
      setArchivingBatchId(null);
    }
  };

  const renderStatusBadge = (status) => {
    const value = normalizeReleaseStatus(status);

    const styles = {
      Released: {
        background: C.greenSoft,
        color: C.green,
        icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
      },
      Pending: {
        background: C.orangeSoft,
        color: C.orange,
        icon: <Clock3 className="mr-1 h-3 w-3" />,
      },
      Absent: {
        background: C.redSoft,
        color: C.red,
        icon: <XCircle className="mr-1 h-3 w-3" />,
      },
      'On Hold': {
        background: C.blueSoft,
        color: C.blue,
        icon: <CircleSlash className="mr-1 h-3 w-3" />,
      },
      Cancelled: {
        background: C.slateSoft,
        color: C.slate,
        icon: <XCircle className="mr-1 h-3 w-3" />,
      },
    };

    const current = styles[value] || styles.Pending;

    return (
      <Badge
        className="inline-flex items-center rounded-full border-none text-[10px]"
        style={current}
      >
        {current.icon}
        {value}
      </Badge>
    );
  };

  const getStatusActions = (status) => {
    const value = normalizeReleaseStatus(status);

    if (value === 'Released' || value === 'Cancelled') return [];

    if (value === 'On Hold') {
      return [
        { label: 'Release', status: 'Released', tone: 'green' },
        { label: 'Mark Absent', status: 'Absent', tone: 'red' },
      ];
    }

    if (value === 'Absent') {
      return [
        { label: 'Release', status: 'Released', tone: 'green' },
        { label: 'Put On Hold', status: 'On Hold', tone: 'blue' },
      ];
    }

    return [
      { label: 'Release', status: 'Released', tone: 'green' },
      { label: 'Absent', status: 'Absent', tone: 'red' },
      { label: 'On Hold', status: 'On Hold', tone: 'blue' },
    ];
  };

  const getActionButtonClass = (tone) => {
    const map = {
      green: 'border-green-200 text-green-700 hover:bg-green-50',
      red: 'border-red-200 text-red-700 hover:bg-red-50',
      blue: 'border-blue-200 text-blue-700 hover:bg-blue-50',
    };
    return map[tone] || 'border-stone-200 text-stone-700 hover:bg-stone-50';
  };

  const renderBatchCard = (batch) => {
    const counts = getPayoutCounts(batch);
    const displayStatus = getBatchDisplayStatus(batch);
    const statusStyle = getBatchStatusStyles(displayStatus);
    const period = [
      batch.academic_year || batch.school_year,
      batch.semester,
    ]
      .filter(Boolean)
      .join(' • ');

    return (
      <Card
        key={batch.payout_batch_id}
        className="h-full rounded-2xl border-stone-200 bg-white shadow-none transition hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-sm"
      >
        <CardContent className="flex h-full flex-col p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-stone-900">
                {batch.payout_title || 'Untitled Payout Batch'}
              </h3>
              <p className="mt-1 line-clamp-2 text-sm text-stone-600">
                {batch.program_name || 'No Program'}
                {batch.benefactor_name
                  ? ` • ${batch.benefactor_name}`
                  : ''}
              </p>
            </div>

            <Badge
              className="shrink-0 rounded-full border-none text-[10px]"
              style={statusStyle}
            >
              {displayStatus}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <SmallMetric
              label="Academic Period"
              value={period || '—'}
            />
            <SmallMetric
              label="Payout Date"
              value={formatDate(batch.payout_date)}
            />
            <SmallMetric
              label="Scholars"
              value={counts.total}
            />
            <SmallMetric
              label="Amount / Scholar"
              value={formatMoney(batch.amount_per_scholar)}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SmallMetric label="Released" value={counts.released} />
            <SmallMetric label="Pending" value={counts.pending} />
            <SmallMetric label="Absent" value={counts.absent} />
            <SmallMetric label="On Hold" value={counts.onHold} />
          </div>

          <div className="mt-4 flex flex-col gap-3 border-t border-stone-100 pt-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-stone-400">
                Payout Amount Summary
              </p>
              <p className="mt-1 text-lg font-semibold text-stone-900">
                {formatMoney(batch.total_amount)}
              </p>
              <p className="mt-0.5 text-xs text-stone-500">
                {batch.payment_mode || 'Payment mode not set'}
              </p>
            </div>

            <Button
              size="sm"
              className="h-9 w-full rounded-xl px-3 text-xs text-white sm:w-auto"
              style={{ background: C.brownMid }}
              onClick={() => setSelectedBatch(batch)}
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Open Batch
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return <PageLoadingSkeleton label="Loading payout management" showStats />;
  }

  return (
    <div className="space-y-4 py-3" style={{ background: C.bg }}>
      <ArchiveBatchModal
        batch={archiveCandidate}
        working={
          !!archiveCandidate &&
          archivingBatchId === archiveCandidate.payout_batch_id
        }
        onCancel={() => {
          if (!archivingBatchId) setArchiveCandidate(null);
        }}
        onConfirm={confirmArchiveBatch}
      />

      <PostPayoutCreatePrompt
        open={postCreateOpen}
        payout={newPayoutForPrompt}
        onClose={() => {
          setPostCreateOpen(false);
          setNewPayoutForPrompt(null);
        }}
        onCreateAnnouncement={handleCreatePayoutAnnouncementRedirect}
      />

      <PayoutProofReviewPanel />

      <section
        className="rounded-2xl border bg-white p-3 sm:p-4"
        style={{ borderColor: C.line }}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-100 p-1 sm:flex sm:w-auto">
            {[
              ['batches', 'Active', inProgressBatches.length],
              ['status', 'Status Manager', statusManagerBatches.length],
              ['completed', 'Completed', completedBatches.length],
              ['archived', 'Archived', archivedBatches.length],
            ].map(([key, label, count]) => (
              <button
                type="button"
                key={key}
                onClick={() => setActiveSection(key)}
                className={`rounded-lg px-3 py-2 text-xs font-medium transition sm:px-4 sm:text-sm ${
                  activeSection === key
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600'
                }`}
              >
                {label}
                {Number(count) > 0 ? (
                  <span className="ml-2 rounded-full bg-stone-900 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                    {count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:min-w-[300px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                className="h-10 rounded-xl border-stone-200 bg-stone-50 pl-10"
                placeholder="Search payout title, program, benefactor..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <Button
              style={{ background: C.brownMid }}
              className="h-10 rounded-xl text-white"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Payout Batch
            </Button>
          </div>
        </div>
      </section>

      <section
        className="overflow-hidden rounded-2xl border bg-white"
        style={{ borderColor: C.line }}
      >
        <div className="border-b border-stone-100 px-4 py-4 sm:px-5">
          <h2 className="text-sm font-semibold text-stone-800">
            {sectionMeta.title}
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            {sectionMeta.subtitle}
          </p>
        </div>

        <CardContent className="p-3 sm:p-4">
          {pageData.length === 0 ? (
            <EmptyState
              title={sectionMeta.emptyTitle}
              message={sectionMeta.empty}
            />
          ) : (
            <section className="grid items-stretch gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {pageData.map(renderBatchCard)}
            </section>
          )}
        </CardContent>
      </section>

      <PaginationFooter
        total={filteredDisplayedBatches.length}
        page={page}
        totalPages={totalPages}
        pageSize={PAGE_SIZE}
        onPrev={() => setPage((previous) => Math.max(1, previous - 1))}
        onNext={() =>
          setPage((previous) => Math.min(totalPages, previous + 1))
        }
      />

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="max-h-[94vh] w-full max-w-6xl overflow-auto rounded-2xl border bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white px-4 py-4 sm:px-6">
              <div>
                <h2 className="text-lg font-semibold text-stone-900 sm:text-xl">
                  Create Payout Batch
                </h2>
                <p className="mt-0.5 text-xs text-stone-500 sm:text-sm">
                  Select an opening. Eligible active scholars are loaded automatically.
                </p>
              </div>

              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="rounded-xl"
              >
                Close
              </Button>
            </div>

            <div className="space-y-5 p-4 sm:p-6">
              <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-stone-200 shadow-none">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-stone-500" />
                      <h3 className="font-semibold text-stone-900">
                        Opening Source
                      </h3>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">Opening</label>
                      <select
                        className="h-11 w-full rounded-md border px-3"
                        value={form.opening_id}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            opening_id: event.target.value,
                          }))
                        }
                      >
                        <option value="">Select opening</option>
                        {openings.map((opening) => (
                          <option
                            key={opening.opening_id}
                            value={opening.opening_id}
                          >
                            {opening.opening_title} —{' '}
                            {opening.benefactor_name || 'No Benefactor'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <ReadOnlyField
                        label="Program"
                        value={selectedOpeningDetails?.program_name}
                      />
                      <ReadOnlyField
                        label="Benefactor"
                        value={selectedOpeningDetails?.benefactor_name}
                      />
                      <ReadOnlyField
                        label="Opening Status"
                        value={
                          selectedOpeningDetails?.status ||
                          selectedOpeningDetails?.posting_status
                        }
                      />
                      <ReadOnlyField
                        label="Amount per Scholar"
                        value={
                          form.amount_per_scholar !== ''
                            ? formatMoney(form.amount_per_scholar)
                            : '—'
                        }
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-stone-200 shadow-none">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-stone-500" />
                      <h3 className="font-semibold text-stone-900">
                        Batch Details
                      </h3>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Semester</label>
                        <select
                          className="h-11 w-full rounded-md border px-3"
                          value={form.semester}
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              semester: event.target.value,
                            }))
                          }
                        >
                          <option value="">Select semester</option>
                          <option value="First Semester">First Semester</option>
                          <option value="Second Semester">Second Semester</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium">
                          Academic Year
                        </label>
                        <select
                          className="h-11 w-full rounded-md border px-3"
                          value={form.academic_year_id}
                          onChange={(event) => {
                            const selectedId = event.target.value;
                            const selectedYear = academicYears.find(
                              (year) =>
                                String(year.academic_year_id) ===
                                String(selectedId)
                            );

                            setForm((previous) => ({
                              ...previous,
                              academic_year_id: selectedId,
                              school_year: selectedYear?.label || '',
                            }));
                          }}
                        >
                          <option value="">Select academic year</option>
                          {academicYears.map((year) => (
                            <option
                              key={year.academic_year_id}
                              value={year.academic_year_id}
                            >
                              {year.label}
                              {year.is_active ? ' (Active)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <label className="text-sm font-medium">
                          Payout Title
                        </label>
                        <Input
                          value={form.payout_title}
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              payout_title: event.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium">
                          Payout Date
                        </label>
                        <Input
                          type="date"
                          value={form.payout_date}
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              payout_date: event.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium">
                          Payment Mode
                        </label>
                        <select
                          className="h-11 w-full rounded-md border px-3"
                          value={form.payment_mode}
                          onChange={(event) =>
                            setForm((previous) => ({
                              ...previous,
                              payment_mode: event.target.value,
                            }))
                          }
                        >
                          <option value="Cash">Cash</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">Remarks</label>
                      <textarea
                        className="min-h-[90px] w-full rounded-md border p-3 text-sm"
                        value={form.remarks}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            remarks: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-stone-200 shadow-none">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-stone-500" />
                      <div>
                        <h3 className="font-semibold text-stone-900">
                          Eligible Scholars
                        </h3>
                        <p className="text-xs text-stone-500 sm:text-sm">
                          Loaded from the selected scholarship opening.
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {form.scholar_ids.length} selected
                    </Badge>
                  </div>

                  <div className="max-h-[320px] overflow-auto rounded-xl border">
                    {filteredEligibleScholars.length === 0 ? (
                      <div className="p-6 text-sm text-stone-400">
                        Select an opening to load eligible scholars.
                      </div>
                    ) : (
                      filteredEligibleScholars.map((scholar) => {
                        const scholarId =
                          scholar.scholar_id || scholar.student_id;
                        const checked =
                          form.scholar_ids.includes(scholarId);

                        return (
                          <label
                            key={scholarId}
                            className="flex cursor-pointer items-center justify-between gap-3 border-b p-4 hover:bg-stone-50"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleScholar(scholarId)}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-stone-900">
                                  {scholar.student_name}
                                </p>
                                <p className="text-xs text-stone-500">
                                  {scholar.pdm_id || '—'}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline">{scholar.status}</Badge>
                          </label>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="rounded-xl"
                >
                  Cancel
                </Button>

                <Button
                  style={{ background: C.brownMid }}
                  className="rounded-xl text-white"
                  disabled={creating}
                  onClick={handleCreateBatch}
                >
                  {creating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save Payout Batch
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-3 sm:p-4">
          <div className="max-h-[94vh] w-full max-w-6xl overflow-auto rounded-2xl border bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex flex-col gap-3 border-b bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-stone-900 sm:text-xl">
                  {selectedBatch.payout_title || 'Payout Batch'}
                </h2>
                <p className="mt-1 text-xs text-stone-500 sm:text-sm">
                  {[
                    selectedBatch.program_name,
                    selectedBatch.benefactor_name,
                    selectedBatch.academic_year ||
                      selectedBatch.school_year,
                    selectedBatch.semester,
                    formatDate(selectedBatch.payout_date),
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!selectedBatch.is_archived ? (
                  <Button
                    variant="outline"
                    className="rounded-xl border-stone-300"
                    disabled={!isBatchFinished(selectedBatch)}
                    onClick={() => requestArchiveBatch(selectedBatch)}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    Archive Batch
                  </Button>
                ) : null}

                <Button
                  variant="outline"
                  onClick={() => setSelectedBatch(null)}
                  className="rounded-xl"
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="space-y-4 p-4 sm:p-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {(() => {
                  const counts = getPayoutCounts(selectedBatch);
                  return (
                    <>
                      <SmallMetric label="Scholars" value={counts.total} />
                      <SmallMetric label="Released" value={counts.released} />
                      <SmallMetric label="Pending" value={counts.pending} />
                      <SmallMetric label="Absent" value={counts.absent} />
                      <SmallMetric label="On Hold" value={counts.onHold} />
                      <SmallMetric
                        label="Total"
                        value={formatMoney(selectedBatch.total_amount)}
                      />
                    </>
                  );
                })()}
              </div>

              {getBatchScholars(selectedBatch).length === 0 ? (
                <Card className="border-stone-200 shadow-none">
                  <CardContent className="p-6 text-sm text-stone-400">
                    No scholars found in this payout batch.
                  </CardContent>
                </Card>
              ) : (
                getBatchScholars(selectedBatch).map((entry) => {
                  const entryId = getEntryId(entry);
                  const status = normalizeReleaseStatus(
                    entry.release_status
                  );
                  const actions = getStatusActions(status);
                  const isWorking =
                    String(workingEntryId) === String(entryId);
                  const locked = selectedBatch.is_archived === true;

                  return (
                    <Card
                      key={
                        entryId ||
                        entry.scholar_id ||
                        entry.student_id
                      }
                      className="border-stone-200 shadow-none"
                    >
                      <CardContent className="flex flex-col gap-4 p-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm font-semibold text-stone-900">
                              {entry.student_name}
                            </h3>
                            {renderStatusBadge(status)}
                          </div>
                          <p className="mt-1 text-xs text-stone-500">
                            {entry.pdm_id || '—'} •{' '}
                            {formatMoney(entry.amount_received)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 xl:justify-end">
                          {locked ? (
                            <span className="text-xs font-medium text-stone-500">
                              Archived batch is read-only
                            </span>
                          ) : actions.length === 0 ? (
                            <span className="text-xs font-medium text-stone-500">
                              No further action required
                            </span>
                          ) : (
                            actions.map((action) => (
                              <Button
                                key={`${entryId}-${action.status}`}
                                size="sm"
                                variant="outline"
                                className={`h-8 rounded-lg text-xs ${getActionButtonClass(
                                  action.tone
                                )}`}
                                disabled={isWorking}
                                onClick={() =>
                                  handleStatusUpdate(entry, action.status)
                                }
                              >
                                {isWorking ? (
                                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                ) : null}
                                {action.label}
                              </Button>
                            ))
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
