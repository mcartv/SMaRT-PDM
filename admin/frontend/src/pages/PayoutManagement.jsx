import React, { useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useSocketEvent } from '@/hooks/useSocket';
import {
  Loader2,
  Plus,
  CalendarDays,
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

function getAuthHeaders(json = true) {
  const token = localStorage.getItem('adminToken');
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  };
}

function normalizeId(value) {
  return value == null ? '' : String(value).trim();
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

function isBatchFinished(batch) {
  const scholars = getBatchScholars(batch);
  if (!scholars.length) return false;

  return scholars.every((s) => s.release_status && s.release_status !== 'Pending');
}

function SmallMetric({ label, value }) {
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-stone-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="rounded-xl border bg-stone-50 p-3">
      <p className="text-[11px] text-stone-500">{label}</p>
      <p className="text-sm font-semibold mt-1">{value || '—'}</p>
    </div>
  );
}

export default function PayoutManagement() {
  const [batches, setBatches] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [eligiblePayload, setEligiblePayload] = useState({ opening: null, scholars: [] });

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [workingEntryId, setWorkingEntryId] = useState(null);
  const [archivingBatchId, setArchivingBatchId] = useState(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('batches');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [academicYears, setAcademicYears] = useState([]);

  const [form, setForm] = useState({
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
  });

  useEffect(() => {
    loadAll();
  }, []);

  // Realtime updates for payouts
  useSocketEvent('payout:created', (data) => {
    console.log('[Realtime] Payout created:', data);
    loadAll();
  }, []);

  useSocketEvent('payout:updated', (data) => {
    console.log('[Realtime] Payout updated:', data);
    loadAll();
  }, []);

  useSocketEvent('payout:deleted', (data) => {
    console.log('[Realtime] Payout deleted:', data);
    loadAll();
  }, []);

  useSocketEvent('scholar:released', (data) => {
    console.log('[Realtime] Scholar released:', data);
    loadAll();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeSection, search]);

  useEffect(() => {
    if (!form.opening_id) {
      setEligiblePayload({ opening: null, scholars: [] });
      setForm(prev => ({
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
          (o) => !o.is_archived && String(o.status || '').toLowerCase() !== 'archived'
        )
      );
      setAcademicYears(Array.isArray(academicYearData) ? academicYearData : []);
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

      if (!res.ok) throw new Error('Failed to load eligible scholars for opening');

      const data = await res.json();
      const scholars = Array.isArray(data?.scholars) ? data.scholars : [];
      const opening = data?.opening || null;

      const filteredScholars = filterScholarsByOpening(
        scholars,
        openingId || opening?.opening_id
      );

      setEligiblePayload({ opening, scholars: filteredScholars });

      setForm(prev => ({
        ...prev,
        semester: opening?.semester || '',
        academic_year_id: opening?.academic_year_id || '',
        school_year: opening?.academic_year || '',
        payout_title: opening?.opening_title || '',
        amount_per_scholar: opening?.amount_per_scholar ?? '',
        scholar_ids: filteredScholars.map(s => s.scholar_id),
      }));
    } catch (err) {
      console.error('OPENING ELIGIBILITY LOAD ERROR:', err);
      setEligiblePayload({ opening: null, scholars: [] });
    }
  };

  const activeBatches = useMemo(() => batches.filter((b) => !b.is_archived), [batches]);
  const archivedBatches = useMemo(() => batches.filter((b) => b.is_archived), [batches]);

  const displayedBatches = useMemo(() => {
    if (activeSection === 'batches') return activeBatches;
    if (activeSection === 'archived') return archivedBatches;
    return [];
  }, [activeSection, activeBatches, archivedBatches]);

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
        b.payout_date,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(q));
    });
  }, [displayedBatches, search]);

  const pageData = useMemo(() => {
    return filteredDisplayedBatches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredDisplayedBatches, page]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredDisplayedBatches.length / PAGE_SIZE));
  }, [filteredDisplayedBatches.length]);

  const totalDisbursed = useMemo(() => {
    return batches.reduce((acc, b) => acc + Number(b.total_amount || 0), 0);
  }, [batches]);

  const totalPending = useMemo(() => {
    return batches.reduce((acc, b) => {
      const scholars = Array.isArray(b.scholars) ? b.scholars : [];
      return acc + scholars.filter(s => s.release_status === 'Pending').length;
    }, 0);
  }, [batches]);

  const totalReleased = useMemo(() => {
    return batches.reduce((acc, b) => {
      const scholars = Array.isArray(b.scholars) ? b.scholars : [];
      return acc + scholars.filter(s => s.release_status === 'Released').length;
    }, 0);
  }, [batches]);

  const totalArchived = useMemo(() => archivedBatches.length, [archivedBatches]);

  const selectedOpeningDetails = useMemo(() => {
    return openings.find(o => o.opening_id === form.opening_id) || eligiblePayload.opening || null;
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

  const toggleScholar = (scholarId) => {
    setForm(prev => {
      const exists = prev.scholar_ids.includes(scholarId);
      return {
        ...prev,
        scholar_ids: exists
          ? prev.scholar_ids.filter(id => id !== scholarId)
          : [...prev.scholar_ids, scholarId],
      };
    });
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

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || 'Failed to create payout batch');
      }

      setShowCreateModal(false);
      setForm({
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
      });
      setEligiblePayload({ opening: null, scholars: [] });

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
    const entryId =
      entry?.payout_entry_id ||
      entry?.payout_batch_student_id ||
      entry?.entry_id ||
      entry?.id;

    if (!entryId) {
      alert('Missing payout entry ID.');
      return;
    }

    try {
      setWorkingEntryId(entryId);

      const res = await fetch(`${API_BASE}/payouts/entries/${entryId}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          release_status: nextStatus,
          status: nextStatus,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.message || data?.error || 'Failed to update payout status');
      }

      setSelectedBatch((prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          scholars: (prev.scholars || []).map((scholar) => {
            const scholarEntryId =
              scholar?.payout_entry_id ||
              scholar?.payout_batch_student_id ||
              scholar?.entry_id ||
              scholar?.id;

            return String(scholarEntryId) === String(entryId)
              ? { ...scholar, release_status: nextStatus }
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

      const scholars = getBatchScholars(batch);
      const hasPending = scholars.some((s) => s.release_status === 'Pending');

      if (hasPending) {
        alert('This payout batch cannot be archived yet because some scholars are still pending.');
        return;
      }

      setArchivingBatchId(batch.payout_batch_id);

      const res = await fetch(
        `${API_BASE}/payouts/${batch.payout_batch_id}/archive`,
        {
          method: 'PATCH',
          headers: getAuthHeaders(true),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || 'Failed to archive payout batch');
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

  const renderStatusBadge = (status) => {
    const value = status || 'Pending';

    const styles = {
      Released: {
        bg: C.greenSoft,
        color: C.green,
        icon: <CheckCircle2 className="w-3 h-3 mr-1" />,
      },
      Pending: {
        bg: C.orangeSoft,
        color: C.orange,
        icon: <Clock3 className="w-3 h-3 mr-1" />,
      },
      Absent: {
        bg: C.redSoft,
        color: C.red,
        icon: <XCircle className="w-3 h-3 mr-1" />,
      },
      'On Hold': {
        bg: C.blueSoft,
        color: C.blue,
        icon: <CircleSlash className="w-3 h-3 mr-1" />,
      },
      Cancelled: {
        bg: C.redSoft,
        color: C.red,
        icon: <XCircle className="w-3 h-3 mr-1" />,
      },
    };

    const current = styles[value] || styles.Pending;

    return (
      <Badge
        className="text-[10px] inline-flex items-center"
        style={{ background: current.bg, color: current.color }}
      >
        {current.icon}
        {value}
      </Badge>
    );
  };

  const renderBatchCard = (b) => {
    const scholars = b.scholars || [];
    const released = scholars.filter(s => s.release_status === 'Released').length;
    const absent = scholars.filter(s => s.release_status === 'Absent').length;
    const onHold = scholars.filter(s => s.release_status === 'On Hold').length;
    const finished = isBatchFinished(b);

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
                  className="text-[10px]"
                  style={{
                    background: b.payment_mode === 'Cash' ? C.greenSoft : C.blueSoft,
                    color: b.payment_mode === 'Cash' ? C.green : C.blue,
                  }}
                >
                  {b.payment_mode || '—'}
                </Badge>

                {b.is_archived ? (
                  <Badge className="text-[10px]" style={{ background: C.slateSoft, color: C.slate }}>
                    Archived
                  </Badge>
                ) : finished ? (
                  <Badge className="text-[10px]" style={{ background: C.orangeSoft, color: C.orange }}>
                    Ready to Archive
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <SmallMetric label="Released" value={released} />
              <SmallMetric label="Absent" value={absent} />
              <SmallMetric label="On Hold" value={onHold} />
            </div>

            <div className="flex items-center justify-between border-t border-stone-100 pt-3">
              <div>
                <p className="text-xs text-stone-500">Total Amount</p>
                <p className="text-base font-semibold text-stone-900">
                  ₱{Number(b.total_amount || 0).toLocaleString()}
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
      <div className="flex items-center justify-center h-[300px]">
        <Loader2 className="animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-3" style={{ background: C.bg }}>
      <section
        className="rounded-2xl border bg-white p-3 sm:p-4"
        style={{ borderColor: C.line }}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="inline-flex w-full rounded-xl bg-stone-100 p-1 sm:w-auto">
            <button
              onClick={() => setActiveSection('batches')}
              className={`px-4 py-2 rounded-lg text-sm ${activeSection === 'batches'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600'
                }`}
            >
              Batches
            </button>

            <button
              onClick={() => setActiveSection('archived')}
              className={`px-4 py-2 rounded-lg text-sm ${activeSection === 'archived'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600'
                }`}
            >
              Archived
            </button>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            {(activeSection === 'batches' || activeSection === 'archived') && (
              <>
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
              </>
            )}

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

      {(activeSection === 'batches' || activeSection === 'archived') && (
        <>
          {pageData.length === 0 ? (
            <Card className="border-stone-200 shadow-none">
              <CardContent className="px-6 py-12 text-center text-sm text-stone-400">
                {activeSection === 'archived'
                  ? 'No archived payout batches found.'
                  : 'No payout batches found.'}
              </CardContent>
            </Card>
          ) : (
            <section className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {pageData.map(renderBatchCard)}
            </section>
          )}

          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(prev => Math.max(1, prev - 1))}
              className="rounded-xl border-stone-200"
            >
              Previous
            </Button>

            <p className="text-sm text-stone-500">
              Page {page} of {totalPages}
            </p>

            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              className="rounded-xl border-stone-200"
            >
              Next
            </Button>
          </div>
        </>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-6xl max-h-[92vh] overflow-auto rounded-2xl border bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-stone-900">Create Payout Batch</h2>
                <p className="text-sm text-stone-500">
                  Select an opening. The system will auto-fill amount and eligible scholars.
                </p>
              </div>

              <Button variant="outline" onClick={() => setShowCreateModal(false)} className="rounded-xl">
                Close
              </Button>
            </div>

            <div className="space-y-6 p-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <Card className="border-stone-200 shadow-none">
                  <CardContent className="space-y-4 p-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-stone-500" />
                      <h3 className="font-semibold text-stone-900">Opening Source</h3>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">Opening</label>
                      <select
                        className="h-11 w-full rounded-md border px-3"
                        value={form.opening_id}
                        onChange={(e) => setForm(prev => ({ ...prev, opening_id: e.target.value }))}
                      >
                        <option value="">Select opening</option>
                        {openings.map((o) => (
                          <option key={o.opening_id} value={o.opening_id}>
                            {o.opening_title} — {o.benefactor_name || 'No Benefactor'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <ReadOnlyField label="Program" value={selectedOpeningDetails?.program_name || '—'} />
                      <ReadOnlyField label="Benefactor" value={selectedOpeningDetails?.benefactor_name || '—'} />
                      <ReadOnlyField label="Opening Status" value={selectedOpeningDetails?.status || '—'} />
                      <ReadOnlyField
                        label="Amount per Scholar"
                        value={
                          form.amount_per_scholar !== ''
                            ? `₱${Number(form.amount_per_scholar || 0).toLocaleString()}`
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
                      <h3 className="font-semibold text-stone-900">Batch Details</h3>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Semester</label>
                        <select
                          className="h-11 w-full rounded-md border px-3"
                          value={form.semester}
                          onChange={(e) => setForm(prev => ({ ...prev, semester: e.target.value }))}
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

                            setForm(prev => ({
                              ...prev,
                              academic_year_id: selectedId,
                              school_year: selectedYear?.label || '',
                            }));
                          }}
                        >
                          <option value="">Select school year</option>
                          {academicYears.map((ay) => (
                            <option key={ay.academic_year_id} value={ay.academic_year_id}>
                              {ay.label}{ay.is_active ? ' (Active)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1 md:col-span-2">
                        <label className="text-sm font-medium">Payout Title</label>
                        <Input
                          value={form.payout_title}
                          onChange={(e) => setForm(prev => ({ ...prev, payout_title: e.target.value }))}
                          placeholder="Example: Kaizen First Semester Payout"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium">Payout Date</label>
                        <Input
                          type="date"
                          value={form.payout_date}
                          onChange={(e) => setForm(prev => ({ ...prev, payout_date: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-sm font-medium">Payment Mode</label>
                        <select
                          className="h-11 w-full rounded-md border px-3"
                          value={form.payment_mode}
                          onChange={(e) => setForm(prev => ({ ...prev, payment_mode: e.target.value }))}
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
                        onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                        placeholder="Optional notes for the payout batch"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-stone-200 shadow-none">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-stone-500" />
                      <div>
                        <h3 className="font-semibold text-stone-900">Eligible Scholars</h3>
                        <p className="text-sm text-stone-500">
                          Auto-loaded from the selected opening. All are preselected by default.
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
                                <p className="truncate text-sm font-medium text-stone-900">{s.student_name}</p>
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
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  style={{ background: C.brownMid }}
                  className="text-white rounded-xl"
                  disabled={creating}
                  onClick={handleCreateBatch}
                >
                  {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Save Payout Batch
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-auto rounded-2xl border bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-stone-900">
                  {selectedBatch.payout_title || 'Payout Batch'}
                </h2>
                <p className="text-sm text-stone-500">
                  {selectedBatch.program_name || 'No Program'} • {selectedBatch.benefactor_name || 'No Benefactor'} • {selectedBatch.payout_date || '—'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!selectedBatch.is_archived && (
                  <Button
                    variant="outline"
                    className="border-stone-300 rounded-xl"
                    disabled={!isBatchFinished(selectedBatch) || archivingBatchId === selectedBatch.payout_batch_id}
                    onClick={() => handleArchiveBatch(selectedBatch)}
                  >
                    {archivingBatchId === selectedBatch.payout_batch_id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Archive className="mr-2 h-4 w-4" />
                    )}
                    Archive Batch
                  </Button>
                )}

                <Button variant="outline" onClick={() => setSelectedBatch(null)} className="rounded-xl">
                  Close
                </Button>
              </div>
            </div>

            <div className="space-y-4 p-6">
              {filteredSelectedBatchScholars.length === 0 ? (
                <Card className="border-stone-200 shadow-none">
                  <CardContent className="p-6 text-sm text-stone-400">
                    No scholars found in this payout batch for the selected opening.
                  </CardContent>
                </Card>
              ) : (
                filteredSelectedBatchScholars.map((entry) => (
                  <Card key={entry.payout_entry_id} className="border-stone-200 shadow-none">
                    <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-stone-900">{entry.student_name}</h3>
                          {renderStatusBadge(entry.release_status)}
                        </div>

                        <p className="mt-1 text-xs text-stone-500">
                          {entry.pdm_id || '—'} • ₱{Number(entry.amount_received || 0).toLocaleString()}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {entry.payment_mode ? <Badge variant="outline">{entry.payment_mode}</Badge> : null}
                          {entry.check_number ? <Badge variant="outline">Check #{entry.check_number}</Badge> : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {entry.release_status === 'Pending' ? (
                          <>
                            <Button
                              size="sm"
                              style={{ background: C.green }}
                              className="text-white rounded-lg"
                              disabled={workingEntryId === entry.payout_entry_id || selectedBatch?.is_archived}
                              onClick={() => handleStatusUpdate(entry, 'Released')}
                            >
                              {workingEntryId === entry.payout_entry_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Released'
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-200 text-red-700 hover:bg-red-50 rounded-lg"
                              disabled={workingEntryId === entry.payout_entry_id || selectedBatch?.is_archived}
                              onClick={() => handleStatusUpdate(entry, 'Absent')}
                            >
                              Absent
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className="border-blue-200 text-blue-700 hover:bg-blue-50 rounded-lg"
                              disabled={workingEntryId === entry.payout_entry_id || selectedBatch?.is_archived}
                              onClick={() => handleStatusUpdate(entry, 'On Hold')}
                            >
                              On Hold
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs font-medium text-stone-500">
                            Status already marked as {entry.release_status}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}