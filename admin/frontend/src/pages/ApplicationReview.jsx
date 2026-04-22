import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useSocketEvent } from '@/hooks/useSocket';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Loader2,
  AlertCircle,
  ArrowRight,
  LayoutGrid,
  Table2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react';
import { buildApiUrl } from '@/api';

const C = {
  brownMid: '#7c4a2e',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  bg: '#f8f6f2',
  line: '#e7e5e4',
};

const PAGE_SIZE = 8;

const DEFAULT_FILTERS = {
  openingStatus: 'all',
  applicationStatus: 'all',
  documentStatus: 'all',
};

function normalizeStatus(value = '') {
  return String(value).trim().toLowerCase();
}

function formatDate(value) {
  if (!value) return 'No date';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No date';
  return d.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getStatusGroup(status = '') {
  const raw = normalizeStatus(status);

  if (['approved', 'qualified', 'accepted'].includes(raw)) return 'qualified';
  if (['rejected', 'disqualified', 'declined'].includes(raw)) return 'disqualified';
  if (['review', 'under review', 'for review', 'interview'].includes(raw)) return 'review';

  return 'pending';
}

function getDocumentGroup(status = '') {
  const raw = normalizeStatus(status);

  if (['documents ready', 'verified', 'complete'].includes(raw)) return 'ready';
  if (['missing docs', 'missing', 'incomplete'].includes(raw)) return 'missing';
  if (['under review', 'review'].includes(raw)) return 'review';

  return 'other';
}

function getOpeningGroup(status = '') {
  const raw = normalizeStatus(status);

  if (raw === 'draft') return 'draft';
  if (raw === 'closed') return 'closed';
  if (raw === 'archived') return 'archived';

  return 'open';
}

function getApplicationStatusMeta(row) {
  const group = getStatusGroup(row?.application_status || row?.status || '');

  if (group === 'qualified') {
    return { label: 'Qualified', bg: C.greenSoft, color: C.green };
  }

  if (group === 'disqualified') {
    return { label: 'Disqualified', bg: '#FEF2F2', color: '#dc2626' };
  }

  if (group === 'review') {
    return { label: 'Under Review', bg: C.blueSoft, color: C.blueMid };
  }

  return {
    label: row?.application_status || row?.status || 'Pending',
    bg: '#f5f5f4',
    color: '#57534e',
  };
}

function getDocumentStatusMeta(row) {
  const group = getDocumentGroup(row?.document_status || '');

  if (group === 'ready') {
    return { label: 'Documents Ready', bg: C.greenSoft, color: C.green };
  }

  if (group === 'missing') {
    return { label: 'Missing Docs', bg: '#FEF2F2', color: '#dc2626' };
  }

  if (group === 'review') {
    return { label: 'Under Review', bg: '#FFF7ED', color: '#d97706' };
  }

  return {
    label: row?.document_status || '—',
    bg: '#f5f5f4',
    color: '#57534e',
  };
}

function getOpeningStatusMeta(opening) {
  const group = getOpeningGroup(opening?.posting_status || opening?.status || '');

  if (group === 'archived') {
    return { label: 'Archived', bg: '#f5f5f4', color: '#78716c' };
  }

  if (group === 'closed') {
    return { label: 'Closed', bg: '#FEF2F2', color: '#dc2626' };
  }

  if (group === 'draft') {
    return { label: 'Draft', bg: '#f5f5f4', color: '#57534e' };
  }

  return { label: 'Open', bg: C.greenSoft, color: C.green };
}

function getComputedFilledSlots(opening) {
  const qualifiedCount =
    opening?.qualified_count != null ? Number(opening.qualified_count) : null;

  const storedFilledSlots =
    opening?.filled_slots != null ? Number(opening.filled_slots) : null;

  if (qualifiedCount != null && !Number.isNaN(qualifiedCount)) return qualifiedCount;
  if (storedFilledSlots != null && !Number.isNaN(storedFilledSlots)) return storedFilledSlots;

  return 0;
}

function normalizeApplicantRow(app) {
  return {
    application_id: app.application_id,
    opening_id: app.opening_id,
    applicant_name:
      app.student_name ||
      [app.first_name, app.last_name].filter(Boolean).join(' ') ||
      'Unnamed Applicant',
    pdm_id: app.pdm_id || '—',
    program_name: app.program_name || 'No Program',
    application_status: app.application_status || 'Pending',
    document_status: app.document_status || app.deficiency_status || '—',
    submitted_at: app.submission_date || null,
    opening_title: app.opening_title || 'Untitled Opening',
    academic_year: app.academic_year || '—',
  };
}

async function parseErrorResponse(res, fallbackMessage) {
  try {
    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const payload = await res.json();
      return payload?.message || payload?.error || fallbackMessage;
    }

    const text = await res.text();
    return text || fallbackMessage;
  } catch {
    return fallbackMessage;
  }
}

function StatusPill({ meta }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}

function MetricItem({ label, value }) {
  return (
    <div className="rounded-lg bg-stone-50 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-0.5 text-base font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function Toolbar({
  search,
  setSearch,
  viewType,
  setViewType,
  refreshing,
  onRefresh,
  filters,
  draftFilters,
  setDraftFilters,
  onApplyFilters,
  onClearFilters,
}) {
  const [filterOpen, setFilterOpen] = useState(false);

  const hasActiveFilters =
    filters.openingStatus !== 'all' ||
    filters.applicationStatus !== 'all' ||
    filters.documentStatus !== 'all';

  const openModal = () => {
    setDraftFilters(filters);
    setFilterOpen(true);
  };

  const apply = () => {
    onApplyFilters();
    setFilterOpen(false);
  };

  const clear = () => {
    onClearFilters();
    setFilterOpen(false);
  };

  return (
    <section
      className="rounded-2xl border bg-white p-3 sm:p-4"
      style={{ borderColor: C.line }}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative w-full xl:max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            placeholder={
              viewType === 'cards'
                ? 'Search opening, scholarship, or academic year'
                : 'Search applicant, PDM ID, scholarship, or opening'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 rounded-xl border-stone-200 bg-stone-50 pl-10 text-sm shadow-none focus-visible:ring-1"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="inline-flex w-full rounded-xl bg-stone-100 p-1 sm:w-auto">
            <button
              onClick={() => setViewType('cards')}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${viewType === 'cards'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600'
                }`}
            >
              <LayoutGrid className="h-4 w-4" />
              Cards
            </button>

            <button
              onClick={() => setViewType('table')}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${viewType === 'table'
                  ? 'bg-white text-stone-900 shadow-sm'
                  : 'text-stone-600'
                }`}
            >
              <Table2 className="h-4 w-4" />
              Registry
            </button>
          </div>

          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={openModal}
                className="h-10 rounded-xl border-stone-200 bg-white px-3 text-stone-700"
              >
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                Filters
                {hasActiveFilters ? (
                  <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                    Active
                  </span>
                ) : null}
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Filter Results</DialogTitle>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                {viewType === 'cards' ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-stone-700">
                      Opening Status
                    </label>
                    <Select
                      value={draftFilters.openingStatus}
                      onValueChange={(value) =>
                        setDraftFilters((prev) => ({ ...prev, openingStatus: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-700">
                        Application Status
                      </label>
                      <Select
                        value={draftFilters.applicationStatus}
                        onValueChange={(value) =>
                          setDraftFilters((prev) => ({ ...prev, applicationStatus: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select application status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="review">Under Review</SelectItem>
                          <SelectItem value="qualified">Qualified</SelectItem>
                          <SelectItem value="disqualified">Disqualified</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-stone-700">
                        Document Status
                      </label>
                      <Select
                        value={draftFilters.documentStatus}
                        onValueChange={(value) =>
                          setDraftFilters((prev) => ({ ...prev, documentStatus: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select document status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="ready">Documents Ready</SelectItem>
                          <SelectItem value="review">Under Review</SelectItem>
                          <SelectItem value="missing">Missing Docs</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}
              </div>

              <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={clear}
                  className="border-stone-200"
                >
                  Clear
                </Button>

                <Button
                  type="button"
                  onClick={apply}
                  className="text-white"
                  style={{ background: C.brownMid }}
                >
                  Apply
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="h-10 rounded-xl border-stone-200 bg-white px-3 text-stone-700"
          >
            {refreshing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>
    </section>
  );
}

function OpeningsGrid({ rows, countsMap, navigate }) {
  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {rows.map((opening) => {
        const statusMeta = getOpeningStatusMeta(opening);
        const allocatedSlots = Number(opening.allocated_slots || opening.slot_count || 0);
        const filledSlots = getComputedFilledSlots(opening);
        const remainingSlots = Math.max(0, allocatedSlots - filledSlots);
        const applicationCount = countsMap.get(opening.opening_id)?.applicants || 0;

        return (
          <Card
            key={opening.opening_id}
            className="rounded-2xl border-stone-200 bg-white shadow-none transition hover:border-stone-300"
          >
            <CardContent className="p-4">
              <div className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold leading-tight text-stone-900">
                      {opening.opening_title || opening.title || 'Untitled Opening'}
                    </h2>
                    <p className="mt-1 text-sm text-stone-500">
                      {opening.program_name || 'No Program'}
                      {opening.academic_year ? ` • ${opening.academic_year}` : ''}
                    </p>
                  </div>

                  <StatusPill meta={statusMeta} />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MetricItem label="Slots" value={allocatedSlots} />
                  <MetricItem label="Filled" value={filledSlots} />
                  <MetricItem label="Applicants" value={applicationCount} />
                  <MetricItem label="Remaining" value={remainingSlots} />
                </div>

                <div className="flex items-center justify-end border-t border-stone-100 pt-3">
                  <Button
                    size="sm"
                    className="h-8 rounded-lg border-none px-3 text-xs text-white"
                    style={{ background: C.brownMid }}
                    onClick={() =>
                      navigate(`/admin/openings/${opening.opening_id}/applications`)
                    }
                  >
                    View Applicants
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}

function RegistryTable({ rows, navigate }) {
  return (
    <section
      className="overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: C.line }}
    >
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 className="text-base font-semibold text-stone-900">Applicant Registry</h2>
        <p className="mt-1 text-sm text-stone-500">
          Current applicants and document status overview
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1080px]">
          <thead className="bg-stone-50">
            <tr className="border-b border-stone-200">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Applicant</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">PDM ID</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Scholarship</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Opening</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Academic Year</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Submitted</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Application</th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-500">Documents</th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-stone-500">Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const appStatusMeta = getApplicationStatusMeta(row);
              const docStatusMeta = getDocumentStatusMeta(row);

              return (
                <tr
                  key={row.application_id}
                  className="border-b border-stone-100 transition hover:bg-stone-50"
                >
                  <td className="px-4 py-4 align-top">
                    <div className="max-w-[220px]">
                      <p className="text-sm font-semibold text-stone-900">
                        {row.applicant_name}
                      </p>
                    </div>
                  </td>

                  <td className="px-4 py-4 align-top whitespace-nowrap text-sm text-stone-600">
                    {row.pdm_id}
                  </td>

                  <td className="px-4 py-4 align-top text-sm font-medium text-stone-800">
                    {row.program_name}
                  </td>

                  <td className="px-4 py-4 align-top text-sm text-stone-600">
                    <div className="max-w-[220px]">{row.opening_title}</div>
                  </td>

                  <td className="px-4 py-4 align-top whitespace-nowrap text-sm text-stone-600">
                    {row.academic_year}
                  </td>

                  <td className="px-4 py-4 align-top whitespace-nowrap text-sm text-stone-500">
                    {formatDate(row.submitted_at)}
                  </td>

                  <td className="px-4 py-4 align-top">
                    <StatusPill meta={appStatusMeta} />
                  </td>

                  <td className="px-4 py-4 align-top">
                    <StatusPill meta={docStatusMeta} />
                  </td>

                  <td className="px-4 py-4 align-top text-right">
                    <Button
                      size="sm"
                      className="h-8 rounded-lg border-none px-3 text-xs text-white"
                      style={{ background: C.brownMid }}
                      onClick={() =>
                        navigate(`/admin/applications/${row.application_id}/documents`)
                      }
                    >
                      View Documents
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Pagination({ page, totalPages, totalItems, onPrev, onNext }) {
  return (
    <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-stone-500">
        Showing {totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
        {Math.min(page * PAGE_SIZE, totalItems)} of {totalItems}
      </span>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-9 w-9 rounded-xl border-stone-200 p-0"
          onClick={onPrev}
          disabled={page === 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700">
          {page} / {totalPages}
        </span>

        <Button
          size="sm"
          variant="outline"
          className="h-9 w-9 rounded-xl border-stone-200 p-0"
          onClick={onNext}
          disabled={page === totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default function ApplicationReview() {
  const navigate = useNavigate();

  const [openings, setOpenings] = useState([]);
  const [registryRows, setRegistryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [viewType, setViewType] = useState('cards');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);

  const loadData = async ({ soft = false } = {}) => {
    try {
      if (soft) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError('');
      }

      const token = localStorage.getItem('adminToken');

      const [openingsRes, applicationsRes] = await Promise.all([
        fetch(buildApiUrl('/api/program-openings/admin/applications-summary'), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(buildApiUrl('/api/applications'), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      if (!openingsRes.ok) {
        throw new Error(
          await parseErrorResponse(openingsRes, 'Failed to fetch scholarship openings')
        );
      }

      if (!applicationsRes.ok) {
        throw new Error(
          await parseErrorResponse(applicationsRes, 'Failed to fetch applications')
        );
      }

      const [openingsData, applicationsData] = await Promise.all([
        openingsRes.json(),
        applicationsRes.json(),
      ]);

      setOpenings(Array.isArray(openingsData) ? openingsData : []);
      setRegistryRows(
        Array.isArray(applicationsData)
          ? applicationsData.map(normalizeApplicantRow)
          : []
      );
    } catch (err) {
      console.error('APPLICATION REVIEW LOAD ERROR:', err);
      setError(err.message || 'Failed to load application review data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useSocketEvent('application:updated', () => loadData({ soft: true }), []);
  useSocketEvent('application:approved', () => loadData({ soft: true }), []);
  useSocketEvent('application:rejected', () => loadData({ soft: true }), []);

  useEffect(() => {
    setPage(1);
  }, [search, viewType, filters]);

  const openingCountsMap = useMemo(() => {
    const map = new Map();

    for (const row of registryRows) {
      if (!row.opening_id) continue;

      const current = map.get(row.opening_id) || { applicants: 0 };
      if (getStatusGroup(row.application_status) === 'pending' || getStatusGroup(row.application_status) === 'review') {
        current.applicants += 1;
      }
      map.set(row.opening_id, current);
    }

    return map;
  }, [registryRows]);

  const filteredOpenings = useMemo(() => {
    const q = search.trim().toLowerCase();

    return openings.filter((opening) => {
      const openingGroup = getOpeningGroup(opening?.posting_status || opening?.status || '');

      if (opening?.is_archived || openingGroup === 'closed' || openingGroup === 'archived') {
        return false;
      }

      const matchesSearch =
        !q ||
        (opening.opening_title || opening.title || '').toLowerCase().includes(q) ||
        (opening.program_name || '').toLowerCase().includes(q) ||
        (opening.academic_year || '').toLowerCase().includes(q);

      const matchesFilter =
        filters.openingStatus === 'all' || filters.openingStatus === openingGroup;

      return matchesSearch && matchesFilter;
    });
  }, [openings, search, filters]);

  const filteredRegistryRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return registryRows.filter((row) => {
      const applicationGroup = getStatusGroup(row.application_status);
      const documentGroup = getDocumentGroup(row.document_status);

      const matchesSearch =
        !q ||
        (row.applicant_name || '').toLowerCase().includes(q) ||
        (row.pdm_id || '').toLowerCase().includes(q) ||
        (row.program_name || '').toLowerCase().includes(q) ||
        (row.application_status || '').toLowerCase().includes(q) ||
        (row.document_status || '').toLowerCase().includes(q) ||
        (row.opening_title || '').toLowerCase().includes(q) ||
        (row.academic_year || '').toLowerCase().includes(q);

      const matchesApplication =
        filters.applicationStatus === 'all' ||
        filters.applicationStatus === applicationGroup;

      const matchesDocument =
        filters.documentStatus === 'all' ||
        filters.documentStatus === documentGroup;

      return matchesSearch && matchesApplication && matchesDocument;
    });
  }, [registryRows, search, filters]);

  const activeRows = viewType === 'cards' ? filteredOpenings : filteredRegistryRows;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));

  const pageData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return activeRows.slice(start, start + PAGE_SIZE);
  }, [activeRows, page]);

  const applyFilters = () => setFilters(draftFilters);
  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-stone-400" />
        <p className="text-sm text-stone-500">Loading application review data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <AlertCircle className="mx-auto mb-3 h-7 w-7 text-red-400" />
        <p className="text-sm font-semibold text-red-800">Failed to load applications</p>
        <p className="mt-1 text-sm text-red-600">{error}</p>
        <Button
          onClick={() => loadData()}
          variant="outline"
          size="sm"
          className="mt-4 border-red-200 text-red-700"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-1 py-3" style={{ background: C.bg }}>
      <Toolbar
        search={search}
        setSearch={setSearch}
        viewType={viewType}
        setViewType={setViewType}
        refreshing={refreshing}
        onRefresh={() => loadData({ soft: true })}
        filters={filters}
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
      />

      {activeRows.length === 0 ? (
        <Card className="rounded-2xl border-stone-200 shadow-none">
          <CardContent className="py-16 text-center text-sm text-stone-400">
            {viewType === 'cards'
              ? 'No scholarship openings found.'
              : 'No applicants found.'}
          </CardContent>
        </Card>
      ) : (
        <>
          {viewType === 'cards' ? (
            <OpeningsGrid
              rows={pageData}
              countsMap={openingCountsMap}
              navigate={navigate}
            />
          ) : (
            <RegistryTable rows={pageData} navigate={navigate} />
          )}

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={activeRows.length}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
          />
        </>
      )}
    </div>
  );
}