import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useSocketEvent } from '@/hooks/useSocket';
import {
  Loader2,
  Plus,
  Wallet,
  CheckCircle2,
  Clock3,
  XCircle,
  CircleSlash,
  Search,
  Eye,
  Users,
  Building2,
  Archive,
  ArchiveRestore,
  Megaphone,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { buildApiUrl } from '@/api';

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

  if (raw === 'released' || raw === 'release' || raw === 'got payout') return 'Released';
  if (raw === 'absent' || raw === 'still absent') return 'Absent';
  if (raw === 'on hold' || raw === 'hold' || raw === 'held') return 'On Hold';
  if (raw === 'cancelled' || raw === 'canceled') return 'Cancelled';

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
  const normalized = normalizeReleaseStatus(status);
  return ['Released', 'Absent', 'Cancelled'].includes(normalized);
}

function isBatchFinished(batch) {
  const scholars = getBatchScholars(batch);
  if (!scholars.length) return false;

  return scholars.every((s) => isTerminalPayoutStatus(s.release_status));
}

function hasManageablePayoutEntries(batch) {
  const scholars = getBatchScholars(batch);

  return scholars.some((s) => {
    const status = normalizeReleaseStatus(s.release_status);
    return status === 'Pending' || status === 'On Hold';
  });
}

function formatMoney(value) {
  return `₱${Number(value || 0).toLocaleString()}`;
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
    released: scholars.filter((s) => normalizeReleaseStatus(s.release_status) === 'Released').length,
    pending: scholars.filter((s) => normalizeReleaseStatus(s.release_status) === 'Pending').length,
    absent: scholars.filter((s) => normalizeReleaseStatus(s.release_status) === 'Absent').length,
    onHold: scholars.filter((s) => normalizeReleaseStatus(s.release_status) === 'On Hold').length,
    cancelled: scholars.filter((s) => normalizeReleaseStatus(s.release_status) === 'Cancelled').length,
  };
}

function SmallMetric({ label, value }) {
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="rounded-xl border bg-stone-50 p-3">
      <p className="text-[11px] text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value || '—'}</p>
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
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-xs text-stone-400">
          Showing {start}-{end} of {total}
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={onPrev}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 text-stone-500 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
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
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
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
        onClick={(e) => e.stopPropagation()}
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
              This will open the Announcements module with the payout details already filled in.
            </p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <p className="text-xs font-semibold text-stone-700">
              {payout.opening_title || payout.payout_title || 'Scholarship Payout'}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {payout.program_name || 'No Program'}
              {payout.benefactor_name ? ` • ${payout.benefactor_name}` : ''}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              {payout.scholar_count || 0} scholar(s) selected
              {payout.amount_per_scholar
                ? ` • ${formatMoney(payout.amount_per_scholar)} per scholar`
                : ''}
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
  const [eligiblePayload, setEligiblePayload] = useState({
    opening: null,
    scholars: [],
  });

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [workingEntryId, setWorkingEntryId] = useState(null);
  const [archivingBatchId, setArchivingBatchId] = useState(null);
  const [restoringBatchId, setRestoringBatchId] = useState(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('batches');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [academicYears, setAcademicYears] = useState([]);

  const [postCreateOpen, setPostCreateOpen] = useState(false);
  const [newPayoutForPrompt, setNewPayoutForPrompt] = useState(null);

  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    loadAll();
  }, []);

  useSocketEvent('payout:created', () => {
    loadAll();
  }, []);

  useSocketEvent('payout:updated', () => {
    loadAll();
  }, []);

  useSocketEvent('payout:archived', () => {
    loadAll();
  }, []);

  useSocketEvent('payout:restored', () => {
    loadAll();
  }, []);

  useSocketEvent('scholar:released', () => {
    loadAll();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeSection, search]);

  useEffect(() => {
    if (!form.opening_id) {
      setEligiblePayload({ opening: null, scholars: [] });
      setForm((prev) => ({
        ...prev,
        semester: '',
        academic_year_id: '',
        school_year: '',
        payout_title: '',
        amount_per_scholar: '',
        scholar_ids: [],
      }));
      return;
    }

    loadOpeningEligibility(form.opening_id);
  }, [form.opening_id]);

  const loadAll = async () => {
    try {
      setLoading(true);

      const [batchRes, openingRes, academicYearRes] = await Promise.all([
        fetch(`${API_BASE}/payouts`, { headers: getAuthHeaders(false) }),
        fetch(`${API_BASE}/payouts/openings`, { headers: getAuthHeaders(false) }),
        fetch(`${API_BASE}/academic-years`, { headers: getAuthHeaders(false) }),
      ]);

      if (!batchRes.ok) throw new Error('Failed to load payout batches');
      if (!openingRes.ok) throw new Error('Failed to load openings');
      if (!academicYearRes.ok) throw new Error('Failed to load academic years');

      const batchData = await batchRes.json();
      const openingData = await openingRes.json();
      const academicYearData = await academicYearRes.json();

      setBatches(Array.isArray(batchData) ? batchData : []);

      setOpenings(
        (Array.isArray(openingData) ? openingData : []).filter(
          (o) =>
            !o.is_archived &&
            String(o.status || o.posting_status || '').toLowerCase() !== 'archived'
        )
      );

      setAcademicYears(
        (Array.isArray(academicYearData) ? academicYearData : []).filter(
          (ay) =>
            ay?.is_archived !== true &&
            String(ay?.status || '').toLowerCase() !== 'archived'
        )
      );
    } catch (err) {
      console.error('PAYOUT MANAGEMENT LOAD ERROR:', err);
      alert(err.message || 'Failed to load payout module');
    } finally {
      setLoading(false);
    }
  };

  const loadOpeningEligibility = async (openingId) => {
    try {
      const res = await fetch(
        `${API_BASE}/payouts/eligible-scholars?opening_id=${encodeURIComponent(openingId)}`,
        { headers: getAuthHeaders(false) }
      );

      if (!res.ok) {
        throw new Error('Failed to load eligible scholars for opening');
      }

      const data = await res.json();
      const scholars = Array.isArray(data?.scholars) ? data.scholars : [];
      const opening = data?.opening || null;

      const filteredScholars = filterScholarsByOpening(
        scholars,
        openingId || opening?.opening_id
      );

      setEligiblePayload({ opening, scholars: filteredScholars });

      setForm((prev) => ({
        ...prev,
        semester: opening?.semester || '',
        academic_year_id: opening?.academic_year_id || '',
        school_year: opening?.academic_year || '',
        payout_title: opening?.opening_title || '',
        amount_per_scholar:
          opening?.amount_per_scholar ??
          opening?.per_scholar_amount ??
          '',
        scholar_ids: filteredScholars.map((s) => s.scholar_id),
      }));
    } catch (err) {
      console.error('OPENING ELIGIBILITY LOAD ERROR:', err);
      setEligiblePayload({ opening: null, scholars: [] });
    }
  };

  const activeBatches = useMemo(
    () => batches.filter((b) => !b.is_archived),
    [batches]
  );

  const archivedBatches = useMemo(
    () => batches.filter((b) => b.is_archived),
    [batches]
  );

  const inProgressBatches = useMemo(
    () => activeBatches.filter((b) => !isBatchFinished(b)),
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
    inProgressBatches,
    statusManagerBatches,
    completedBatches,
    archivedBatches,
  ]);

  const filteredDisplayedBatches = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return displayedBatches;

    return displayedBatches.filter((b) => {
      return [
        b.payout_title,
        b.program_name,
        b.benefactor_name,
        b.semester,
        b.school_year,
        b.academic_year,
        b.payout_date,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    });
  }, [displayedBatches, search]);

  const pageData = useMemo(() => {
    return filteredDisplayedBatches.slice(
      (page - 1) * PAGE_SIZE,
      page * PAGE_SIZE
    );
  }, [filteredDisplayedBatches, page]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredDisplayedBatches.length / PAGE_SIZE));
  }, [filteredDisplayedBatches.length]);

  const selectedOpeningDetails = useMemo(() => {
    return (
      openings.find((o) => o.opening_id === form.opening_id) ||
      eligiblePayload.opening ||
      null
    );
  }, [openings, form.opening_id, eligiblePayload.opening]);

  const filteredEligibleScholars = useMemo(() => {
    return filterScholarsByOpening(
      eligiblePayload.scholars,
      form.opening_id || selectedOpeningDetails?.opening_id
    );
  }, [eligiblePayload.scholars, form.opening_id, selectedOpeningDetails]);

  const filteredSelectedBatchScholars = useMemo(() => {
    if (!selectedBatch) return [];
    return selectedBatch.scholars || [];
  }, [selectedBatch]);

  const sectionMeta = useMemo(() => {
    const map = {
      batches: {
        title: 'Active Payout Batches',
        subtitle: `${inProgressBatches.length} active batch${inProgressBatches.length !== 1 ? 'es' : ''} still being processed`,
        empty: 'No active payout batches found.',
      },
      status: {
        title: 'Payout Status Manager',
        subtitle: `${statusManagerBatches.length} batch${statusManagerBatches.length !== 1 ? 'es' : ''} with Pending or On Hold scholars`,
        empty: 'No payout batches currently need status updates.',
      },
      completed: {
        title: 'Completed Payouts',
        subtitle: `${completedBatches.length} completed payout batch${completedBatches.length !== 1 ? 'es' : ''}`,
        empty: 'No completed payout batches yet.',
      },
      archived: {
        title: 'Archived Payout Batches',
        subtitle: `${archivedBatches.length} archived payout batch${archivedBatches.length !== 1 ? 'es' : ''}`,
        empty: 'No archived payout batches found.',
      },
    };

    return map[activeSection] || map.batches;
  }, [
    activeSection,
    inProgressBatches.length,
    statusManagerBatches.length,
    completedBatches.length,
    archivedBatches.length,
  ]);

  const toggleScholar = (scholarId) => {
    setForm((prev) => {
      const exists = prev.scholar_ids.includes(scholarId);

      return {
        ...prev,
        scholar_ids: exists
          ? prev.scholar_ids.filter((id) => id !== scholarId)
          : [...prev.scholar_ids, scholarId],
      };
    });
  };

  const resetCreateForm = () => {
    setForm({
      ...EMPTY_FORM,
      payout_date: new Date().toISOString().slice(0, 10),
    });
    setEligiblePayload({ opening: null, scholars: [] });
  };

  const handleCreatePayoutAnnouncementRedirect = () => {
    if (!newPayoutForPrompt) return;

    const amountPerScholar = Number(newPayoutForPrompt.amount_per_scholar || 0);
    const payoutDate =
      newPayoutForPrompt.payout_date || new Date().toISOString().slice(0, 10);

    const openingTitle =
      newPayoutForPrompt.opening_title ||
      newPayoutForPrompt.payout_title ||
      'your scholarship opening';

    const title = `${newPayoutForPrompt.payout_title || 'Scholarship Payout'} Announcement`;

    const content = [
      'Good day, scholars.',
      '',
      `Please be informed that the payout batch for ${openingTitle} has been created.`,
      '',
      `Payout Date: ${payoutDate}`,
      `Payment Mode: ${newPayoutForPrompt.payment_mode || 'Cash'}`,
      amountPerScholar > 0
        ? `Amount per Scholar: ${formatMoney(amountPerScholar)}`
        : '',
      newPayoutForPrompt.scholar_count
        ? `Number of Scholars Included: ${newPayoutForPrompt.scholar_count}`
        : '',
      '',
      'Please wait for further instructions from OSFA regarding the release process.',
    ]
      .filter((line) => line !== '')
      .join('\n');

    const params = new URLSearchParams({
      prefill: 'payout',
      title,
      subject: title,
      content,
      audience: 'scholars',
      target_audience: 'scholars',
      opening_id: newPayoutForPrompt.opening_id || '',
      payout_batch_id: newPayoutForPrompt.payout_batch_id || '',
      program_id: newPayoutForPrompt.program_id || '',
      academic_year_id: newPayoutForPrompt.academic_year_id || '',
      academic_year: newPayoutForPrompt.academic_year || '',
      semester: newPayoutForPrompt.semester || '',
    });

    navigate(`/admin/announcements?${params.toString()}`);
  };

  const handleCreateBatch = async () => {
    try {
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

      setCreating(true);

      const payload = {
        opening_id: form.opening_id,
        semester: form.semester,
        academic_year_id: form.academic_year_id,
        payout_title: form.payout_title,
        payout_date: form.payout_date,
        payment_mode: form.payment_mode,
        remarks: form.remarks,
        scholar_ids: form.scholar_ids,
      };

      const res = await fetch(`${API_BASE}/payouts`, {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Failed to create payout batch');
      }

      const createdBatch = data?.data || data || {};

      const payoutForPrompt = {
        ...createdBatch,
        payout_batch_id:
          createdBatch.payout_batch_id ||
          createdBatch.batch_id ||
          createdBatch.id ||
          '',
        opening_id: form.opening_id,
        opening_title:
          selectedOpeningDetails?.opening_title ||
          selectedOpeningDetails?.title ||
          form.payout_title,
        program_id: selectedOpeningDetails?.program_id || createdBatch.program_id || '',
        program_name:
          selectedOpeningDetails?.program_name ||
          createdBatch.program_name ||
          '',
        benefactor_name:
          selectedOpeningDetails?.benefactor_name ||
          createdBatch.benefactor_name ||
          '',
        academic_year_id:
          form.academic_year_id ||
          selectedOpeningDetails?.academic_year_id ||
          createdBatch.academic_year_id ||
          '',
        academic_year:
          form.school_year ||
          selectedOpeningDetails?.academic_year ||
          createdBatch.academic_year ||
          '',
        semester: form.semester,
        payout_title: form.payout_title,
        payout_date: form.payout_date,
        payment_mode: form.payment_mode,
        amount_per_scholar: form.amount_per_scholar,
        scholar_count: form.scholar_ids.length,
      };

      setShowCreateModal(false);
      setNewPayoutForPrompt(payoutForPrompt);
      setPostCreateOpen(true);

      resetCreateForm();

      await loadAll();
      setActiveSection('batches');
    } catch (err) {
      console.error('CREATE PAYOUT BATCH ERROR:', err);
      alert(err.message || 'Failed to create payout batch');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdate = async (entry, nextStatus) => {
    const entryId = getEntryId(entry);

    if (!entryId) {
      alert('Missing payout entry ID.');
      return;
    }

    const finalStatus = normalizeReleaseStatus(nextStatus);

    try {
      setWorkingEntryId(entryId);

      const res = await fetch(`${API_BASE}/payouts/entries/${entryId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          release_status: finalStatus,
          status: finalStatus,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.message ||
          data?.error ||
          'Failed to update payout status'
        );
      }

      setSelectedBatch((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          scholars: (prev.scholars || []).map((scholar) => {
            const scholarEntryId = getEntryId(scholar);

            return String(scholarEntryId) === String(entryId)
              ? { ...scholar, release_status: finalStatus }
              : scholar;
          }),
        };
      });

      await loadAll();
    } catch (err) {
      console.error('UPDATE PAYOUT STATUS ERROR:', err);
      alert(err.message || 'Failed to update payout status');
    } finally {
      setWorkingEntryId(null);
    }
  };

  const handleArchiveBatch = async (batch) => {
    try {
      if (!batch?.payout_batch_id) return;

      if (!isBatchFinished(batch)) {
        alert(
          'This payout batch cannot be archived yet. All scholars must be marked Released, Absent, or Cancelled first.'
        );
        return;
      }

      setArchivingBatchId(batch.payout_batch_id);

      const res = await fetch(`${API_BASE}/payouts/${batch.payout_batch_id}/archive`, {
        method: 'PATCH',
        headers: getAuthHeaders(true),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Failed to archive payout batch');
      }

      await loadAll();
      setSelectedBatch(null);
      setActiveSection('archived');
    } catch (err) {
      console.error('ARCHIVE PAYOUT BATCH ERROR:', err);
      alert(err.message || 'Failed to archive payout batch');
    } finally {
      setArchivingBatchId(null);
    }
  };

  const handleRestoreBatch = async (batch) => {
    try {
      if (!batch?.payout_batch_id) return;

      setRestoringBatchId(batch.payout_batch_id);

      const res = await fetch(`${API_BASE}/payouts/${batch.payout_batch_id}/restore`, {
        method: 'PATCH',
        headers: getAuthHeaders(true),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Failed to restore payout batch');
      }

      await loadAll();
      setSelectedBatch(null);
      setActiveSection('batches');
    } catch (err) {
      console.error('RESTORE PAYOUT BATCH ERROR:', err);
      alert(err.message || 'Failed to restore payout batch');
    } finally {
      setRestoringBatchId(null);
    }
  };

  const renderStatusBadge = (status) => {
    const value = normalizeReleaseStatus(status);

    const styles = {
      Released: {
        bg: C.greenSoft,
        color: C.green,
        icon: <CheckCircle2 className="mr-1 h-3 w-3" />,
      },
      Pending: {
        bg: C.orangeSoft,
        color: C.orange,
        icon: <Clock3 className="mr-1 h-3 w-3" />,
      },
      Absent: {
        bg: C.redSoft,
        color: C.red,
        icon: <XCircle className="mr-1 h-3 w-3" />,
      },
      'On Hold': {
        bg: C.blueSoft,
        color: C.blue,
        icon: <CircleSlash className="mr-1 h-3 w-3" />,
      },
      Cancelled: {
        bg: C.slateSoft,
        color: C.slate,
        icon: <XCircle className="mr-1 h-3 w-3" />,
      },
    };

    const current = styles[value] || styles.Pending;

    return (
      <Badge
        className="inline-flex items-center rounded-full border-none text-[10px]"
        style={{ background: current.bg, color: current.color }}
      >
        {current.icon}
        {value}
      </Badge>
    );
  };

  const getStatusActions = (status) => {
    const value = normalizeReleaseStatus(status);

    if (value === 'Released') {
      return [];
    }

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

    if (value === 'Cancelled') {
      return [];
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
      amber: 'border-orange-200 text-orange-700 hover:bg-orange-50',
      slate: 'border-slate-200 text-slate-700 hover:bg-slate-50',
    };

    return map[tone] || 'border-stone-200 text-stone-700 hover:bg-stone-50';
  };

  const renderBatchCard = (b) => {
    const counts = getPayoutCounts(b);
    const finished = isBatchFinished(b);
    const manageable = hasManageablePayoutEntries(b);

    return (
      <Card
        key={b.payout_batch_id}
        className="rounded-2xl border-stone-200 bg-white shadow-none transition hover:border-stone-300"
      >
        <CardContent className="p-4">
          <div className="flex h-full flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-stone-900">
                  {b.payout_title || 'Untitled Payout Batch'}
                </h3>

                <p className="mt-1 text-sm text-stone-500">
                  {b.program_name || 'No Program'}
                  {b.benefactor_name ? ` • ${b.benefactor_name}` : ''}
                </p>

                <p className="mt-1 text-xs text-stone-400">
                  {b.school_year || b.academic_year || '—'} • {b.payout_date || '—'}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <Badge
                  className="rounded-full border-none text-[10px]"
                  style={{
                    background: b.payment_mode === 'Cash' ? C.greenSoft : C.blueSoft,
                    color: b.payment_mode === 'Cash' ? C.green : C.blue,
                  }}
                >
                  {b.payment_mode || '—'}
                </Badge>

                {b.is_archived ? (
                  <Badge
                    className="rounded-full border-none text-[10px]"
                    style={{ background: C.slateSoft, color: C.slate }}
                  >
                    Archived
                  </Badge>
                ) : finished ? (
                  <Badge
                    className="rounded-full border-none text-[10px]"
                    style={{ background: C.greenSoft, color: C.green }}
                  >
                    Completed
                  </Badge>
                ) : manageable ? (
                  <Badge
                    className="rounded-full border-none text-[10px]"
                    style={{ background: C.orangeSoft, color: C.orange }}
                  >
                    Needs Update
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SmallMetric label="Released" value={counts.released} />
              <SmallMetric label="Pending" value={counts.pending} />
              <SmallMetric label="Absent" value={counts.absent} />
              <SmallMetric label="On Hold" value={counts.onHold} />
            </div>

            <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
              <span>Total scholars</span>
              <span className="font-semibold text-stone-900">{counts.total}</span>
            </div>

            <div className="flex items-center justify-between border-t border-stone-100 pt-3">
              <div>
                <p className="text-xs text-stone-500">Total Amount</p>
                <p className="text-base font-semibold text-stone-900">
                  {formatMoney(b.total_amount)}
                </p>
              </div>

              <Button
                size="sm"
                className="h-8 rounded-lg px-3 text-xs"
                style={{ background: C.brownMid, color: '#fff' }}
                onClick={() => setSelectedBatch(b)}
              >
                <Eye className="mr-1.5 h-3.5 w-3.5" />
                View Batch
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader2 className="animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-3" style={{ background: C.bg }}>
      <PostPayoutCreatePrompt
        open={postCreateOpen}
        payout={newPayoutForPrompt}
        onClose={() => {
          setPostCreateOpen(false);
          setNewPayoutForPrompt(null);
        }}
        onCreateAnnouncement={handleCreatePayoutAnnouncementRedirect}
      />

      <section
        className="rounded-2xl border bg-white p-3 sm:p-4"
        style={{ borderColor: C.line }}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-full flex-wrap rounded-xl bg-stone-100 p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveSection('batches')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeSection === 'batches'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600'
                }`}
            >
              Active
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('status')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeSection === 'status'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600'
                }`}
            >
              Status Manager
              {statusManagerBatches.length ? (
                <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {statusManagerBatches.length}
                </span>
              ) : null}
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('completed')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeSection === 'completed'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600'
                }`}
            >
              Completed
            </button>

            <button
              type="button"
              onClick={() => setActiveSection('archived')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${activeSection === 'archived'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600'
                }`}
            >
              Archived
            </button>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative w-full lg:w-[320px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                className="h-10 rounded-xl border-stone-200 bg-stone-50 pl-10"
                placeholder="Search payout title, benefactor, program..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
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
        <div className="border-b border-stone-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-stone-800">
            {sectionMeta.title}
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            {sectionMeta.subtitle}
          </p>
        </div>

        <CardContent className="p-4">
          {pageData.length === 0 ? (
            <div className="py-16 text-center text-sm text-stone-400">
              {sectionMeta.empty}
            </div>
          ) : (
            <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
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
        onPrev={() => setPage((prev) => Math.max(1, prev - 1))}
        onNext={() => setPage((prev) => Math.min(totalPages, prev + 1))}
      />

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl border bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-stone-900">
                  Create Payout Batch
                </h2>
                <p className="text-sm text-stone-500">
                  Select an opening. The system will auto-fill amount and eligible scholars.
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

            <div className="space-y-6 p-6">
              <div className="grid gap-6 lg:grid-cols-2">
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
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            opening_id: e.target.value,
                          }))
                        }
                      >
                        <option value="">Select opening</option>
                        {openings.map((o) => (
                          <option key={o.opening_id} value={o.opening_id}>
                            {o.opening_title} — {o.benefactor_name || 'No Benefactor'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <ReadOnlyField
                        label="Program"
                        value={selectedOpeningDetails?.program_name || '—'}
                      />
                      <ReadOnlyField
                        label="Benefactor"
                        value={selectedOpeningDetails?.benefactor_name || '—'}
                      />
                      <ReadOnlyField
                        label="Opening Status"
                        value={
                          selectedOpeningDetails?.status ||
                          selectedOpeningDetails?.posting_status ||
                          '—'
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

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Semester</label>
                        <select
                          className="h-11 w-full rounded-md border px-3"
                          value={form.semester}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              semester: e.target.value,
                            }))
                          }
                        >
                          <option value="">Select semester</option>
                          <option value="First Semester">First Semester</option>
                          <option value="Second Semester">Second Semester</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium">School Year</label>
                        <select
                          className="h-11 w-full rounded-md border px-3"
                          value={form.academic_year_id}
                          onChange={(e) => {
                            const selectedId = e.target.value;
                            const selectedYear = academicYears.find(
                              (ay) => ay.academic_year_id === selectedId
                            );

                            setForm((prev) => ({
                              ...prev,
                              academic_year_id: selectedId,
                              school_year: selectedYear?.label || '',
                            }));
                          }}
                        >
                          <option value="">Select school year</option>
                          {academicYears.map((ay) => (
                            <option
                              key={ay.academic_year_id}
                              value={ay.academic_year_id}
                            >
                              {ay.label}
                              {ay.is_active ? ' (Active)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="text-sm font-medium">Payout Title</label>
                        <Input
                          value={form.payout_title}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              payout_title: e.target.value,
                            }))
                          }
                          placeholder="Example: Kaizen First Semester Payout"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium">Payout Date</label>
                        <Input
                          type="date"
                          value={form.payout_date}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              payout_date: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium">Payment Mode</label>
                        <select
                          className="h-11 w-full rounded-md border px-3"
                          value={form.payment_mode}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              payment_mode: e.target.value,
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
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            remarks: e.target.value,
                          }))
                        }
                        placeholder="Optional notes for the payout batch"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-stone-200 shadow-none">
                <CardContent className="space-y-4 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-stone-500" />
                      <div>
                        <h3 className="font-semibold text-stone-900">
                          Eligible Scholars
                        </h3>
                        <p className="text-sm text-stone-500">
                          Auto-loaded from the selected opening. All are preselected by default.
                        </p>
                      </div>
                    </div>

                    <Badge variant="outline">{form.scholar_ids.length} selected</Badge>
                  </div>

                  <div className="max-h-[320px] overflow-auto rounded-xl border">
                    {filteredEligibleScholars.length === 0 ? (
                      <div className="p-6 text-sm text-stone-400">
                        Select an opening to load eligible scholars.
                      </div>
                    ) : (
                      filteredEligibleScholars.map((s) => {
                        const checked = form.scholar_ids.includes(s.scholar_id);

                        return (
                          <label
                            key={s.scholar_id}
                            className="flex cursor-pointer items-center justify-between gap-3 border-b p-4 hover:bg-stone-50"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleScholar(s.scholar_id)}
                              />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-stone-900">
                                  {s.student_name}
                                </p>
                                <p className="text-xs text-stone-500">
                                  {s.pdm_id || '—'} • Batch {s.batch_year || '—'}
                                </p>
                              </div>
                            </div>

                            <Badge variant="outline">{s.status}</Badge>
                          </label>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl border bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-stone-900">
                  {selectedBatch.payout_title || 'Payout Batch'}
                </h2>
                <p className="text-sm text-stone-500">
                  {selectedBatch.program_name || 'No Program'} •{' '}
                  {selectedBatch.benefactor_name || 'No Benefactor'} •{' '}
                  {selectedBatch.payout_date || '—'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!selectedBatch.is_archived ? (
                  <Button
                    variant="outline"
                    className="rounded-xl border-stone-300"
                    disabled={
                      !isBatchFinished(selectedBatch) ||
                      archivingBatchId === selectedBatch.payout_batch_id
                    }
                    onClick={() => handleArchiveBatch(selectedBatch)}
                  >
                    {archivingBatchId === selectedBatch.payout_batch_id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Archive className="mr-2 h-4 w-4" />
                    )}
                    Archive Batch
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="rounded-xl border-stone-300"
                    disabled={restoringBatchId === selectedBatch.payout_batch_id}
                    onClick={() => handleRestoreBatch(selectedBatch)}
                  >
                    {restoringBatchId === selectedBatch.payout_batch_id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArchiveRestore className="mr-2 h-4 w-4" />
                    )}
                    Unarchive Batch
                  </Button>
                )}

                <Button
                  variant="outline"
                  onClick={() => setSelectedBatch(null)}
                  className="rounded-xl"
                >
                  Close
                </Button>
              </div>
            </div>

            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {(() => {
                  const counts = getPayoutCounts(selectedBatch);

                  return (
                    <>
                      <SmallMetric label="Released" value={counts.released} />
                      <SmallMetric label="Pending" value={counts.pending} />
                      <SmallMetric label="Absent" value={counts.absent} />
                      <SmallMetric label="On Hold" value={counts.onHold} />
                      <SmallMetric label="Cancelled" value={counts.cancelled} />
                    </>
                  );
                })()}
              </div>

              {filteredSelectedBatchScholars.length === 0 ? (
                <Card className="border-stone-200 shadow-none">
                  <CardContent className="p-6 text-sm text-stone-400">
                    No scholars found in this payout batch for the selected opening.
                  </CardContent>
                </Card>
              ) : (
                filteredSelectedBatchScholars.map((entry) => {
                  const entryId = getEntryId(entry);
                  const status = normalizeReleaseStatus(entry.release_status);
                  const actions = getStatusActions(status);
                  const isWorking = String(workingEntryId) === String(entryId);
                  const isLocked = selectedBatch?.is_archived === true;

                  return (
                    <Card
                      key={entryId || entry.scholar_id || entry.student_id}
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
                            {entry.pdm_id || '—'} • {formatMoney(entry.amount_received)}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-2">
                            {entry.payment_mode ? (
                              <Badge variant="outline">{entry.payment_mode}</Badge>
                            ) : null}
                            {entry.check_number ? (
                              <Badge variant="outline">
                                Check #{entry.check_number}
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          {status === 'Released' ? (
                            <span className="text-xs font-medium text-stone-500">
                              Status already marked as Released
                            </span>
                          ) : status === 'Cancelled' ? (
                            <span className="text-xs font-medium text-stone-500">
                              Status already marked as Cancelled
                            </span>
                          ) : isLocked ? (
                            <span className="text-xs font-medium text-stone-500">
                              Archived batch cannot be edited
                            </span>
                          ) : (
                            actions.map((action) => (
                              <Button
                                key={`${entryId}-${action.status}`}
                                size="sm"
                                variant="outline"
                                className={`h-8 rounded-lg text-xs ${getActionButtonClass(action.tone)}`}
                                disabled={isWorking}
                                onClick={() => handleStatusUpdate(entry, action.status)}
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