import React, { useEffect, useMemo, useState } from 'react';
import { useSocketEvent } from '@/hooks/useSocket';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ClipboardCheck,
  Filter,
  X,
  AlertTriangle,
} from 'lucide-react';
import { buildApiUrl } from '@/api';

const C = {
  brownMid: '#7c4a2e',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  blue: '#1E3A8A',
  blueSoft: '#EFF6FF',
  bg: '#faf7f2',
  line: '#e7e5e4',
};

function StatusChip({ children, tone = 'default' }) {
  const map = {
    default: { bg: '#f5f5f4', color: '#57534e' },
    green: { bg: C.greenSoft, color: C.green },
    amber: { bg: C.amberSoft, color: C.amber },
    red: { bg: C.redSoft, color: C.red },
    blue: { bg: C.blueSoft, color: C.blue },
  };

  const s = map[tone] || map.default;

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      {children}
    </span>
  );
}

function normalizeStatus(value) {
  return String(value || '').trim().toLowerCase();
}

function isClearedScholar(scholar) {
  return (
    scholar.is_cleared === true ||
    normalizeStatus(scholar.ro_status) === 'cleared'
  );
}

function getScholarName(scholar) {
  return (
    scholar.name ||
    scholar.student_name ||
    [scholar.first_name, scholar.middle_name, scholar.last_name]
      .filter(Boolean)
      .join(' ') ||
    'Unknown Scholar'
  );
}

function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function formatYearLevel(value) {
  if (!value) return 'N/A';

  const raw = String(value).trim();

  if (raw.toLowerCase().includes('year')) return raw;

  const map = {
    1: '1st Year',
    2: '2nd Year',
    3: '3rd Year',
    4: '4th Year',
    5: '5th Year',
  };

  return map[raw] || `${raw} Year`;
}

function formatDate(value) {
  if (!value) return 'Not yet cleared';

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return 'Invalid date';
  }
}

function EmptyState({ viewMode, hasFilters, onReset }) {
  const isClearedView = viewMode === 'cleared';

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50">
        <ClipboardCheck className="h-6 w-6 text-stone-400" />
      </div>

      <h3 className="text-sm font-semibold text-stone-800">
        {isClearedView ? 'No cleared scholars found' : 'No pending RO scholars found'}
      </h3>

      <p className="mt-1 max-w-md text-xs leading-6 text-stone-500">
        {hasFilters
          ? 'No scholar matches the current search or filter choices.'
          : isClearedView
            ? 'Scholars you mark as cleared will appear here.'
            : 'Scholars with pending return-of-obligation clearance will appear here.'}
      </p>

      {hasFilters ? (
        <Button
          onClick={onReset}
          variant="outline"
          size="sm"
          className="mt-4 rounded-lg border-stone-200 text-xs"
        >
          Reset Filters
        </Button>
      ) : null}
    </div>
  );
}

function FilterModal({
  open,
  onClose,
  courses,
  openings,
  courseId,
  setCourseId,
  yearLevel,
  setYearLevel,
  openingId,
  setOpeningId,
  onReset,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />

      <Card className="relative w-full max-w-xl overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-900">
              Filter RO Scholars
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Refine the scholar list by course, year level, or scholarship opening.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                Course
              </label>

              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="all">All Courses</option>
                {courses.map((course) => (
                  <option
                    key={course.course_id || course.id}
                    value={course.course_id || course.id}
                  >
                    {course.course_code
                      ? `${course.course_code} - ${course.course_name || ''}`
                      : course.course_name || course.name || 'Unnamed Course'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                Year Level
              </label>

              <select
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="all">All Year Levels</option>
                <option value="1">1st Year</option>
                <option value="2">2nd Year</option>
                <option value="3">3rd Year</option>
                <option value="4">4th Year</option>
                <option value="5">5th Year</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                Scholarship Opening
              </label>

              <select
                value={openingId}
                onChange={(e) => setOpeningId(e.target.value)}
                className="h-10 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none focus:border-orange-800 focus:ring-2 focus:ring-orange-800/20"
              >
                <option value="all">All Openings</option>
                {openings.map((opening) => (
                  <option
                    key={opening.opening_id || opening.id}
                    value={opening.opening_id || opening.id}
                  >
                    {opening.opening_title ||
                      opening.title ||
                      opening.program_name ||
                      'Unnamed Opening'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-stone-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              className="rounded-xl border-stone-200 text-xs"
            >
              Reset Filters
            </Button>

            <Button
              type="button"
              onClick={onClose}
              className="rounded-xl border-none px-5 text-xs font-bold text-white"
              style={{ background: C.brownMid }}
            >
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ClearConfirmModal({
  open,
  scholar,
  loading,
  error,
  onClose,
  onConfirm,
}) {
  if (!open || !scholar) return null;

  const name = getScholarName(scholar);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={loading ? undefined : onClose} />

      <Card className="relative w-full max-w-md overflow-hidden rounded-2xl border-stone-200 bg-white shadow-xl">
        <div className="border-b border-stone-100 bg-stone-50/70 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-stone-900">
                  Clear Return of Obligation?
                </h3>
                <p className="mt-0.5 text-xs leading-5 text-stone-500">
                  This will mark the scholar as cleared and move the record to the cleared scholars section.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg p-2 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <CardContent className="space-y-4 p-5">
          <div className="rounded-xl border border-stone-200 bg-white px-3 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
              Scholar
            </p>
            <p className="mt-1 text-sm font-bold text-stone-900">{name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-stone-400">
              {scholar.pdm_id || scholar.student_number || scholar.student_id || 'No Student ID'}
            </p>

            <div className="mt-3 grid grid-cols-1 gap-2">
              <div className="rounded-lg bg-stone-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  Program
                </p>
                <p className="text-xs font-semibold text-stone-800">
                  {scholar.program_name || 'N/A'}
                </p>
              </div>

              <div className="rounded-lg bg-stone-50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">
                  Opening
                </p>
                <p className="text-xs font-semibold text-stone-800">
                  {scholar.opening_title || 'N/A'}
                </p>
              </div>
            </div>
          </div>

          {error ? (
            <div className="flex gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          <div className="flex justify-end gap-3 border-t border-stone-100 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border-stone-200 text-xs"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="rounded-xl border-none px-5 text-xs font-bold text-white"
              style={{ background: C.green }}
            >
              {loading ? (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
              )}
              Confirm Clear
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ROAdmin() {
  const token = sessionStorage.getItem('adminToken');

  const [scholars, setScholars] = useState([]);
  const [courses, setCourses] = useState([]);
  const [openings, setOpenings] = useState([]);

  const [viewMode, setViewMode] = useState('pending');
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState('all');
  const [yearLevel, setYearLevel] = useState('all');
  const [openingId, setOpeningId] = useState('all');

  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');

  const [filterOpen, setFilterOpen] = useState(false);
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [selectedScholar, setSelectedScholar] = useState(null);
  const [clearError, setClearError] = useState('');

  const activeFilterCount = [
    courseId !== 'all',
    yearLevel !== 'all',
    openingId !== 'all',
  ].filter(Boolean).length;

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    }),
    [token]
  );

  const buildScholarQuery = () => {
    const params = new URLSearchParams();

    params.set('status', viewMode);

    if (search.trim()) params.set('search', search.trim());
    if (courseId !== 'all') params.set('courseId', courseId);
    if (yearLevel !== 'all') params.set('yearLevel', yearLevel);
    if (openingId !== 'all') params.set('openingId', openingId);

    return params.toString();
  };

  const loadFilterData = async () => {
    try {
      const [coursesRes, openingsRes] = await Promise.all([
        fetch(buildApiUrl('/api/courses'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(buildApiUrl('/api/program-openings'), {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const coursesData = await coursesRes.json().catch(() => []);
      const openingsData = await openingsRes.json().catch(() => []);

      if (coursesRes.ok) {
        setCourses(Array.isArray(coursesData) ? coursesData : coursesData.data || []);
      }

      if (openingsRes.ok) {
        setOpenings(Array.isArray(openingsData) ? openingsData : openingsData.data || []);
      }
    } catch (err) {
      console.error('LOAD RO FILTER DATA ERROR:', err);
    }
  };

  const loadScholars = async ({ initial = false } = {}) => {
    try {
      if (initial) setLoading(true);
      else setFilterLoading(true);

      setError('');

      const query = buildScholarQuery();

      const res = await fetch(buildApiUrl(`/api/ro/scholars?${query}`), {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to load RO scholars');
      }

      const rows = Array.isArray(data)
        ? data
        : Array.isArray(data.scholars)
          ? data.scholars
          : Array.isArray(data.data)
            ? data.data
            : [];

      setScholars(rows);
    } catch (err) {
      console.error('LOAD RO SCHOLARS ERROR:', err);
      setError(err.message || 'Failed to load RO scholars');
      setScholars([]);
    } finally {
      setLoading(false);
      setFilterLoading(false);
    }
  };

  useEffect(() => {
    loadFilterData();
    loadScholars({ initial: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadScholars();
    }, 350);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, search, courseId, yearLevel, openingId]);

  useSocketEvent(
    'ro:updated',
    () => {
      loadScholars();
    },
    [viewMode, search, courseId, yearLevel, openingId]
  );

  useSocketEvent(
    'scholar:updated',
    () => {
      loadScholars();
    },
    [viewMode, search, courseId, yearLevel, openingId]
  );

  const handleResetFilters = () => {
    setSearch('');
    setCourseId('all');
    setYearLevel('all');
    setOpeningId('all');
  };

  const openClearModal = (scholar) => {
    setSelectedScholar(scholar);
    setClearError('');
    setClearModalOpen(true);
  };

  const closeClearModal = () => {
    if (actionLoading) return;

    setSelectedScholar(null);
    setClearError('');
    setClearModalOpen(false);
  };

  const handleConfirmClear = async () => {
    const scholar = selectedScholar;
    if (!scholar) return;

    const studentId = scholar.student_id;

    if (!studentId) {
      setClearError('Missing student ID. Cannot clear this scholar.');
      return;
    }

    const rowKey = `${studentId}-${scholar.application_id || scholar.opening_id || 'no-application'}`;

    try {
      setActionLoading(rowKey);
      setClearError('');

      const res = await fetch(buildApiUrl(`/api/ro/scholars/${studentId}/clear`), {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({
          applicationId: scholar.application_id || null,
          openingId: scholar.opening_id || null,
          programId: scholar.program_id || null,
          remarks: 'Marked as cleared by RO admin.',
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to clear scholar');
      }

      const updatedClearance = data.clearance || {};

      if (viewMode === 'pending') {
        setScholars((prev) =>
          prev.filter((item) => {
            const sameStudent = String(item.student_id || '') === String(studentId);
            const sameApplication =
              String(item.application_id || '') === String(scholar.application_id || '');

            return !(sameStudent && sameApplication);
          })
        );
      } else {
        setScholars((prev) =>
          prev.map((item) => {
            const sameStudent = String(item.student_id || '') === String(studentId);
            const sameApplication =
              String(item.application_id || '') === String(scholar.application_id || '');

            if (sameStudent && sameApplication) {
              return {
                ...item,
                ro_id: updatedClearance.ro_id || item.ro_id,
                ro_status: 'Cleared',
                is_cleared: true,
                cleared_at: updatedClearance.cleared_at || new Date().toISOString(),
                remarks: updatedClearance.remarks || item.remarks,
              };
            }

            return item;
          })
        );
      }

      setSelectedScholar(null);
      setClearModalOpen(false);
    } catch (err) {
      console.error('CLEAR RO ERROR:', err);
      setClearError(err.message || 'Failed to clear scholar');
    } finally {
      setActionLoading(null);
    }
  };

  const hasFilters =
    search.trim() ||
    courseId !== 'all' ||
    yearLevel !== 'all' ||
    openingId !== 'all';

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-stone-300" />
        <p className="text-xs uppercase tracking-widest text-stone-400">
          Loading RO scholars...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-1 py-3" style={{ background: C.bg }}>
      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        courses={courses}
        openings={openings}
        courseId={courseId}
        setCourseId={setCourseId}
        yearLevel={yearLevel}
        setYearLevel={setYearLevel}
        openingId={openingId}
        setOpeningId={setOpeningId}
        onReset={handleResetFilters}
      />

      <ClearConfirmModal
        open={clearModalOpen}
        scholar={selectedScholar}
        loading={!!actionLoading}
        error={clearError}
        onClose={closeClearModal}
        onConfirm={handleConfirmClear}
      />

      <section
        className="rounded-2xl border bg-white p-3 sm:p-4"
        style={{ borderColor: C.line }}
      >
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />

            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search scholar name or PDM ID..."
              className="h-10 rounded-xl border-stone-200 bg-stone-50 pl-10 text-sm shadow-none focus-visible:ring-1"
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="inline-flex w-full rounded-xl bg-stone-100 p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => setViewMode('pending')}
                className={`inline-flex flex-1 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${viewMode === 'pending'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600'
                  }`}
              >
                Pending RO
              </button>

              <button
                type="button"
                onClick={() => setViewMode('cleared')}
                className={`inline-flex flex-1 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${viewMode === 'cleared'
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600'
                  }`}
              >
                Cleared
              </button>
            </div>

            <Button
              onClick={() => setFilterOpen(true)}
              variant="outline"
              size="sm"
              className="h-10 rounded-xl border-stone-200 bg-white px-3 text-stone-700"
            >
              <Filter className="mr-2 h-4 w-4" />
              Filters
              {activeFilterCount > 0 ? (
                <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>

            <Button
              onClick={() => loadScholars()}
              variant="outline"
              size="sm"
              className="h-10 rounded-xl border-stone-200 bg-white px-3 text-stone-700"
              disabled={filterLoading}
            >
              {filterLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>

            {hasFilters ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-10 rounded-xl border-stone-200 bg-white px-3 text-xs text-stone-700"
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section
        className="overflow-hidden rounded-2xl border bg-white"
        style={{ borderColor: C.line }}
      >
        <div className="border-b border-stone-100 px-5 py-4">
          <h2 className="text-sm font-semibold text-stone-800">
            Return of Obligation Clearance
          </h2>
          <p className="mt-1 text-xs text-stone-500">
            Manage pending and cleared return-of-obligation records for active scholars.
          </p>
        </div>

        {error ? (
          <div className="border-b border-red-100 bg-red-50 px-5 py-3 text-xs font-semibold text-red-600">
            {error}
          </div>
        ) : null}

        <CardContent className="p-4">
          {scholars.length === 0 ? (
            <EmptyState
              viewMode={viewMode}
              hasFilters={hasFilters}
              onReset={handleResetFilters}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/70">
                    <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                      Scholar
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                      PDM ID
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                      Scholarship
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                      Opening
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                      Course
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                      Year
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                      Status
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-stone-900">
                      Cleared Date
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-semibold text-stone-900">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-stone-100 bg-white">
                  {scholars.map((scholar) => {
                    const studentId = scholar.student_id;
                    const rowKey = `${studentId}-${scholar.application_id || scholar.opening_id || 'no-application'}`;
                    const name = getScholarName(scholar);
                    const cleared = isClearedScholar(scholar);
                    const loadingThis = actionLoading === rowKey;

                    return (
                      <tr
                        key={rowKey}
                        className="transition-colors hover:bg-stone-50/70"
                      >
                        <td className="px-3 py-3 align-top">
                          <div className="flex items-start gap-3">
                            <Avatar className="h-8 w-8 shrink-0 rounded-full border border-stone-200 shadow-sm">
                              <AvatarImage
                                src={
                                  scholar.profile_photo_url ||
                                  scholar.avatarUrl ||
                                  scholar.avatar_url ||
                                  undefined
                                }
                                alt={name}
                              />
                              <AvatarFallback className="bg-blue-900 text-[10px] font-semibold text-white">
                                {getInitials(name)}
                              </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0">
                              <p className="max-w-[180px] truncate text-sm font-semibold text-stone-900">
                                {name}
                              </p>

                              <p className="mt-0.5 text-[11px] text-stone-400">
                                {scholar.is_active_scholar === false
                                  ? 'Inactive Scholar'
                                  : 'Active Scholar'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 align-top">
                          <p className="font-mono text-xs text-stone-700">
                            {scholar.pdm_id ||
                              scholar.student_number ||
                              scholar.student_id ||
                              'N/A'}
                          </p>
                        </td>

                        <td className="px-3 py-3 align-top">
                          <p className="max-w-[180px] text-xs font-semibold leading-5 text-stone-900">
                            {scholar.program_name ||
                              scholar.scholarship_program ||
                              scholar.program ||
                              'N/A'}
                          </p>

                          {scholar.benefactor_name ? (
                            <p className="mt-0.5 max-w-[180px] text-[11px] leading-4 text-stone-400">
                              {scholar.benefactor_name}
                            </p>
                          ) : null}
                        </td>

                        <td className="px-3 py-3 align-top">
                          <p className="max-w-[200px] text-xs font-medium leading-5 text-stone-700">
                            {scholar.opening_title ||
                              scholar.opening_name ||
                              scholar.batch_title ||
                              'N/A'}
                          </p>
                        </td>

                        <td className="px-3 py-3 align-top">
                          <p className="max-w-[180px] text-xs font-semibold leading-5 text-stone-800">
                            {scholar.course_code || 'N/A'}
                          </p>

                          {scholar.course_name ? (
                            <p className="mt-0.5 max-w-[200px] text-[11px] leading-4 text-stone-400">
                              {scholar.course_name}
                            </p>
                          ) : null}
                        </td>

                        <td className="px-3 py-3 align-top">
                          <p className="text-xs font-medium text-stone-700">
                            {formatYearLevel(scholar.year_level)}
                          </p>
                        </td>

                        <td className="px-3 py-3 align-top">
                          {cleared ? (
                            <StatusChip tone="green">Cleared</StatusChip>
                          ) : (
                            <StatusChip tone="amber">Pending</StatusChip>
                          )}
                        </td>

                        <td className="px-3 py-3 align-top">
                          <p className="text-xs font-medium text-stone-700">
                            {cleared ? formatDate(scholar.cleared_at) : 'Not yet cleared'}
                          </p>
                        </td>

                        <td className="px-3 py-3 text-right align-top">
                          {viewMode === 'cleared' || cleared ? (
                            <div className="inline-flex items-center gap-1.5 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-xs font-bold text-green-700">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              RO Cleared
                            </div>
                          ) : (
                            <Button
                              onClick={() => openClearModal(scholar)}
                              disabled={loadingThis}
                              className="h-8 rounded-lg border-none px-3 text-xs font-semibold text-white"
                              style={{ background: C.green }}
                            >
                              {loadingThis ? (
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                              )}
                              Clear
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        <div className="flex items-center justify-between border-t border-stone-100 px-5 py-3">
          <p className="text-xs text-stone-400">
            Showing {scholars.length ? `1-${scholars.length}` : '0-0'} of {scholars.length}
          </p>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled
              className="h-8 w-8 rounded-full border-stone-200 text-stone-400 disabled:opacity-50"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>

            <span className="text-xs text-stone-500">Page 1 / 1</span>

            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled
              className="h-8 w-8 rounded-full border-stone-200 text-stone-400 disabled:opacity-50"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}