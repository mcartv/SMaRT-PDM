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
  Clock3,
  ArrowRight,
  FolderOpen,
  CircleOff,
  LayoutGrid,
  Table2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  text: '#1c1917',
  bg: '#faf7f2',
  muted: '#78716c',
  border: '#e7e5e4',
};

const PAGE_SIZE = 8;
const SEEN_APPLICANTS_STORAGE_KEY = 'applicationReviewSeenApplicants';

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
  const normalized = normalizeStatus(status);
  return ['approved', 'qualified', 'accepted'].includes(normalized);
}

function isRejectedStatus(status = '') {
  const normalized = normalizeStatus(status);
  return ['rejected', 'disqualified', 'declined'].includes(normalized);
}

function isReviewStatus(status = '') {
  const normalized = normalizeStatus(status);
  return ['review', 'under review', 'for review', 'interview'].includes(normalized);
}

function isPendingStatus(status = '') {
  const normalized = normalizeStatus(status);
  return ['pending', 'pending review'].includes(normalized);
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

function getComputedRemainingSlots(opening) {
  const allocated = Number(opening?.allocated_slots || opening?.slot_count || 0);
  const filled = getComputedFilledSlots(opening);
  return Math.max(0, allocated - filled);
}

function getOpeningStatusMeta(opening) {
  const raw = normalizeStatus(opening?.posting_status || opening?.status || '');
  const remainingSlots = getComputedRemainingSlots(opening);

  if (raw === 'draft') {
    return { label: 'Draft', bg: '#f5f5f4', color: '#57534e' };
  }

  if (raw === 'archived') {
    return { label: 'Archived', bg: '#f5f5f4', color: '#78716c' };
  }

  if (raw === 'closed') {
    return { label: 'Closed', bg: C.redSoft, color: C.red };
  }

  if (raw === 'filled' || remainingSlots <= 0) {
    return { label: 'Filled', bg: C.amberSoft, color: C.amber };
  }

  return { label: 'Open', bg: C.greenSoft, color: C.green };
}

function getApplicationStatusMeta(row) {
  const raw = normalizeStatus(row?.application_status || row?.status || '');

  if (isApprovedStatus(raw)) {
    return { label: 'Qualified', bg: C.greenSoft, color: C.green };
  }

  if (isRejectedStatus(raw)) {
    return { label: 'Disqualified', bg: C.redSoft, color: C.red };
  }

  if (isReviewStatus(raw)) {
    return { label: 'Under Review', bg: C.blueSoft, color: C.blueMid };
  }

  if (['waiting', 'waitlisted'].includes(raw)) {
    return { label: 'Waiting', bg: C.amberSoft, color: C.amber };
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
    return { label: 'Missing Docs', bg: C.redSoft, color: C.red };
  }

  if (['under review', 'review'].includes(raw)) {
    return { label: 'Under Review', bg: C.amberSoft, color: C.amber };
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

function getInitialSeenApplicantsMap() {
  try {
    const raw = localStorage.getItem(SEEN_APPLICANTS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
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
  const [seenApplicantsMap, setSeenApplicantsMap] = useState(getInitialSeenApplicantsMap);

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

  useEffect(() => {
    try {
      localStorage.setItem(
        SEEN_APPLICANTS_STORAGE_KEY,
        JSON.stringify(seenApplicantsMap)
      );
    } catch {
      // ignore localStorage write errors
    }
  }, [seenApplicantsMap]);

  const openingCountsMap = useMemo(() => {
    const counts = new Map();

    registryRows.forEach((row) => {
      const openingId = row.opening_id;
      if (!openingId) return;

      const current = counts.get(openingId) || {
        applicants: 0,
        pending: 0,
        review: 0,
      };

      const status = row.application_status || '';

      if (isActiveApplicantStatus(status)) {
        current.applicants += 1;
      }

      if (isPendingStatus(status)) {
        current.pending += 1;
      }

      if (isReviewStatus(status)) {
        current.review += 1;
      }

      counts.set(openingId, current);
    });

    return counts;
  }, [registryRows]);

  const filteredOpenings = useMemo(() => {
    const q = search.trim().toLowerCase();

    return openings.filter((opening) => {
      if (!q) return true;

      const title = (opening.opening_title || opening.title || '').toLowerCase();
      const program = (opening.program_name || '').toLowerCase();
      const semester = (opening.semester || '').toLowerCase();
      const academicYear = (opening.academic_year || '').toLowerCase();
      const status = (opening.posting_status || opening.status || '').toLowerCase();

      return (
        title.includes(q) ||
        program.includes(q) ||
        semester.includes(q) ||
        academicYear.includes(q) ||
        status.includes(q)
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
        (row.semester || '').toLowerCase().includes(q) ||
        (row.academic_year || '').toLowerCase().includes(q)
      );
    });
  }, [registryRows, search]);

  const stats = useMemo(() => {
    const totalOpenings = openings.length;
    const openCount = openings.filter((o) => getOpeningStatusMeta(o).label === 'Open').length;
    const filledCount = openings.filter((o) => getOpeningStatusMeta(o).label === 'Filled').length;
    const totalApplicants = registryRows.filter((row) =>
      isActiveApplicantStatus(row.application_status)
    ).length;

    return [
      {
        label: 'Total Openings',
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
        label: 'Filled',
        value: filledCount,
        icon: CircleOff,
        soft: C.redSoft,
        accent: C.red,
      },
      {
        label: 'Total Applicants',
        value: totalApplicants,
        icon: Users,
        soft: C.blueSoft,
        accent: C.blueMid,
      },
    ];
  }, [openings, registryRows]);

  const activeRows = viewType === 'cards' ? filteredOpenings : filteredRegistryRows;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / PAGE_SIZE));

  const pageData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return activeRows.slice(start, start + PAGE_SIZE);
  }, [activeRows, page]);

  const handleOpenApplicants = (openingId, applicantCount) => {
    setSeenApplicantsMap((prev) => ({
      ...prev,
      [openingId]: applicantCount,
    }));

    navigate(`/admin/openings/${openingId}/applications`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[420px] gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-stone-300" />
        <p className="text-xs text-stone-400 uppercase tracking-widest">
          Loading application review...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-100 rounded-xl text-center">
        <AlertCircle className="w-7 h-7 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-red-800">Failed to load application review</p>
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
            Review scholarship openings or scan all applicants in the registry table
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
            <Clock3 className="mr-1.5 h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                    ? 'Search by opening, scholarship, semester, academic year, or status...'
                    : 'Search by applicant, PDM ID, scholarship, opening, semester, year, or status...'
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
                Cards View
              </button>

              <button
                onClick={() => setViewType('table')}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${viewType === 'table'
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-600 border-stone-200'
                  }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                Registry Table
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
                pending: 0,
                review: 0,
              };

              const applicationCount = openingCounts.applicants;
              const pendingCount = openingCounts.pending + openingCounts.review;

              const seenCount = Number(seenApplicantsMap[opening.opening_id] || 0);
              const newApplicantsCount = Math.max(0, applicationCount - seenCount);

              return (
                <Card
                  key={opening.opening_id}
                  className="border-stone-200 shadow-none hover:border-stone-300 transition-all"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-lg font-semibold text-stone-900 leading-tight">
                            {opening.opening_title || opening.title || 'Untitled Opening'}
                          </CardTitle>

                          {newApplicantsCount > 0 && (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-sm font-semibold text-green-700">
                              +{newApplicantsCount}
                            </span>
                          )}
                        </div>

                        <CardDescription className="mt-1.5 text-sm">
                          {opening.program_name || 'No Program'}
                          {(opening.semester || opening.academic_year) && (
                            <>
                              {' · '}
                              {[opening.semester, opening.academic_year].filter(Boolean).join(' · ')}
                            </>
                          )}
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

                    <div className="flex flex-wrap items-center gap-2 text-sm text-stone-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {[opening.semester, opening.academic_year].filter(Boolean).join(' · ') || 'No term'}
                      </span>

                      {pendingCount > 0 && (
                        <>
                          <span>•</span>
                          <span>{pendingCount} pending</span>
                        </>
                      )}
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        className="rounded-lg text-white text-sm font-medium border-none"
                        style={{ background: C.brownMid }}
                        onClick={() => handleOpenApplicants(opening.opening_id, applicationCount)}
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
                Tabular view of applicants and the scholarship they applied for
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px]">
                <thead className="bg-stone-50">
                  <tr className="border-b border-stone-200">
                    <th className="text-left text-xs font-semibold text-stone-500 px-4 py-3">Applicant</th>
                    <th className="text-left text-xs font-semibold text-stone-500 px-4 py-3">PDM ID</th>
                    <th className="text-left text-xs font-semibold text-stone-500 px-4 py-3">Scholarship</th>
                    <th className="text-left text-xs font-semibold text-stone-500 px-4 py-3">Opening</th>
                    <th className="text-left text-xs font-semibold text-stone-500 px-4 py-3">Semester</th>
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
                          {row.semester}
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

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SMaRT PDM · Applicant-Based Application Review
        </p>
      </footer>
    </div>
  );
}