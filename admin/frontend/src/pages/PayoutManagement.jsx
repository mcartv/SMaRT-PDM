import React, { useEffect, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  GraduationCap,
  Building2
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
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
  bg: '#F9FAFB',
};

function getAuthHeaders(json = true) {
  const token = localStorage.getItem('adminToken');
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    Authorization: `Bearer ${token}`,
  };
}

export default function PayoutManagement() {
  const [batches, setBatches] = useState([]);
  const [openings, setOpenings] = useState([]);
  const [eligiblePayload, setEligiblePayload] = useState({ opening: null, scholars: [] });

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [workingEntryId, setWorkingEntryId] = useState(null);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [form, setForm] = useState({
    opening_id: '',
    semester: '',
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

  useEffect(() => {
    if (!form.opening_id) {
      setEligiblePayload({ opening: null, scholars: [] });
      setForm(prev => ({
        ...prev,
        semester: '',
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

      const [batchRes, openingRes] = await Promise.all([
        fetch(`${API_BASE}/payouts`, { headers: getAuthHeaders(false) }),
        fetch(`${API_BASE}/payouts/openings`, { headers: getAuthHeaders(false) }),
      ]);

      if (!batchRes.ok) throw new Error('Failed to load payout batches');
      if (!openingRes.ok) throw new Error('Failed to load openings');

      const batchData = await batchRes.json();
      const openingData = await openingRes.json();

      setBatches(Array.isArray(batchData) ? batchData : []);
      setOpenings(Array.isArray(openingData) ? openingData : []);
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

      setEligiblePayload({ opening, scholars });

      setForm(prev => ({
        ...prev,
        semester: opening?.semester || '',
        school_year: opening?.school_year || '',
        payout_title: opening?.opening_title || '',
        amount_per_scholar: opening?.amount_per_scholar ?? '',
        scholar_ids: scholars.map(s => s.scholar_id),
      }));
    } catch (err) {
      console.error('OPENING ELIGIBILITY LOAD ERROR:', err);
      setEligiblePayload({ opening: null, scholars: [] });
    }
  };

  const filteredBatches = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return batches;

    return batches.filter((b) => {
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
  }, [batches, search]);

  const pageData = useMemo(() => {
    return filteredBatches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [filteredBatches, page]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredBatches.length / PAGE_SIZE));
  }, [filteredBatches.length]);

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

  const selectedOpeningDetails = useMemo(() => {
    return openings.find(o => o.opening_id === form.opening_id) || eligiblePayload.opening || null;
  }, [openings, form.opening_id, eligiblePayload.opening]);

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
        school_year: form.school_year,
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
    } catch (err) {
      console.error('CREATE PAYOUT BATCH ERROR:', err);
      alert(err.message || 'Failed to create payout batch');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdate = async (entry, status) => {
    try {
      setWorkingEntryId(entry.payout_entry_id);

      const res = await fetch(
        `${API_BASE}/payouts/entries/${entry.payout_entry_id}/status`,
        {
          method: 'PATCH',
          headers: getAuthHeaders(true),
          body: JSON.stringify({ status }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || `Failed to mark as ${status}`);
      }

      await loadAll();
      setSelectedBatch(null);
    } catch (err) {
      console.error('UPDATE PAYOUT STATUS ERROR:', err);
      alert(err.message || 'Failed to update payout status');
    } finally {
      setWorkingEntryId(null);
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
    const scholars = Array.isArray(b.scholars) ? b.scholars : [];
    const released = scholars.filter(s => s.release_status === 'Released').length;
    const absent = scholars.filter(s => s.release_status === 'Absent').length;
    const onHold = scholars.filter(s => s.release_status === 'On Hold').length;

    return (
      <div
        key={b.payout_batch_id}
        className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm hover:shadow-md transition"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-stone-900 truncate">
              {b.payout_title || 'Untitled Payout Batch'}
            </h3>

            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="outline">{b.program_name || 'No Program'}</Badge>
              <Badge variant="outline">{b.benefactor_name || 'No Benefactor'}</Badge>
              <Badge variant="outline">{b.semester || 'No Semester'}</Badge>
            </div>

            <p className="text-xs text-stone-500 mt-2">
              {b.school_year || '—'} • {b.payout_date || '—'}
            </p>
          </div>

          <Badge
            className="text-[10px]"
            style={{
              background: b.payment_mode === 'Cash' ? C.greenSoft : C.blueSoft,
              color: b.payment_mode === 'Cash' ? C.green : C.blue,
            }}
          >
            {b.payment_mode || '—'}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <MiniStat label="Released" value={released} />
          <MiniStat label="Absent" value={absent} />
          <MiniStat label="On Hold" value={onHold} />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-500">Total Amount</p>
            <p className="text-base font-semibold">₱{Number(b.total_amount || 0).toLocaleString()}</p>
          </div>

          <Button
            size="sm"
            className="rounded-lg"
            onClick={() => setSelectedBatch(b)}
          >
            <Eye className="w-4 h-4 mr-1" />
            View Batch
          </Button>
        </div>
      </div>
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
    <div className="space-y-6 py-2" style={{ background: C.bg }}>
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Payout Management</h1>
          <p className="text-sm text-stone-500">
            Record, release, and track scholarship disbursement batches.
          </p>
        </div>

        <Button
          style={{ background: C.brownMid }}
          className="text-white rounded-xl"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Payout Batch
        </Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard icon={<Wallet className="w-5 h-5" />} label="Total Disbursed" value={`₱${Number(totalDisbursed).toLocaleString()}`} />
        <StatCard icon={<CalendarDays className="w-5 h-5" />} label="Batch Count" value={batches.length} />
        <StatCard icon={<Clock3 className="w-5 h-5" />} label="Pending" value={totalPending} />
        <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Released" value={totalReleased} />
      </div>

      <Card className="border-stone-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-3 text-stone-400" />
              <Input
                className="pl-9"
                placeholder="Search payout title, benefactor, program, semester..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {pageData.length === 0 ? (
          <Card className="border-stone-200 col-span-full">
            <CardContent className="p-10 text-center text-stone-400">
              No payout batches found.
            </CardContent>
          </Card>
        ) : (
          pageData.map(renderBatchCard)
        )}
      </div>

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => setPage(prev => Math.max(1, prev - 1))}
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
        >
          Next
        </Button>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[92vh] overflow-auto rounded-2xl bg-white shadow-2xl border">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-semibold">Create Payout Batch</h2>
                <p className="text-sm text-stone-500">
                  Select an opening. The system will auto-fill amount and eligible scholars.
                </p>
              </div>

              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Close
              </Button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid lg:grid-cols-2 gap-6">
                <Card className="border-stone-200">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-stone-500" />
                      <h3 className="font-semibold">Opening Source</h3>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">Opening</label>
                      <select
                        className="w-full h-11 rounded-md border px-3"
                        value={form.opening_id}
                        onChange={(e) => setForm(prev => ({ ...prev, opening_id: e.target.value }))}
                      >
                        <option value="">Select opening</option>
                        {openings.map((o) => (
                          <option key={o.opening_id} value={o.opening_id}>
                            {o.opening_title} — {o.benefactor_name || o.benefactor_name || 'No Benefactor'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <ReadOnlyField label="Program" value={selectedOpeningDetails?.program_name || '—'} />
                      <ReadOnlyField label="Benefactor" value={selectedOpeningDetails?.benefactor_name || '—'} />
                      <ReadOnlyField label="Opening Status" value={selectedOpeningDetails?.status || '—'} />
                      <ReadOnlyField label="Amount per Scholar" value={
                        form.amount_per_scholar !== ''
                          ? `₱${Number(form.amount_per_scholar || 0).toLocaleString()}`
                          : '—'
                      } />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-stone-200">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-stone-500" />
                      <h3 className="font-semibold">Batch Details</h3>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Semester</label>
                        <select
                          className="w-full h-11 rounded-md border px-3"
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
                        <Input
                          value={form.school_year}
                          onChange={(e) => setForm(prev => ({ ...prev, school_year: e.target.value }))}
                          placeholder="2025-2026"
                        />
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
                          className="w-full h-11 rounded-md border px-3"
                          value={form.payment_mode}
                          onChange={(e) => setForm(prev => ({ ...prev, payment_mode: e.target.value }))}
                        >
                          <option value="Cash">Cash</option>
                          <option value="Bank">Bank</option>
                          <option value="GCash">GCash</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-sm font-medium">Remarks</label>
                      <textarea
                        className="w-full min-h-[90px] rounded-md border p-3 text-sm"
                        value={form.remarks}
                        onChange={(e) => setForm(prev => ({ ...prev, remarks: e.target.value }))}
                        placeholder="Optional notes for the payout batch"
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="border-stone-200">
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-stone-500" />
                      <div>
                        <h3 className="font-semibold">Eligible Scholars</h3>
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
                    {eligiblePayload.scholars.length === 0 ? (
                      <div className="p-6 text-sm text-stone-400">
                        Select an opening to load eligible scholars.
                      </div>
                    ) : (
                      eligiblePayload.scholars.map((s) => {
                        const checked = form.scholar_ids.includes(s.scholar_id);

                        return (
                          <label
                            key={s.scholar_id}
                            className="flex items-center justify-between gap-3 p-4 border-b hover:bg-stone-50 cursor-pointer"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleScholar(s.scholar_id)}
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{s.student_name}</p>
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
                <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button
                  style={{ background: C.brownMid }}
                  className="text-white"
                  disabled={creating}
                  onClick={handleCreateBatch}
                >
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Save Payout Batch
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedBatch && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[92vh] overflow-auto rounded-2xl bg-white border shadow-2xl">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-semibold">
                  {selectedBatch.payout_title || 'Payout Batch'}
                </h2>
                <p className="text-sm text-stone-500">
                  {selectedBatch.program_name || 'No Program'} • {selectedBatch.benefactor_name || 'No Benefactor'} • {selectedBatch.payout_date || '—'}
                </p>
              </div>

              <Button variant="outline" onClick={() => setSelectedBatch(null)}>
                Close
              </Button>
            </div>

            <div className="p-6 space-y-4">
              {(selectedBatch.scholars || []).length === 0 ? (
                <Card className="border-stone-200">
                  <CardContent className="p-6 text-sm text-stone-400">
                    No scholars found in this payout batch.
                  </CardContent>
                </Card>
              ) : (
                selectedBatch.scholars.map((entry) => (
                  <Card key={entry.payout_entry_id} className="border-stone-200">
                    <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold">{entry.student_name}</h3>
                          {renderStatusBadge(entry.release_status)}
                        </div>

                        <p className="text-xs text-stone-500 mt-1">
                          {entry.pdm_id || '—'} • ₱{Number(entry.amount_received || 0).toLocaleString()}
                        </p>

                        <div className="mt-2 flex gap-2 flex-wrap">
                          {entry.payment_mode ? <Badge variant="outline">{entry.payment_mode}</Badge> : null}
                          {entry.check_number ? <Badge variant="outline">Check #{entry.check_number}</Badge> : null}
                        </div>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          style={{ background: C.green }}
                          className="text-white"
                          disabled={workingEntryId === entry.payout_entry_id}
                          onClick={() => handleStatusUpdate(entry, 'Released')}
                        >
                          {workingEntryId === entry.payout_entry_id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Released'}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-200 text-red-700 hover:bg-red-50"
                          disabled={workingEntryId === entry.payout_entry_id}
                          onClick={() => handleStatusUpdate(entry, 'Absent')}
                        >
                          Absent
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          className="border-blue-200 text-blue-700 hover:bg-blue-50"
                          disabled={workingEntryId === entry.payout_entry_id}
                          onClick={() => handleStatusUpdate(entry, 'On Hold')}
                        >
                          On Hold
                        </Button>
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

function StatCard({ icon, label, value }) {
  return (
    <Card className="border-stone-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="text-stone-500">{icon}</div>
        </div>
        <div className="mt-3 text-xl font-semibold">{value}</div>
        <p className="text-xs text-stone-400 mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border bg-stone-50 p-3">
      <p className="text-[11px] text-stone-500">{label}</p>
      <p className="text-sm font-semibold mt-1">{value}</p>
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