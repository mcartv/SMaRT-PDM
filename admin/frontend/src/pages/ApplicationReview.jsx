import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSocketEvent } from '@/hooks/useSocket';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';
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
  Download,
  CheckCircle2,
  ListOrdered,
  Trophy,
  X,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { showAppToast } from '@/utils/appToast';

const C = {
  brownMid: 'var(--portal-base)',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  bg: '#f8f6f2',
  line: 'var(--portal-border)',
};

const PAGE_SIZE = 8;

const DEFAULT_FILTERS = {
  academicYear: 'all',
  openingStatus: 'all',
  applicationStatus: 'all',
  documentStatus: 'all',
};

const READINESS_SEEN_STORAGE_PREFIX = 'smart-pdm:admin:readiness-seen:v1';

function getReadinessSeenStorageKey() {
  try {
    const profile = JSON.parse(sessionStorage.getItem('adminProfile') || '{}');
    const userId = profile?.user_id || profile?.userId || profile?.id || 'admin';
    return `${READINESS_SEEN_STORAGE_PREFIX}:${userId}`;
  } catch {
    return `${READINESS_SEEN_STORAGE_PREFIX}:admin`;
  }
}

function readReadinessSeenState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(getReadinessSeenStorageKey()) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeReadinessSeenState(value) {
  try {
    localStorage.setItem(getReadinessSeenStorageKey(), JSON.stringify(value || {}));
  } catch {
    // The readiness indicator remains session-functional even if browser storage is unavailable.
  }
}

function buildReadinessOpeningSignature(rows = []) {
  return rows
    .map((row) =>
      [
        row.application_id || '',
        normalizeStatus(row.selection_status),
        Number(row.queue_position || 0),
        Number(row.waitlist_position || 0),
        row.fcfs_completed_at || '',
      ].join(':')
    )
    .sort()
    .join('|');
}

function normalizeStatus(value = '') {
  return String(value).trim().toLowerCase();
}

function normalizePdmSearchValue(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
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

function toTimestamp(value, fallback = Number.MAX_SAFE_INTEGER) {
  if (!value) return fallback;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? fallback : parsed;
}

function compareFcfs(a, b) {
  const queueA = Number(a?.queue_position);
  const queueB = Number(b?.queue_position);
  const hasQueueA = Number.isFinite(queueA) && queueA > 0;
  const hasQueueB = Number.isFinite(queueB) && queueB > 0;

  if (hasQueueA && hasQueueB && queueA !== queueB) {
    return queueA - queueB;
  }
  if (hasQueueA !== hasQueueB) {
    return hasQueueA ? -1 : 1;
  }

  const completedDifference =
    toTimestamp(a?.fcfs_completed_at) -
    toTimestamp(b?.fcfs_completed_at);

  if (completedDifference !== 0) return completedDifference;

  const submittedDifference =
    toTimestamp(a?.submitted_at) -
    toTimestamp(b?.submitted_at);

  if (submittedDifference !== 0) return submittedDifference;

  return String(a?.application_id || '').localeCompare(
    String(b?.application_id || '')
  );
}

function getFcfsLabel(row) {
  const queuePosition = Number(row?.queue_position);
  if (Number.isFinite(queuePosition) && queuePosition > 0) {
    return `#${queuePosition}`;
  }
  return row?.fcfs_completed_at ? 'Queued' : 'Not ranked';
}

async function parseErrorResponse(response, fallback = 'Request failed') {
  try {
    const data = await response.json();

    return (
      data?.error ||
      data?.message ||
      fallback
    );
  } catch {
    return fallback;
  }
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
    label: row?.document_status || '\u2014',
    bg: '#f5f5f4',
    color: '#57534e',
  };
}

function getReadinessMeta(isComplete, positiveLabel, negativeLabel) {
  if (isComplete) {
    return { label: positiveLabel, bg: C.greenSoft, color: C.green };
  }

  return { label: negativeLabel, bg: '#FFF7ED', color: '#d97706' };
}

function getScholarReadinessMeta(row) {
  if (row?.scholar_activation_ready) {
    return { label: 'Scholar Ready', bg: C.greenSoft, color: C.green };
  }

  return { label: 'Pending Activation', bg: '#FEF2F2', color: '#dc2626' };
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
    pdm_id: app.pdm_id || '\u2014',
    program_name: app.program_name || 'No Program',
    application_status: app.application_status || 'Pending',
    document_status: app.document_status || app.deficiency_status || '\u2014',
    submitted_at: app.submission_date || null,
    opening_title: app.opening_title || 'Untitled Opening',
    academic_year: app.academic_year || '\u2014',
    posting_status: app.posting_status || app.opening_status || 'open',
    allocated_slots: app.allocated_slots || 0,
    filled_slots: app.filled_slots || 0,
    requirements_complete: app.requirements_complete === true,
    documents_ready:
      app.documents_ready === true ||
      Number(app.uploaded_required_count || 0) >= 4,
    uploaded_required_count: Number(app.uploaded_required_count || 0),
    requirements_status: app.requirements_status || null,
    requirements_completed_at: app.requirements_completed_at || null,
    fcfs_completed_at: app.fcfs_completed_at || null,
    requirements_verified_at: app.requirements_verified_at || null,
    queue_position:
      app.queue_position != null ? Number(app.queue_position) : null,
    waitlist_position:
      app.waitlist_position != null ? Number(app.waitlist_position) : null,
    selection_status: app.selection_status || null,
    endorsement_complete: app.endorsement_complete === true,
    scholar_activation_ready: app.scholar_activation_ready === true,
    requirements_incomplete: app.requirements_incomplete !== false,
    endorsement_pending: app.endorsement_pending !== false,
    needs_activation_attention: app.needs_activation_attention !== false,
    blockers: Array.isArray(app.blockers) ? app.blockers : [],
    endorsement_slip_id: app.endorsement_slip_id || null,
    endorsement_slip_code: app.endorsement_slip_code || 'ES-PENDING',
    endorsement_current_stage: app.endorsement_current_stage || null,
  };
}

function isApplicantAtRisk(app) {
  const gwa = Number(app?.gwa);
  const rawStatus = (app?.application_status || '').toLowerCase();
  const docStatus = (app?.document_status || '').toLowerCase();
  const verificationStatus = (app?.verification_status || '').toLowerCase();
  const sdo = normalizeSdo(app?.sdu_level || app?.sdo_status || '');

  const gwaRisk = Number.isFinite(gwa) && gwa > 2.0;
  const docRisk = docStatus === 'missing docs' || docStatus === 'under review';
  const verificationRisk = verificationStatus === 'rejected';
  const sdoRisk = sdo === 'major' || sdo === 'minor';
  const appRisk = rawStatus === 'requires_reupload';

  return gwaRisk || docRisk || verificationRisk || sdoRisk || appRisk;
}

function StatusPill({ meta }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
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

function ReadinessSummary({ rows }) {
  const totalReady = rows.length;
  const withSlip = rows.filter((row) => row.endorsement_slip_id).length;
  const completeRequirements = rows.filter((row) => row.requirements_complete).length;
  const completeEndorsement = rows.filter((row) => row.endorsement_complete).length;

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <Card className="border-stone-200 shadow-none">
        <CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-wide text-stone-500">Ready for Activation</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{totalReady}</p>
        </CardContent>
      </Card>
      <Card className="border-stone-200 shadow-none">
        <CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-wide text-stone-500">Requirements Complete</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{completeRequirements}</p>
        </CardContent>
      </Card>
      <Card className="border-stone-200 shadow-none">
        <CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-wide text-stone-500">Endorsement Complete</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{completeEndorsement}</p>
        </CardContent>
      </Card>
      <Card className="border-stone-200 shadow-none">
        <CardContent className="p-4">
          <p className="text-[10px] uppercase tracking-wide text-stone-500">With Downloadable Slip</p>
          <p className="mt-2 text-2xl font-semibold text-stone-900">{withSlip}</p>
        </CardContent>
      </Card>
    </section>
  );
}

function Toolbar({
  search,
  setSearch,
  viewType,
  setViewType,
  hasNeedsAttention,
  refreshing,
  onRefresh,
  academicYearOptions,
  filters,
  draftFilters,
  setDraftFilters,
  onApplyFilters,
  onClearFilters,
}) {
  const [filterOpen, setFilterOpen] = useState(false);

  const hasActiveFilters =
    filters.academicYear !== 'all' ||
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

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <div className="inline-flex w-full rounded-xl bg-stone-100 p-1 sm:w-auto">
            <button
              type="button"
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
              type="button"
              onClick={() => setViewType('table')}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${viewType === 'table'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600'
                }`}
            >
              <Table2 className="h-4 w-4" />
              Registry
            </button>
            <button
              type="button"
              onClick={() => setViewType('action')}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition sm:flex-none ${viewType === 'action'
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-600'
                }`}
            >
              <span className="relative inline-flex items-center">
                Readiness
                {hasNeedsAttention ? (
                  <span className="absolute -right-2 -top-1 h-2.5 w-2.5 rounded-full bg-red-500" />
                ) : null}
              </span>
            </button>
          </div>

          <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={openModal}
                className="h-10 rounded-xl border-stone-200 bg-white px-3 text-sm font-medium text-stone-700"
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
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700">
                    Academic Year
                  </label>
                  <Select
                    value={draftFilters.academicYear}
                    onValueChange={(value) =>
                      setDraftFilters((prev) => ({ ...prev, academicYear: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select academic year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Academic Years</SelectItem>
                      {academicYearOptions.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
            className="h-10 rounded-xl border-stone-200 bg-white px-3 text-sm font-medium text-stone-700"
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

function OpeningsGrid({
  rows,
  countsMap,
  navigate,
  unseenOpeningIds = new Set(),
  onOpeningViewed = () => { },
}) {
  return (
    <section className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
      {rows.map((opening) => {
        const statusMeta = getOpeningStatusMeta(opening);
        const allocatedSlots = Number(opening.allocated_slots || opening.slot_count || 0);
        const filledSlots = getComputedFilledSlots(opening);
        const remainingSlots = Math.max(0, allocatedSlots - filledSlots);
        const summary = countsMap.get(opening.opening_id) || {};
        const applicationCount = summary.applicants || 0;
        const requirementsCount = summary.requirementsComplete || 0;
        const endorsementCount = summary.endorsementComplete || 0;
        const readyCount = summary.scholarReady || 0;
        const fcfsCount = summary.fcfsQueued || 0;
        const nextFcfsApplicant = summary.nextFcfsApplicant || null;
        const hasUnseenReadiness = unseenOpeningIds.has(String(opening.opening_id));

        return (
          <Card
            key={opening.opening_id}
            className="rounded-2xl border-stone-200 bg-white shadow-none transition hover:border-stone-300"
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="min-w-0 truncate text-lg font-semibold leading-tight text-stone-900">
                        {opening.opening_title || opening.title || 'Untitled Opening'}
                      </h2>
                      {hasUnseenReadiness ? (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
                          title="New readiness activity"
                          aria-label="New readiness activity"
                        />
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-stone-500">
                      {opening.program_name || 'No Program'}
                      {opening.academic_year ? ` ${opening.academic_year}` : ''}
                    </p>
                  </div>

                  <StatusPill meta={statusMeta} />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <MetricItem label="Slots" value={allocatedSlots} />
                  <MetricItem label="Filled" value={filledSlots} />
                  <MetricItem label="Applicants" value={applicationCount} />
                  <MetricItem label="Remaining" value={remainingSlots} />
                  <MetricItem label="Req. OK" value={requirementsCount} />
                  <MetricItem label="Endorse OK" value={endorsementCount} />
                  <MetricItem label="FCFS Queue" value={fcfsCount} />
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
                    <span>Scholar-ready applicants</span>
                    <span className="font-semibold text-stone-900">{readyCount}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    <span className="inline-flex items-center gap-1.5">
                      <Trophy className="h-3.5 w-3.5" />
                      Next in FCFS
                    </span>
                    <span className="max-w-[180px] truncate font-semibold">
                      {nextFcfsApplicant?.applicant_name || 'No ranked applicant'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-stone-100 pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-lg border-amber-200 px-3 text-xs text-amber-800"
                    onClick={() => {
                      onOpeningViewed(opening.opening_id);
                      navigate(`/admin/openings/${opening.opening_id}/applications`);
                    }}
                  >
                    <ListOrdered className="mr-1.5 h-3.5 w-3.5" />
                    View FCFS Queue
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

function ReadinessCompletionSummary({
  row,
  navigate,
  onDownloadSlip,
  onClose,
}) {
  if (!row) return null;

  const selectionStatus = normalizeStatus(row.selection_status);
  const isWaiting = selectionStatus === 'waitlisted';
  const isPromoted = selectionStatus === 'promoted';

  const selectionLabel = isWaiting
    ? `Waiting #${Number(row.waitlist_position || 0) || '—'}`
    : isPromoted
      ? 'Promoted from Waiting List'
      : 'Reserved by FCFS';

  return (
    <Dialog
      open={Boolean(row)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="overflow-hidden rounded-2xl border-stone-200 p-0 sm:max-w-xl">
        {/* Header */}
        <DialogHeader className="border-b border-stone-100 px-5 py-4 text-left sm:px-6">
          <DialogTitle className="text-lg font-semibold text-stone-900">
            Final Readiness Summary
          </DialogTitle>

          <p className="mt-1 text-sm text-stone-500">
            {row.applicant_name} · {row.pdm_id}
          </p>
        </DialogHeader>

        <div className="space-y-4 px-5 py-5 sm:px-6">
          {/* Overall status */}
          <div className="flex items-center gap-3 rounded-xl bg-green-50 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-4 w-4 text-green-700" />
            </div>

            <div>
              <p className="text-sm font-semibold text-green-900">
                Ready for final activation
              </p>
              <p className="mt-0.5 text-xs text-green-700">
                Requirements and endorsement have been completed.
              </p>
            </div>
          </div>

          {/* Completed process */}
          <div className="overflow-hidden rounded-xl border border-stone-200">
            <div className="flex items-start gap-3 border-b border-stone-100 px-4 py-3.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-900">
                    Application Requirements
                  </p>

                  <span className="text-xs font-semibold text-green-700">
                    Verified
                  </span>
                </div>

                <p className="mt-1 text-xs text-stone-500">
                  Admin verification completed
                  {row.requirements_verified_at
                    ? ` · ${formatDate(row.requirements_verified_at)}`
                    : ''}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 px-4 py-3.5">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-stone-900">
                    Endorsement
                  </p>

                  <span className="text-xs font-semibold text-green-700">
                    Completed
                  </span>
                </div>

                <p className="mt-1 text-xs text-stone-500">
                  SDO · Guidance · Program Director
                </p>

                {row.endorsement_slip_code ? (
                  <p className="mt-1 font-mono text-[11px] text-stone-400">
                    {row.endorsement_slip_code}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          {/* FCFS */}
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-stone-200">
            <div className="border-r border-stone-100 px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                FCFS Position
              </p>

              <p className="mt-1.5 text-base font-semibold text-stone-900">
                {getFcfsLabel(row)}
              </p>

              <p className="mt-0.5 text-xs text-stone-500">
                {row.fcfs_completed_at
                  ? formatDate(row.fcfs_completed_at)
                  : 'Not ranked'}
              </p>
            </div>

            <div className="px-4 py-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
                Selection
              </p>

              <p className="mt-1.5 text-sm font-semibold text-stone-900">
                {selectionLabel}
              </p>

              <p className="mt-0.5 text-xs text-stone-500">
                {isWaiting
                  ? 'Waiting for an available slot'
                  : 'Scholarship slot reserved'}
              </p>
            </div>
          </div>

          {/* Scholarship */}
          <div className="px-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-400">
              Scholarship
            </p>

            <p className="mt-1 text-sm font-semibold text-stone-900">
              {row.program_name}
            </p>

            <p className="mt-0.5 text-sm text-stone-500">
              {row.opening_title}
              {row.academic_year ? ` · ${row.academic_year}` : ''}
            </p>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-stone-100 bg-stone-50/70 px-5 py-3 sm:px-6">
          <div className="flex w-full flex-wrap justify-end gap-2">
            {row.endorsement_slip_id ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-lg border-stone-200 bg-white"
                  onClick={() =>
                    navigate(
                      `/admin/endorsements/${row.endorsement_slip_id}`
                    )
                  }
                >
                  View Endorsement
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-lg border-stone-200 bg-white"
                  onClick={() => onDownloadSlip(row)}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Download PDF
                </Button>
              </>
            ) : null}

            <Button
              size="sm"
              className="h-9 rounded-lg border-none px-4 text-white"
              style={{ background: C.brownMid }}
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function ReadinessOpeningCards({
  openings,
  rows,
  navigate,
  onDownloadSlip,
  onApproveScholar,
  approvalLoadingId = '',
  unseenOpeningIds = new Set(),
  onOpeningViewed = () => { },
}) {
  const grouped = useMemo(() => {
    const map = new Map();

    openings.forEach((opening) => {
      map.set(opening.opening_id, {
        opening,
        reserved: [],
        waiting: [],
      });
    });

    rows.forEach((row) => {
      if (!row.opening_id) return;

      if (!map.has(row.opening_id)) {
        map.set(row.opening_id, {
          opening: {
            opening_id: row.opening_id,
            opening_title: row.opening_title || 'Scholarship Opening',
            program_name: row.program_name || 'Scholarship Program',
            academic_year: row.academic_year || '',
            allocated_slots: 0,
            filled_slots: 0,
          },
          reserved: [],
          waiting: [],
        });
      }

      const group = map.get(row.opening_id);
      const status = normalizeStatus(row.selection_status);

      if (status === 'waitlisted') {
        group.waiting.push(row);
      } else {
        group.reserved.push(row);
      }
    });

    return [...map.values()]
      .map((group) => ({
        ...group,
        reserved: [...group.reserved].sort(compareFcfs),
        waiting: [...group.waiting].sort((a, b) => {
          const waitA = Number(
            a.waitlist_position || Number.MAX_SAFE_INTEGER
          );
          const waitB = Number(
            b.waitlist_position || Number.MAX_SAFE_INTEGER
          );

          if (waitA !== waitB) return waitA - waitB;
          return compareFcfs(a, b);
        }),
      }))
      .filter((group) => {
        const statusGroup = getOpeningGroup(
          group.opening?.posting_status ||
          group.opening?.status ||
          ''
        );

        return statusGroup === 'open';
      })
      .sort((a, b) =>
        String(a.opening?.opening_title || '').localeCompare(
          String(b.opening?.opening_title || '')
        )
      );
  }, [openings, rows]);

  const [selectedOpeningId, setSelectedOpeningId] =
    useState('');
  const [summaryRow, setSummaryRow] = useState(null);

  useEffect(() => {
    if (!grouped.length) {
      if (selectedOpeningId) {
        setSelectedOpeningId('');
      }
      return;
    }

    const stillExists = grouped.some(
      (group) =>
        String(group.opening?.opening_id) ===
        String(selectedOpeningId)
    );

    if (!stillExists) {
      setSelectedOpeningId(
        String(grouped[0].opening?.opening_id || '')
      );
    }
  }, [grouped, selectedOpeningId]);

  if (!grouped.length) {
    return (
      <Card className="rounded-2xl border-stone-200 shadow-none">
        <CardContent className="py-16 text-center">
          <p className="text-base font-semibold text-stone-700">
            No available scholarship openings.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-500">
            Readiness shows every currently open scholarship
            opening, including openings that do not have ready
            or waitlisted applicants yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  const selectedGroup =
    grouped.find(
      (group) =>
        String(group.opening?.opening_id) ===
        String(selectedOpeningId)
    ) || grouped[0];

  const { opening, reserved, waiting } = selectedGroup;

  const allocated = Number(
    opening.allocated_slots || opening.slot_count || 0
  );

  const active = Number(opening.filled_slots || 0);
  const reservedCount = reserved.length;

  const available = Math.max(
    0,
    allocated - active - reservedCount
  );

  return (
    <div className="space-y-3">
      <ReadinessCompletionSummary
        row={summaryRow}
        navigate={navigate}
        onDownloadSlip={onDownloadSlip}
        onClose={() => setSummaryRow(null)}
      />

      <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-none sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-900">
              Scholarship Opening
            </p>
            <p className="text-xs text-stone-500">
              Switch openings without hiding the readiness list.
            </p>
          </div>

          <span className="text-xs text-stone-400">
            {grouped.length} open
            {grouped.length === 1 ? ' opening' : ' openings'}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {grouped.map((group) => {
            const itemOpening = group.opening || {};
            const itemId = String(
              itemOpening.opening_id || ''
            );

            const selected =
              itemId ===
              String(
                selectedGroup.opening?.opening_id || ''
              );
            const hasUnseenReadiness = unseenOpeningIds.has(itemId);

            return (
              <button
                key={itemId}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setSelectedOpeningId(itemId);
                  onOpeningViewed(itemId);
                }}
                className={`min-h-[118px] transform-gpu rounded-2xl border px-4 py-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${selected
                    ? 'border-[#6b472f] bg-[#6b472f] text-white hover:border-[#6b472f] hover:bg-[#6b472f]'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-[#d8b27a] hover:bg-[#fff8eb]'
                  }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <p
                        className={`min-w-0 truncate text-sm font-semibold ${selected
                            ? 'text-white'
                            : 'text-stone-900'
                          }`}
                      >
                        {itemOpening.opening_title ||
                          'Scholarship Opening'}
                      </p>
                      {hasUnseenReadiness ? (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
                          title="New readiness activity"
                          aria-label="New readiness activity"
                        />
                      ) : null}
                    </div>

                    <p
                      className={`mt-0.5 truncate text-xs ${selected
                          ? 'text-white/70'
                          : 'text-stone-500'
                        }`}
                    >
                      {itemOpening.program_name ||
                        'Scholarship Program'}
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${selected
                        ? 'bg-white/15 text-white'
                        : 'bg-green-50 text-green-700'
                      }`}
                  >
                    {group.reserved.length} ready
                  </span>
                </div>

                <div
                  className={`mt-2 flex items-center gap-3 text-[11px] ${selected
                      ? 'text-white/70'
                      : 'text-stone-500'
                    }`}
                >
                  <span>
                    {group.reserved.length} reserved
                  </span>
                  <span>
                    {group.waiting.length} waiting
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <Card className="overflow-hidden rounded-2xl border-stone-200 bg-white shadow-none">
        <div className="border-b border-stone-100 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-stone-900 sm:text-lg">
                {opening.opening_title ||
                  'Scholarship Opening'}
              </h2>

              <p className="mt-0.5 text-sm text-stone-500">
                {opening.program_name ||
                  'Scholarship Program'}
                {opening.academic_year
                  ? ` · ${opening.academic_year}`
                  : ''}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-9 shrink-0 rounded-lg border-stone-200 text-sm"
              onClick={() => {
                onOpeningViewed(opening.opening_id);
                navigate(
                  `/admin/openings/${opening.opening_id}/applications`
                );
              }}
            >
              Open Queue
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <MetricItem
              label="Slots"
              value={allocated}
            />
            <MetricItem
              label="Active Scholars"
              value={active}
            />
            <MetricItem
              label="Reserved"
              value={reservedCount}
            />
            <MetricItem
              label="Waiting"
              value={waiting.length}
            />
            <MetricItem
              label="Available"
              value={available}
            />
          </div>
        </div>

        <CardContent className="grid gap-8 p-5 sm:p-6 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="min-w-0">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold leading-5 text-stone-900">
                  Ready for Activation
                </h3>
                <p className="mt-0.5 text-xs leading-5 text-stone-500 sm:text-sm">
                  FCFS applicants currently holding a scholarship
                  slot.
                </p>
              </div>

              <StatusPill
                meta={{
                  label: `${reserved.length} reserved`,
                  bg: C.greenSoft,
                  color: C.green,
                }}
              />
            </div>

            {reserved.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-200 px-5 py-12 text-center text-sm text-stone-400">
                No applicants are currently reserved for
                activation.
              </div>
            ) : (
              <div className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200">
                {reserved.map((row) => (
                  <div
                    key={row.application_id}
                    className="flex flex-col gap-4 bg-white px-4 py-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-2 text-sm font-bold text-amber-800">
                        {getFcfsLabel(row)}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-900">
                          {row.applicant_name}
                        </p>

                        <p className="mt-1 text-sm text-stone-500">
                          {row.pdm_id} {'·'} Ready{' '}
                          {formatDate(
                            row.fcfs_completed_at
                          )}
                        </p>

                        <p className="mt-1 text-xs font-medium text-green-700">
                          {normalizeStatus(
                            row.selection_status
                          ) === 'promoted'
                            ? 'Promoted from waiting list'
                            : 'Reserved by FCFS'}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 lg:justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-lg border-stone-200 text-sm"
                        onClick={() => setSummaryRow(row)}
                      >
                        View Summary
                      </Button>

                      <Button
                        size="sm"
                        className="h-9 rounded-lg border-none px-4 text-sm text-white"
                        style={{
                          background: C.green,
                        }}
                        disabled={
                          approvalLoadingId ===
                          row.application_id
                        }
                        onClick={() =>
                          onApproveScholar(row)
                        }
                      >
                        {approvalLoadingId ===
                          row.application_id ? (
                          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1.5 h-4 w-4" />
                        )}

                        Activate Scholar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="min-w-0">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-stone-900">
                  Waiting List
                </h3>

                <p className="mt-0.5 text-xs leading-5 text-stone-500 sm:text-sm">
                  Position changes only when a real scholarship
                  slot is released.
                </p>
              </div>

              <StatusPill
                meta={{
                  label: `${waiting.length} waiting`,
                  bg: '#FFF7ED',
                  color: '#b45309',
                }}
              />
            </div>

            {waiting.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-200 px-5 py-12 text-center text-sm text-stone-400">
                No applicants are currently waiting for a slot.
              </div>
            ) : (
              <div className="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200">
                {waiting.map((row) => (
                  <div
                    key={row.application_id}
                    className="flex flex-col gap-4 bg-stone-50/40 px-4 py-4 sm:px-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-stone-200 bg-white px-2 text-sm font-bold text-stone-700">
                        {getFcfsLabel(row)}
                      </span>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-900">
                          {row.applicant_name}
                        </p>

                        <p className="mt-1 text-sm text-stone-500">
                          {row.pdm_id} {'·'} Ready{' '}
                          {formatDate(
                            row.fcfs_completed_at
                          )}
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
                      Waiting #
                      {Number(
                        row.waitlist_position || 0
                      ) || '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </CardContent>
      </Card>
    </div>
  );
}


function RegistryTable({
  rows,
  navigate,
  onDownloadSlip,
  onApproveScholar,
  approvalLoadingId = '',
  title = 'Applicant Registry',
  subtitle = 'Current applicants and document status overview',
  mode = 'registry',
  page = 1,
  totalPages = 1,
  totalItems = 0,
  onPrev,
  onNext,
}) {
  const isReadinessMode = mode === 'readiness';

  return (
    <section
      className="overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: C.line }}
    >
      <div className="border-b border-stone-100 px-5 py-4">
        <h2 className="text-base font-semibold text-stone-900">{title}</h2>
        <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
      </div>

      <CardContent className="p-3 sm:p-4">
        {rows.length === 0 ? (
          <div className="py-16 text-center text-sm text-stone-400">
            No applicants found.
          </div>
        ) : (
          <div className="overflow-x-auto overscroll-x-contain [scrollbar-gutter:stable]">
            <table
              className={`w-full border-collapse text-left ${isReadinessMode ? 'min-w-[1680px]' : 'min-w-[1035px]'
                }`}
            >
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50/70">
                  <th className="min-w-[210px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">Applicant</th>
                  <th className="min-w-[135px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">Scholarship</th>
                  <th className="min-w-[170px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">Opening</th>
                  <th className="min-w-[110px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">Submitted</th>
                  <th className="min-w-[130px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">Requirements</th>
                  <th className="min-w-[120px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">Endorsement</th>
                  {isReadinessMode ? (
                    <>
                      <th className="min-w-[80px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">FCFS</th>
                      <th className="min-w-[110px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">Completed</th>
                      <th className="min-w-[165px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">Slip</th>
                      <th className="min-w-[140px] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-stone-700">Ready Status</th>
                    </>
                  ) : null}
                  <th
                    className={`sticky right-0 z-20 border-l border-stone-200 bg-stone-50 px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-stone-700 shadow-[-10px_0_18px_-18px_rgba(28,25,23,0.65)] ${isReadinessMode
                        ? 'w-[390px] min-w-[390px]'
                        : 'w-[160px] min-w-[160px]'
                      }`}
                  >
                    Action
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100 bg-white">
                {rows.map((row) => {
                  const documentsReady =
                    row.documents_ready === true ||
                    Number(row.uploaded_required_count || 0) >= 4;

                  const requirementsMeta = getReadinessMeta(
                    documentsReady,
                    'Documents Ready',
                    'Incomplete'
                  );
                  const endorsementMeta = getReadinessMeta(
                    row.endorsement_complete,
                    'Complete',
                    'Pending'
                  );
                  const readinessMeta = getScholarReadinessMeta(row);

                  return (
                    <tr
                      key={row.application_id}
                      className="group transition-colors hover:bg-stone-50/70"
                    >
                      <td className="px-3 py-3.5 align-top">
                        <div className="max-w-[240px] min-w-0">
                          <p className="truncate text-sm font-semibold leading-5 text-stone-900">
                            {row.applicant_name}
                          </p>
                          <p className="mt-1 font-mono text-xs leading-4 text-stone-500">
                            {row.pdm_id}
                          </p>
                        </div>
                      </td>

                      <td className="px-3 py-3.5 align-top text-sm font-semibold leading-5 text-stone-900">
                        <div className="max-w-[180px] leading-5">{row.program_name}</div>
                      </td>

                      <td className="px-3 py-3.5 align-top text-sm leading-5 text-stone-600">
                        <div className="max-w-[190px] font-medium leading-5 text-stone-700">{row.opening_title}</div>
                        <p className="mt-0.5 text-[11px] text-stone-400">{row.academic_year}</p>
                      </td>

                      <td className="px-3 py-3.5 align-top whitespace-nowrap text-xs font-medium text-stone-700">
                        {formatDate(row.submitted_at)}
                      </td>

                      <td className="px-3 py-3.5 align-top">
                        <StatusPill meta={requirementsMeta} />
                      </td>

                      <td className="px-3 py-3.5 align-top">
                        <StatusPill meta={endorsementMeta} />
                      </td>

                      {isReadinessMode ? (
                        <>
                          <td className="px-3 py-3.5 align-top">
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                              {getFcfsLabel(row)}
                            </span>
                          </td>
                          <td className="px-3 py-3.5 align-top whitespace-nowrap text-xs text-stone-600">
                            {formatDate(row.fcfs_completed_at)}
                          </td>
                          <td className="px-3 py-3.5 align-top">
                            {row.endorsement_slip_id ? (
                              <div className="space-y-2">
                                <p className="font-mono text-[11px] text-stone-600">{row.endorsement_slip_code}</p>
                                <StatusPill
                                  meta={{
                                    label: row.endorsement_current_stage
                                      ? row.endorsement_current_stage.replaceAll('_', ' ')
                                      : 'Slip Available',
                                    bg: '#f5f5f4',
                                    color: '#57534e',
                                  }}
                                />
                              </div>
                            ) : (
                              <span className="text-xs text-stone-400">No slip yet</span>
                            )}
                          </td>
                          <td className="px-3 py-3.5 align-top">
                            <StatusPill meta={readinessMeta} />
                          </td>
                        </>
                      ) : null}

                      <td
                        className={`sticky right-0 z-10 border-l border-stone-100 bg-white px-3 py-3.5 align-top text-center shadow-[-10px_0_18px_-18px_rgba(28,25,23,0.65)] transition-colors group-hover:bg-stone-50 ${isReadinessMode
                            ? 'w-[390px] min-w-[390px]'
                            : 'w-[160px] min-w-[160px]'
                          }`}
                      >
                        <div className="flex w-full flex-wrap justify-center gap-2 xl:flex-nowrap">
                          {isReadinessMode && row.endorsement_slip_id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-lg border-stone-200 px-3.5 text-xs whitespace-nowrap text-stone-700"
                              onClick={() => navigate(`/admin/endorsements/${row.endorsement_slip_id}`)}
                            >
                              View Slip
                            </Button>
                          ) : null}
                          {isReadinessMode && row.endorsement_slip_id ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-9 rounded-lg border-stone-200 px-3.5 text-xs whitespace-nowrap text-stone-700"
                              onClick={() => onDownloadSlip(row)}
                            >
                              <Download className="mr-1.5 h-3.5 w-3.5" />
                              PDF
                            </Button>
                          ) : null}
                          {isReadinessMode ? (
                            <Button
                              size="sm"
                              className="h-9 rounded-lg border-none px-3 text-xs whitespace-nowrap text-white"
                              style={{ background: C.green }}
                              onClick={() => onApproveScholar(row)}
                              disabled={approvalLoadingId === row.application_id}
                            >
                              {approvalLoadingId === row.application_id ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Finalize Scholar
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            className="h-9 rounded-lg border-none px-3 text-xs whitespace-nowrap text-white"
                            style={{ background: C.brownMid }}
                            onClick={() =>
                              navigate(`/admin/applications/${row.application_id}/documents`)
                            }
                          >
                            View Documents
                            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                          </Button>
                        </div>
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
          Showing {totalItems === 0 ? '0-0' : `${(page - 1) * PAGE_SIZE + 1}-${Math.min(page * PAGE_SIZE, totalItems)}`} of {totalItems}
        </p>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={onPrev}
            className="h-8 w-8 rounded-full border-stone-200 text-stone-500 disabled:opacity-50"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-stone-500">Page {page} / {totalPages}</span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={onNext}
            className="h-8 w-8 rounded-full border-stone-200 text-stone-500 disabled:opacity-50"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </section>
  );
}

function Pagination({ page, totalPages, totalItems, onPrev, onNext }) {
  return (
    <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-stone-500">
        Showing {totalItems === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}{'\u2013'}
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
  const location = useLocation();

  const [registryRows, setRegistryRows] = useState([]);
  const [viewType, setViewType] = useState('table');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [openings, setOpenings] = useState([]);
  const [approvalLoadingId, setApprovalLoadingId] = useState('');
  const [activationCandidate, setActivationCandidate] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [readinessSeenSignatures, setReadinessSeenSignatures] = useState(() =>
    readReadinessSeenState()
  );

  useEffect(() => {
    if (!feedback) return undefined;

    const timer = window.setTimeout(() => {
      setFeedback(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    const incoming = location.state?.verificationFeedback;
    if (!incoming) return;

    if (incoming?.tone === 'success') {
      showAppToast('success', incoming.title, incoming.message);
    } else {
      setFeedback(incoming);
    }
    navigate(location.pathname, {
      replace: true,
      state: {
        ...(location.state || {}),
        verificationFeedback: null,
      },
    });
  }, [location.pathname, location.state, navigate]);

  const downloadSlipPdf = async (row) => {
    if (!row?.endorsement_slip_id) return;

    try {
      const response = await fetch(buildApiUrl(`/api/endorsement-slips/${row.endorsement_slip_id}/pdf`), {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
        },
      });

      if (!response.ok) {
        throw new Error(await parseErrorResponse(response, 'Failed to download endorsement slip PDF'));
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${row.endorsement_slip_code || 'endorsement-slip'}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showAppToast(
        'success',
        'Slip download started',
        `${row.endorsement_slip_code || 'Endorsement slip'} is being downloaded.`
      );
    } catch (err) {
      alert(err.message || 'Failed to download endorsement slip PDF');
    }
  };

  const approveScholar = async (row) => {
    try {
      setApprovalLoadingId(row.application_id);
      const response = await fetch(buildApiUrl(`/api/applications/${row.application_id}/approve`), {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(await parseErrorResponse(response, 'Failed to finalize scholar activation'));
      }

      await loadData({ soft: true });
      setActivationCandidate(null);
      showAppToast(
        'success',
        'Scholar activation completed',
        `${row.applicant_name || 'Applicant'} was moved successfully from Readiness to final scholar handling.`
      );
    } catch (err) {
      setFeedback({
        tone: 'error',
        title: 'Scholar activation blocked',
        message: err.message || 'Failed to finalize scholar activation.',
      });
    } finally {
      setApprovalLoadingId('');
    }
  };

  const loadData = async ({ soft = false } = {}) => {
    try {
      if (soft) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError('');
      }

      const token = sessionStorage.getItem('adminToken');

      const [applicationsRes, openingsRes] = await Promise.all([
        fetch(buildApiUrl('/api/applications'), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(buildApiUrl('/api/program-openings'), {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      ]);

      if (!applicationsRes.ok) {
        throw new Error(
          await parseErrorResponse(applicationsRes, 'Failed to fetch applications')
        );
      }

      if (!openingsRes.ok) {
        throw new Error(
          await parseErrorResponse(openingsRes, 'Failed to fetch openings')
        );
      }

      const applicationsData = await applicationsRes.json();
      const openingsPayload = await openingsRes.json();

      const normalizedOpenings = Array.isArray(openingsPayload)
        ? openingsPayload
        : Array.isArray(openingsPayload?.items)
          ? openingsPayload.items
          : Array.isArray(openingsPayload?.data)
            ? openingsPayload.data
            : Array.isArray(openingsPayload?.rows)
              ? openingsPayload.rows
              : [];

      setRegistryRows(
        Array.isArray(applicationsData)
          ? applicationsData.map(normalizeApplicantRow)
          : []
      );

      setOpenings(normalizedOpenings);
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
    // Realtime events are the primary refresh path. This visible-tab fallback
    // only self-heals a temporarily missed socket event.
    const FALLBACK_REFRESH_INTERVAL_MS = 2 * 60 * 1000;

    const refreshIfVisible = () => {
      if (document.visibilityState !== 'visible') return;
      loadData({ soft: true });
    };

    const timer = window.setInterval(
      refreshIfVisible,
      FALLBACK_REFRESH_INTERVAL_MS
    );

    return () => window.clearInterval(timer);
  }, []);

  useSocketEvent('application:updated', () => loadData({ soft: true }), []);
  useSocketEvent('application:approved', () => loadData({ soft: true }), []);
  useSocketEvent('application:rejected', () => loadData({ soft: true }), []);
  useSocketEvent('application-document:uploaded', () => loadData({ soft: true }), []);
  useSocketEvent('application-document:reviewed', () => loadData({ soft: true }), []);
  useSocketEvent('endorsement:updated', () => loadData({ soft: true }), []);

  useEffect(() => {
    setPage(1);
  }, [search, filters, viewType]);

  const openingCards = useMemo(() => {
    return openings.map((opening) => ({
      opening_id: opening.opening_id,
      opening_title: opening.opening_title || opening.title || 'Untitled Opening',
      program_name: opening.program_name || 'No Program',
      academic_year: opening.academic_year || opening.academic_year_label || opening.label || '\u2014',
      posting_status: opening.posting_status || opening.status || 'open',
      allocated_slots: Number(opening.allocated_slots || opening.slot_count || 0),
      filled_slots: Number(opening.filled_slots || 0),
      qualified_count: Number(opening.qualified_count || opening.filled_slots || 0),
    }));
  }, [openings]);

  const academicYearOptions = useMemo(() => {
    const years = [
      ...openingCards.map((item) => item.academic_year),
      ...registryRows.map((item) => item.academic_year),
    ]
      .map((value) => String(value || '').trim())
      .filter((value) => value && value !== '\u2014');

    return [...new Set(years)].sort((a, b) =>
      b.localeCompare(a, undefined, { numeric: true })
    );
  }, [openingCards, registryRows]);

  const openingCountsMap = useMemo(() => {
    const map = new Map();

    registryRows.forEach((row) => {
      if (!row.opening_id) return;

      const current = map.get(row.opening_id) || {
        applicants: 0,
        requirementsComplete: 0,
        endorsementComplete: 0,
        scholarReady: 0,
        fcfsQueued: 0,
        fcfsApplicants: [],
        nextFcfsApplicant: null,
      };
      current.applicants += 1;
      if (row.requirements_complete) current.requirementsComplete += 1;
      if (row.endorsement_complete) current.endorsementComplete += 1;
      if (row.scholar_activation_ready) current.scholarReady += 1;
      if (row.scholar_activation_ready && (row.fcfs_completed_at || Number(row.queue_position) > 0)) {
        current.fcfsQueued += 1;
        current.fcfsApplicants.push(row);
        current.fcfsApplicants.sort(compareFcfs);
        current.nextFcfsApplicant = current.fcfsApplicants[0] || null;
      }
      map.set(row.opening_id, current);
    });

    return map;
  }, [registryRows]);

  const filteredOpeningCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    const normalizedQ = q.replace(/[^a-z0-9]/g, '');

    return openingCards.filter((opening) => {
      const openingGroup = getOpeningGroup(opening.posting_status);

      const matchesSearch =
        !q ||
        (opening.opening_title || '').toLowerCase().includes(q) ||
        (opening.program_name || '').toLowerCase().includes(q) ||
        (opening.academic_year || '').toLowerCase().includes(q);

      const matchesAcademicYear =
        filters.academicYear === 'all' ||
        String(opening.academic_year || '') === String(filters.academicYear);

      const matchesOpening =
        filters.openingStatus === 'all' ||
        filters.openingStatus === openingGroup;

      return matchesSearch && matchesAcademicYear && matchesOpening;
    });
  }, [openingCards, search, filters]);

  const filteredRegistryRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const normalizedPdmQuery = normalizePdmSearchValue(search);

    return registryRows.filter((row) => {
      const applicationGroup = getStatusGroup(row.application_status);
      const documentGroup = getDocumentGroup(row.document_status);
      const pdmId = String(row.pdm_id || '').toLowerCase();
      const normalizedPdmId = normalizePdmSearchValue(row.pdm_id);

      const matchesPdmId =
        pdmId.includes(q) ||
        (
          normalizedPdmQuery.length > 0 &&
          normalizedPdmId.includes(normalizedPdmQuery)
        );

      const matchesSearch =
        !q ||
        (row.applicant_name || '').toLowerCase().includes(q) ||
        matchesPdmId ||
        (row.program_name || '').toLowerCase().includes(q) ||
        (row.application_status || '').toLowerCase().includes(q) ||
        (row.document_status || '').toLowerCase().includes(q) ||
        (row.opening_title || '').toLowerCase().includes(q) ||
        (row.academic_year || '').toLowerCase().includes(q);

      const matchesAcademicYear =
        filters.academicYear === 'all' ||
        String(row.academic_year || '') === String(filters.academicYear);

      const matchesApplication =
        filters.applicationStatus === 'all' ||
        filters.applicationStatus === applicationGroup;

      const matchesDocument =
        filters.documentStatus === 'all' ||
        filters.documentStatus === documentGroup;

      return (
        matchesSearch &&
        matchesAcademicYear &&
        matchesApplication &&
        matchesDocument
      );
    });
  }, [registryRows, search, filters]);

  const isReadyForScholarHandling = (row) => {
    const status = normalizeStatus(row.selection_status);
    const isQueueStatus = ['reserved', 'promoted', 'waitlisted'].includes(status);
    const hasFcfsRank = Number(row.queue_position || 0) > 0 && Boolean(row.fcfs_completed_at);
    const isApproved = normalizeStatus(row.application_status) === 'approved';

    return (
      row.requirements_complete === true &&
      row.endorsement_complete === true &&
      hasFcfsRank &&
      isQueueStatus &&
      !isApproved
    );
  };

  const pendingRegistryRows = useMemo(
    () => filteredRegistryRows.filter((row) => !isReadyForScholarHandling(row)),
    [filteredRegistryRows]
  );

  const allReadinessRows = useMemo(
    () => registryRows.filter(isReadyForScholarHandling).sort(compareFcfs),
    [registryRows]
  );

  const readinessRows = useMemo(
    () =>
      filteredRegistryRows
        .filter(isReadyForScholarHandling)
        .sort(compareFcfs),
    [filteredRegistryRows]
  );

  const readinessAttentionSignatures = useMemo(() => {
    const grouped = new Map();

    allReadinessRows.forEach((row) => {
      const openingId = String(row.opening_id || '');
      if (!openingId) return;
      if (!grouped.has(openingId)) grouped.set(openingId, []);
      grouped.get(openingId).push(row);
    });

    return new Map(
      [...grouped.entries()].map(([openingId, rows]) => [
        openingId,
        buildReadinessOpeningSignature(rows),
      ])
    );
  }, [allReadinessRows]);

  const unseenReadinessOpeningIds = useMemo(() => {
    return new Set(
      [...readinessAttentionSignatures.entries()]
        .filter(([openingId, signature]) =>
          readinessSeenSignatures[openingId] !== signature
        )
        .map(([openingId]) => openingId)
    );
  }, [readinessAttentionSignatures, readinessSeenSignatures]);

  const markReadinessOpeningSeen = (openingId) => {
    const key = String(openingId || '');
    const signature = readinessAttentionSignatures.get(key);
    if (!key || !signature) return;

    setReadinessSeenSignatures((current) => {
      if (current[key] === signature) return current;
      const next = { ...current, [key]: signature };
      writeReadinessSeenState(next);
      return next;
    });
  };

  const hasNeedsAttention = unseenReadinessOpeningIds.size > 0;

  const tableTotalPages = Math.max(1, Math.ceil(pendingRegistryRows.length / PAGE_SIZE));
  const cardsTotalPages = Math.max(1, Math.ceil(filteredOpeningCards.length / PAGE_SIZE));
  const readinessTotalPages = Math.max(1, Math.ceil(readinessRows.length / PAGE_SIZE));

  const tablePageData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return pendingRegistryRows.slice(start, start + PAGE_SIZE);
  }, [pendingRegistryRows, page]);

  const cardsPageData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredOpeningCards.slice(start, start + PAGE_SIZE);
  }, [filteredOpeningCards, page]);

  const readinessPageData = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return readinessRows.slice(start, start + PAGE_SIZE);
  }, [readinessRows, page]);

  const applyFilters = () => setFilters(draftFilters);

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setDraftFilters(DEFAULT_FILTERS);
  };

  if (loading) {
    return <PageLoadingSkeleton label="Loading application review" showStats />;
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
    <div className="dark-mode-route-canvas space-y-3 py-2" style={{ background: C.bg }}>
      <Dialog
        open={Boolean(activationCandidate)}
        onOpenChange={(open) => {
          if (!open && !approvalLoadingId) setActivationCandidate(null);
        }}
      >
        <DialogContent className="sm:max-w-xl rounded-2xl border-stone-200 p-0">
          <DialogHeader className="border-b border-stone-100 px-5 py-4 text-left sm:px-6">
            <DialogTitle className="text-lg">Confirm scholar activation</DialogTitle>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              Activate {activationCandidate?.applicant_name || 'this applicant'} only after the system passes every final check.
            </p>
          </DialogHeader>
          <div className="space-y-2.5 px-5 py-4 sm:px-6">
            {[
              'All required documents are uploaded and verified',
              'SDO, Guidance, and Program Director endorsement is complete',
              'The scholarship opening still has an available slot',
              'The student has no other active scholar record',
            ].map((label) => (
              <div key={label} className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm text-stone-700">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                {label}
              </div>
            ))}
          </div>
          <DialogFooter className="border-t border-stone-100 px-5 py-3 sm:px-6">
            <Button variant="outline" disabled={Boolean(approvalLoadingId)} onClick={() => setActivationCandidate(null)}>
              Cancel
            </Button>
            <Button
              className="text-white"
              style={{ background: C.green }}
              disabled={!activationCandidate || Boolean(approvalLoadingId)}
              onClick={() => approveScholar(activationCandidate)}
            >
              {approvalLoadingId ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Activate Scholar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {feedback ? (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-4 text-red-900 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-red-100 p-2 text-red-700">
                <X className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{feedback.title}</p>
                <p className="mt-1 text-sm opacity-90">{feedback.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-current/15 bg-white/70 transition hover:bg-white"
              title="Dismiss message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <Toolbar
        search={search}
        setSearch={setSearch}
        viewType={viewType}
        setViewType={setViewType}
        hasNeedsAttention={hasNeedsAttention}
        refreshing={refreshing}
        onRefresh={() => loadData({ soft: true })}
        academicYearOptions={academicYearOptions}
        filters={filters}
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        onApplyFilters={applyFilters}
        onClearFilters={clearFilters}
      />

      {viewType === 'cards' ? (
        filteredOpeningCards.length === 0 ? (
          <Card className="rounded-2xl border-stone-200 shadow-none">
            <CardContent className="py-16 text-center text-sm text-stone-400">
              No openings found.
            </CardContent>
          </Card>
        ) : (
          <>
            <OpeningsGrid
              rows={cardsPageData}
              countsMap={openingCountsMap}
              navigate={navigate}
              unseenOpeningIds={unseenReadinessOpeningIds}
              onOpeningViewed={markReadinessOpeningSeen}
            />

            <Pagination
              page={page}
              totalPages={cardsTotalPages}
              totalItems={filteredOpeningCards.length}
              onPrev={() => setPage((p) => Math.max(1, p - 1))}
              onNext={() => setPage((p) => Math.min(cardsTotalPages, p + 1))}
            />
          </>
        )
      ) : viewType === 'action' ? (
        <ReadinessOpeningCards
          openings={openingCards}
          rows={readinessRows}
          navigate={navigate}
          onDownloadSlip={downloadSlipPdf}
          onApproveScholar={setActivationCandidate}
          approvalLoadingId={approvalLoadingId}
          unseenOpeningIds={unseenReadinessOpeningIds}
          onOpeningViewed={markReadinessOpeningSeen}
        />
      ) : pendingRegistryRows.length === 0 ? (
        <Card className="rounded-2xl border-stone-200 shadow-none">
          <CardContent className="py-16 text-center text-sm text-stone-400">
            No applicants found.
          </CardContent>
        </Card>
      ) : (
        <>
          <RegistryTable
            rows={tablePageData}
            navigate={navigate}
            onDownloadSlip={downloadSlipPdf}
            onApproveScholar={setActivationCandidate}
            approvalLoadingId={approvalLoadingId}
            title="Applicant Registry"
            subtitle="Applicants with incomplete documents or pending endorsement before moving to readiness."
            mode="registry"
            page={page}
            totalPages={tableTotalPages}
            totalItems={pendingRegistryRows.length}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(tableTotalPages, p + 1))}
          />
        </>
      )}
    </div>
  );
}
