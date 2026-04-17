import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  Loader2,
  AlertCircle,
  CalendarDays,
  Users,
  CheckCircle2,
  ArrowRight,
  FolderOpen,
  LayoutGrid,
  Table2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';

const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  amberSoft: '#FFF7ED',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  text: '#1c1917',
  bg: '#faf7f2',
  muted: '#78716c',
};

const PAGE_SIZE = 8;

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

function normalizeStatus(value = '') {
  return String(value).trim().toLowerCase();
}

function isApprovedStatus(status = '') {
  return ['approved', 'qualified', 'accepted'].includes(normalizeStatus(status));
}

function isRejectedStatus(status = '') {
  return ['rejected', 'disqualified', 'declined'].includes(normalizeStatus(status));
}

function isReviewStatus(status = '') {
  return ['review', 'under review', 'for review', 'interview'].includes(normalizeStatus(status));
}

function isPendingStatus(status = '') {
  return ['pending', 'pending review', 'submitted'].includes(normalizeStatus(status));
}

function isActiveApplicantStatus(status = '') {
  const normalized = normalizeStatus(status);
  return !isApprovedStatus(normalized) && !isRejectedStatus(normalized);
}

function getComputedFilledSlots(opening) {
  const qualifiedCount =
    opening?.qualified_count !== undefined && opening?.qualified_count !== null
      ? Number(opening.qualified_count)
      : null;

  const storedFilledSlots =
    opening?.filled_slots !== undefined && opening?.filled_slots !== null
      ? Number(opening.filled_slots)
      : null;

  if (qualifiedCount !== null && !Number.isNaN(qualifiedCount)) {
    return qualifiedCount;
  }

  if (storedFilledSlots !== null && !Number.isNaN(storedFilledSlots)) {
    return storedFilledSlots;
  }

  return 0;
}

function getOpeningStatusMeta(opening) {
  const raw = normalizeStatus(opening?.posting_status || opening?.status || '');

  if (raw === 'archived') {
    return { label: 'Archived', bg: '#f5f5f4', color: '#78716c' };
  }

  if (raw === 'closed') {
    return { label: 'Closed', bg: '#FEF2F2', color: '#dc2626' };
  }

  if (raw === 'draft') {
    return { label: 'Draft', bg: '#f5f5f4', color: '#57534e' };
  }

  return { label: 'Open', bg: C.greenSoft, color: C.green };
}

function getApplicationStatusMeta(row) {
  const raw = normalizeStatus(row?.application_status || row?.status || '');

  if (isApprovedStatus(raw)) {
    return { label: 'Qualified', bg: C.greenSoft, color: C.green };
  }

  if (isRejectedStatus(raw)) {
    return { label: 'Disqualified', bg: '#FEF2F2', color: '#dc2626' };
  }

  if (isReviewStatus(raw)) {
    return { label: 'Under Review', bg: C.blueSoft, color: C.blueMid };
  }

  return {
    label: row?.application_status || row?.status || 'Pending',
    bg: '#f5f5f4',
    color: '#57534e',
  };
}

function getDocumentStatusMeta(row) {
  const raw = normalizeStatus(row?.document_status || '');

  if (['documents ready', 'verified', 'complete'].includes(raw)) {
    return { label: 'Documents Ready', bg: C.greenSoft, color: C.green };
  }

  if (['missing docs', 'missing', 'incomplete'].includes(raw)) {
    return { label: 'Missing Docs', bg: '#FEF2F2', color: '#dc2626' };
  }

  if (['under review', 'review'].includes(raw)) {
    return { label: 'Under Review', bg: '#FFF7ED', color: '#d97706' };
  }

  return {
    label: row?.document_status || '—',
    bg: '#f5f5f4',
    color: '#57534e',
  };
}

function StatusPill({ meta }) {
  return (
    <span
      className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  );
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
    semester: app.semester || '—',
    academic_year: app.academic_year || '—',
    gwa: app.gwa ?? null,
    is_disqualified: !!app.is_disqualified,
    verification_status: app.verification_status || null,
    remarks: app.remarks || null,
  };
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
        fetch('http://localhost:5000/api/program-openings/admin/applications-summary', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch('http://localhost:5000/api/applications', {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      if (!openingsRes.ok) {
        const message = await parseErrorResponse(
          openingsRes,
          'Failed to fetch scholarship openings'
        );
        throw new Error(message);
      }

      if (!applicationsRes.ok) {
        const message = await parseErrorResponse(
          applicationsRes,
          'Failed to fetch applications'
        );
        throw new Error(message);
      }

      const openingsData = await openingsRes.json();
      const applicationsData = await applicationsRes.json();

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

  useEffect(() => {
    setPage(1);
  }, [search, viewType]);

  const openingCountsMap = useMemo(() => {
    const counts = new Map();

    registryRows.forEach((row) => {
      const openingId = row.opening_id;
      if (!openingId) return;

      const current = counts.get(openingId) || {
        applicants: 0,
      };

      if (isActiveApplicantStatus(row.application_status)) {
        current.applicants += 1;
      }

      counts.set(openingId, current);
    });

    return counts;
  }, [registryRows]);

  const filteredOpenings = useMemo(() => {
    const q = search.trim().toLowerCase();

    return openings.filter((opening) => {
      const rawStatus = normalizeStatus(opening?.posting_status || opening?.status || '');

      if (opening?.is_archived) return false;
      if (rawStatus === 'closed') return false;
      if (rawStatus === 'archived') return false;

      if (!q) return true;

      const title = (opening.opening_title || opening.title || '').toLowerCase();
      const program = (opening.program_name || '').toLowerCase();
      const academicYear = (opening.academic_year || '').toLowerCase();

      return (
        title.includes(q) ||
        program.includes(q) ||
        academicYear.includes(q)
      );
    });
  }, [openings, search]);

  const filteredRegistryRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    return registryRows.filter((row) => {
      if (!q) return true;

      return (
        (row.applicant_name || '').toLowerCase().includes(q) ||
        (row.pdm_id || '').toLowerCase().includes(q) ||
        (row.program_name || '').toLowerCase().includes(q) ||
        (row.application_status || '').toLowerCase().includes(q) ||
        (row.document_status || '').toLowerCase().includes(q) ||
        (row.opening_title || '').toLowerCase().includes(q) ||
        (row.academic_year || '').toLowerCase().includes(q)
      );
    });
  }, [registryRows, search]);

  const stats = useMemo(() => {
    const totalOpenings = filteredOpenings.length;
    const openCount = filteredOpenings.filter((o) => getOpeningStatusMeta(o).label === 'Open').length;
    const totalApplicants = registryRows.filter((row) =>
      isActiveApplicantStatus(row.application_status)
    ).length;

    return [
      {
        label: 'Active Openings',
        value: totalOpenings,
        icon: FolderOpen,
        soft: C.amberSoft,
        accent: C.brown,
      },
      {
        label: 'Open Now',
        value: openCount,
        icon: CheckCircle2,
        soft: C.greenSoft,
        accent: C.green,
      },
      {
        label: 'Total Applicants',
        value: totalApplicants,
        icon: Users,
        soft: C.blueSoft,
        accent: C.blueMid,
      },
    ];
  }, [filteredOpenings, registryRows]);

  const activeRows = viewType === 'cards' ? filteredOpenings : filteredRegistryRows;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));

  const pageData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return activeRows.slice(start, start + PAGE_SIZE);
  }, [activeRows, page]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">
          Loading applications...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <AlertCircle className="w-7 h-7 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-800">Failed to load applications</p>
        <p className="text-xs text-red-600 mt-1">{error}</p>
        <Button
          onClick={() => loadData()}
          variant="outline"
          size="sm"
          className="mt-4 border-red-200 text-red-600 text-xs"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2" style={{ background: C.bg }}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>
            Applications
          </h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>
            Active scholarship openings and current applicants
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadData({ soft: true })}
          className="rounded-lg text-xs border-stone-200 text-stone-600"
        >
          {refreshing ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label} className="border-stone-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: s.soft }}
              >
                <s.icon className="w-4 h-4" style={{ color: s.accent }} />
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold" style={{ color: C.text }}>
                {s.value}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-stone-200 shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-300" />
              <Input
                placeholder={
                  viewType === 'cards'
                    ? 'Search by opening, scholarship, or academic year...'
                    : 'Search by applicant, PDM ID, scholarship, or opening...'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 text-sm bg-white rounded-lg border-stone-200"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewType('cards')}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${viewType === 'cards'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-600 border-stone-200'
                  }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cards
              </button>

              <button
                onClick={() => setViewType('table')}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${viewType === 'table'
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-600 border-stone-200'
                  }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                Registry
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {activeRows.length === 0 ? (
        <Card className="border-stone-200 shadow-none">
          <CardContent className="py-14 text-center text-sm text-stone-400">
            {viewType === 'cards'
              ? 'No scholarship openings found.'
              : 'No applicants found.'}
          </CardContent>
        </Card>
      ) : viewType === 'cards' ? (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {pageData.map((opening) => {
              const statusMeta = getOpeningStatusMeta(opening);
              const allocatedSlots = Number(opening.allocated_slots || opening.slot_count || 0);
              const filledSlots = getComputedFilledSlots(opening);
              const remainingSlots = Math.max(0, allocatedSlots - filledSlots);

              const openingCounts = openingCountsMap.get(opening.opening_id) || {
                applicants: 0,
              };

              const applicationCount = openingCounts.applicants;

              return (
                <Card
                  key={opening.opening_id}
                  className="border-stone-200 shadow-none hover:border-stone-300 transition-all"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-lg font-semibold text-stone-900 leading-tight">
                          {opening.opening_title || opening.title || 'Untitled Opening'}
                        </CardTitle>

                        <CardDescription className="mt-1.5 text-sm">
                          {opening.program_name || 'No Program'}
                          {opening.academic_year ? ` · ${opening.academic_year}` : ''}
                        </CardDescription>
                      </div>

                      <StatusPill meta={statusMeta} />
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                        <p className="text-xs text-stone-500 font-medium">Slots</p>
                        <p className="text-xl font-bold text-stone-900">{allocatedSlots}</p>
                      </div>

                      <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                        <p className="text-xs text-stone-500 font-medium">Filled</p>
                        <p className="text-xl font-bold text-stone-900">{filledSlots}</p>
                      </div>

                      <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                        <p className="text-xs text-stone-500 font-medium">Applicants</p>
                        <p className="text-xl font-bold text-stone-900">{applicationCount}</p>
                      </div>

                      <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
                        <p className="text-xs text-stone-500 font-medium">Remaining</p>
                        <p className="text-xl font-bold text-stone-900">{remainingSlots}</p>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="rounded-lg text-white text-sm font-medium border-none"
                        style={{ background: C.brownMid }}
                        onClick={() => navigate(`/admin/openings/${opening.opening_id}/applications`)}
                      >
                        View Applicants
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-1">
            <span className="text-xs text-stone-400">
              Showing {activeRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, activeRows.length)} of {activeRows.length}
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 rounded-lg border-stone-200"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>

              <span className="text-xs font-medium px-2.5 py-1 bg-white border border-stone-200 rounded-lg">
                {page} / {totalPages}
              </span>

              <Button
                size="sm"
                variant="outline"
                className="h-8 w-8 p-0 rounded-lg border-stone-200"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <Card className="border-stone-200 shadow-none overflow-hidden">
          <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-3 px-5">
            <div>
              <CardTitle className="text-sm font-semibold text-stone-800">
                Applicant Registry
              </CardTitle>
              <CardDescription className="text-xs">
                Current applicants only
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px]">
                <thead className="bg-stone-50">
                  <tr className="border-b border-stone-200">
                    <th className="text-left text-xs font-semibold text-stone-500 px-4 py-3">Applicant</th>
                    <th className="text-left text-xs font-semibold text-stone-500 px-4 py-3">PDM ID</th>
                    <th className="text-left text-xs font-semibold text-stone-500 px-4 py-3">Scholarship</th>
                    <th className="text-left text-xs font-semibold text-stone-500 px-4 py-3">Opening</th>
                    <th className="text-left text-xs font-semibold text-stone-500 px-4 py-3">Academic Year</th>
                    <th className="text-left text-xs font-semibold text-stone-500 px-4 py-3">Submitted</th>
                    <th className="text-left text-xs font-semibold text-stone-500 px-4 py-3">Application Status</th>
                    <th className="text-left text-xs font-semibold text-stone-500 px-4 py-3">Document Status</th>
                    <th className="text-right text-xs font-semibold text-stone-500 px-4 py-3">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {pageData.map((row) => {
                    const appStatusMeta = getApplicationStatusMeta(row);
                    const docStatusMeta = getDocumentStatusMeta(row);

                    return (
                      <tr
                        key={row.application_id}
                        className="border-b border-stone-100 hover:bg-stone-50/60 transition-colors"
                      >
                        <td className="px-4 py-4 align-top">
                          <div className="max-w-[220px]">
                            <p className="text-sm font-semibold text-stone-900">
                              {row.applicant_name}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top text-sm text-stone-600 whitespace-nowrap">
                          {row.pdm_id}
                        </td>

                        <td className="px-4 py-4 align-top text-sm text-stone-800 font-medium">
                          {row.program_name}
                        </td>

                        <td className="px-4 py-4 align-top text-sm text-stone-600">
                          <div className="max-w-[220px]">
                            {row.opening_title}
                          </div>
                        </td>

                        <td className="px-4 py-4 align-top text-sm text-stone-600 whitespace-nowrap">
                          {row.academic_year}
                        </td>

                        <td className="px-4 py-4 align-top text-xs text-stone-500 whitespace-nowrap">
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
                            className="rounded-lg text-white text-xs border-none"
                            style={{ background: C.brownMid }}
                            onClick={() => navigate(`/admin/applications/${row.application_id}/documents`)}
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
          </CardContent>

          <div className="px-5 py-3 bg-stone-50/50 border-t border-stone-100 flex items-center justify-between">
            <span className="text-xs text-stone-400">
              Showing {activeRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
              {Math.min(page * PAGE_SIZE, activeRows.length)} of {activeRows.length}
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 rounded-lg border-stone-200"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>

              <span className="text-xs font-medium px-2.5 py-1 bg-white border border-stone-200 rounded-lg">
                {page} / {totalPages}
              </span>

              <Button
                size="sm"
                variant="outline"
                className="h-7 w-7 p-0 rounded-lg border-stone-200"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}