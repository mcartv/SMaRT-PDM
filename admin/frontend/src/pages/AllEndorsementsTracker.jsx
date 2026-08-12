import { createElement, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Ban, CheckCircle2, ClipboardCheck, Eye, Loader2, RefreshCw, Search } from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import EndorsementProgressTracker from '@/components/endorsement/EndorsementProgressTracker';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';

function buildHeaders(tokenStorageKey) {
  return {
    Authorization: `Bearer ${sessionStorage.getItem(tokenStorageKey)}`,
    'Content-Type': 'application/json',
  };
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatStatus(value = '') {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || 'Pending';
}

const STATUS_TONE = {
  completed: 'bg-green-50 text-green-700',
  pending_sdo: 'bg-orange-50 text-orange-700',
  pending_guidance: 'bg-blue-50 text-blue-700',
  pending_pd: 'bg-violet-50 text-violet-700',
  disqualified_major: 'bg-red-50 text-red-700',
  held: 'bg-amber-50 text-amber-700',
  rejected: 'bg-red-50 text-red-700',
  guidance_rejected: 'bg-red-50 text-red-700',
};

const FINISHED_STATUSES = new Set([
  'completed',
  'disqualified_major',
  // Legacy historical states remain visible during the compatibility window.
  'rejected',
  'guidance_rejected',
]);

const STOPPED_STATUSES = new Set([
  'disqualified_major',
  'rejected',
  'guidance_rejected',
]);

function getActiveRowsForOffice(rows, tokenStorageKey) {
  if (tokenStorageKey === 'sdoToken') {
    return rows.filter((row) => row.current_stage === 'pending_sdo');
  }

  if (tokenStorageKey === 'guidanceToken') {
    return rows.filter((row) => row.current_stage === 'pending_guidance');
  }

  if (tokenStorageKey === 'pdToken') {
    return rows.filter((row) => row.current_stage === 'pending_pd');
  }

  return rows.filter((row) => !FINISHED_STATUSES.has(row.overall_status));
}

function getOfficeConfig(tokenStorageKey) {
  if (tokenStorageKey === 'sdoToken') {
    return {
      eyebrow: 'Student Discipline Office',
      shortLabel: 'SDO',
      stage: 'pending_sdo',
      resultKey: 'sdo',
      processedLabel: 'Processed by SDO',
      processedDescription: 'Applicants already endorsed by SDO and routed forward or stopped for a major offense.',
    };
  }

  if (tokenStorageKey === 'guidanceToken') {
    return {
      eyebrow: 'Guidance Office',
      shortLabel: 'Guidance',
      stage: 'pending_guidance',
      resultKey: 'guidance',
      processedLabel: 'Processed by Guidance',
      processedDescription: 'Applicants already certified for Good Moral Standing and routed to the Program Director.',
    };
  }

  if (tokenStorageKey === 'pdToken') {
    return {
      eyebrow: 'Program Director',
      shortLabel: 'PD',
      stage: 'pending_pd',
      resultKey: 'pd',
      processedLabel: 'Processed by Program Director',
      processedDescription: 'Applicants already assigned a Good or Average Scholastic Standing result.',
    };
  }

  return null;
}

function getAdminRowsForMode(rows, viewMode) {
  switch (viewMode) {
    case 'sdo':
      return rows.filter((row) => row.current_stage === 'pending_sdo');
    case 'guidance':
      return rows.filter((row) => row.current_stage === 'pending_guidance');
    case 'pd':
      return rows.filter((row) => row.current_stage === 'pending_pd');
    case 'completed':
      return rows.filter((row) => row.overall_status === 'completed');
    case 'stopped':
      return rows.filter((row) => STOPPED_STATUSES.has(row.overall_status));
    case 'active':
    default:
      return rows.filter((row) => !FINISHED_STATUSES.has(row.overall_status));
  }
}

export default function AllEndorsementsTracker({
  tokenStorageKey = 'adminToken',
  detailBasePath,
  title = 'All Applicants Tracker',
  subtitle = 'View every endorsement slip and where it currently is in the workflow.',
}) {
  const navigate = useNavigate();
  const isAdminView = tokenStorageKey === 'adminToken';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('active');

  const loadRows = useCallback(async ({ soft = false } = {}) => {
    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError('');

      const response = await fetch(buildApiUrl('/api/endorsement-slips?scope=all'), {
        headers: buildHeaders(tokenStorageKey),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load endorsement tracker');
      }

      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load endorsement tracker.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tokenStorageKey]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadRows({ soft: true });
    }, 8000);

    return () => window.clearInterval(timer);
  }, [loadRows]);

  useSocketEvent(
    'endorsement:updated',
    () => {
      loadRows({ soft: true });
    },
    [loadRows]
  );

  const officeConfig = getOfficeConfig(tokenStorageKey);

  const sourceRows = useMemo(() => {
    if (isAdminView) {
      return getAdminRowsForMode(rows, viewMode);
    }

    if (viewMode === 'finished') {
      return rows.filter((row) => FINISHED_STATUSES.has(row.overall_status));
    }

    return getActiveRowsForOffice(rows, tokenStorageKey);
  }, [isAdminView, rows, tokenStorageKey, viewMode]);

  const officeProcessedRows = useMemo(() => {
    if (isAdminView || !officeConfig || viewMode !== 'active') return [];

    return rows.filter((row) => {
      const hasOfficeDecision = Boolean(row.office_results?.[officeConfig.resultKey]);
      return hasOfficeDecision && row.current_stage !== officeConfig.stage;
    });
  }, [isAdminView, officeConfig, rows, viewMode]);

  const statuses = useMemo(() => {
    const source = [...sourceRows, ...officeProcessedRows];
    return ['all', ...new Set(source.map((row) => row.overall_status).filter(Boolean))];
  }, [officeProcessedRows, sourceRows]);

  const filterRows = useCallback((list) => {
    const query = search.trim().toLowerCase();

    return list.filter((row) => {
      const matchesSearch =
        !query ||
        (row.student_name || '').toLowerCase().includes(query) ||
        (row.pdm_id || '').toLowerCase().includes(query) ||
        (row.program_name || '').toLowerCase().includes(query) ||
        (row.opening_title || '').toLowerCase().includes(query) ||
        (row.current_stage_label || '').toLowerCase().includes(query);

      const matchesStatus = statusFilter === 'all' || row.overall_status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const filteredRows = useMemo(
    () => filterRows(sourceRows),
    [filterRows, sourceRows]
  );

  const filteredOfficeProcessedRows = useMemo(
    () => filterRows(officeProcessedRows),
    [filterRows, officeProcessedRows]
  );

  const summary = useMemo(
    () => ({
      active: rows.filter((row) => !FINISHED_STATUSES.has(row.overall_status)).length,
      sdo: rows.filter((row) => row.current_stage === 'pending_sdo').length,
      guidance: rows.filter((row) => row.current_stage === 'pending_guidance').length,
      pd: rows.filter((row) => row.current_stage === 'pending_pd').length,
      completed: rows.filter((row) => row.overall_status === 'completed').length,
      stopped: rows.filter((row) => STOPPED_STATUSES.has(row.overall_status)).length,
      processedByOffice: officeProcessedRows.length,
    }),
    [officeProcessedRows.length, rows]
  );

  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setStatusFilter('all');
  };

  const viewOptions = isAdminView
    ? [
      { value: 'active', label: 'In Progress', count: summary.active },
      { value: 'sdo', label: 'SDO Review', count: summary.sdo },
      { value: 'guidance', label: 'Guidance Review', count: summary.guidance },
      { value: 'pd', label: 'PD Review', count: summary.pd },
      { value: 'completed', label: 'Completed', count: summary.completed },
      { value: 'stopped', label: 'Stopped', count: summary.stopped },
    ]
    : [
      { value: 'active', label: 'Active Applicants' },
      { value: 'finished', label: 'Finished' },
    ];

  const officeRoleLabel = officeConfig?.shortLabel || 'Office';
  const officeSummaryCards = [
    {
      label: `Pending ${officeRoleLabel}`,
      value: getActiveRowsForOffice(rows, tokenStorageKey).length,
      icon: ClipboardCheck,
      tone: 'bg-violet-50 text-violet-700',
    },
    {
      label: `Processed by ${officeRoleLabel}`,
      value: summary.processedByOffice,
      icon: CheckCircle2,
      tone: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'Completed',
      value: summary.completed,
      icon: CheckCircle2,
      tone: 'bg-green-50 text-green-700',
    },
    ...(tokenStorageKey === 'sdoToken'
      ? [
        {
          label: 'Major Offenses',
          value: summary.stopped,
          icon: Ban,
          tone: 'bg-red-50 text-red-700',
        },
      ]
      : []),
  ];

  if (loading) {
    return <PageLoadingSkeleton label="Loading endorsement tracker" showStats />;
  }

  return (
    <div className="space-y-3 py-1.5">
      {!isAdminView ? (
        <section className="rounded-2xl border border-stone-200 bg-white px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
            {officeConfig?.eyebrow || 'Endorsement Office'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-stone-900">{title}</h1>
          <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
        </section>
      ) : null}

      {isAdminView ? (
        <Card className="border-stone-200 bg-white shadow-none">
          <CardContent className="p-3">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by student, PDM ID, program, opening, or current office"
                  className="h-9 pl-9 text-sm"
                />
              </div>

              <Select value={viewMode} onValueChange={handleViewModeChange}>
                <SelectTrigger className="h-9 w-full text-sm lg:w-52">
                  <SelectValue placeholder="Filter by workflow" />
                </SelectTrigger>
                <SelectContent>
                  {viewOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                      {Number.isFinite(option.count) ? ` (${option.count})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-full text-sm lg:w-56">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === 'all' ? 'All Statuses' : formatStatus(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0 border-stone-200 px-3 text-xs"
                onClick={() => loadRows({ soft: true })}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>

            {error ? (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-stone-200 shadow-none">
          <CardHeader className="space-y-2.5 border-b border-stone-100 bg-stone-50/60 px-4 py-3">
            <div
              className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${officeSummaryCards.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'
                }`}
            >
              {officeSummaryCards.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white px-3 py-2.5"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.tone}`}
                  >
                    {createElement(item.icon, { className: 'h-4 w-4' })}
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xl font-semibold text-stone-900">
                      {item.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by student, PDM ID, program, opening, or current office"
                  className="h-9 pl-9 text-sm"
                />
              </div>

              <Select value={viewMode} onValueChange={handleViewModeChange}>
                <SelectTrigger className="h-9 w-full text-sm lg:w-52">
                  <SelectValue placeholder="Filter by workflow" />
                </SelectTrigger>
                <SelectContent>
                  {viewOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                      {Number.isFinite(option.count) ? ` (${option.count})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-full text-sm lg:w-56">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status === 'all' ? 'All Statuses' : formatStatus(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="h-9 shrink-0 border-stone-200 px-3 text-xs"
                onClick={() => loadRows({ soft: true })}
                disabled={refreshing}
              >
                {refreshing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh
              </Button>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </CardHeader>
        </Card>
      )}

      <Card className="border-stone-200 bg-white shadow-none">
        <CardContent className="p-3">
          {filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 px-5 py-10 text-center text-sm text-stone-500">
              No endorsement records match the current view and filters.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {filteredRows.map((row) => (
                <div
                  key={row.slip_id}
                  className="rounded-xl border border-stone-200 bg-white p-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-stone-900">
                          {row.student_name}
                        </p>

                        <Badge
                          className={
                            STATUS_TONE[row.overall_status] ||
                            'bg-stone-100 text-stone-700'
                          }
                        >
                          {row.overall_status_label ||
                            formatStatus(row.overall_status)}
                        </Badge>

                        {(row.current_stage_label ||
                          formatStatus(row.current_stage)) !==
                          (row.overall_status_label ||
                            formatStatus(row.overall_status)) ? (
                          <Badge
                            variant="outline"
                            className="border-stone-200 bg-white text-stone-600"
                          >
                            {row.current_stage_label ||
                              formatStatus(row.current_stage)}
                          </Badge>
                        ) : null}

                        {row.slip_code ? (
                          <Badge
                            variant="outline"
                            className="border-stone-200 font-mono text-[11px] text-stone-500"
                          >
                            {row.slip_code}
                          </Badge>
                        ) : null}
                      </div>

                      <p className="text-sm text-stone-600">
                        {row.pdm_id || 'No PDM ID'} •{' '}
                        {row.program_name ||
                          row.opening_title ||
                          'Program not set'}
                      </p>

                      <p className="text-xs text-stone-500">
                        Submitted: {formatDate(row.submitted_at)}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 shrink-0 rounded-lg border-blue-200 bg-blue-50 px-3 font-medium text-blue-800 hover:bg-blue-100"
                      onClick={() =>
                        navigate(`${detailBasePath}/${row.slip_id}`)
                      }
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      {isAdminView ? 'Monitor Slip' : 'View Slip'}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-3 rounded-xl bg-stone-50 px-3 py-2.5">
                    <EndorsementProgressTracker
                      tracker={row.tracker}
                      compact
                      className="space-y-2"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isAdminView && viewMode === 'active' && officeConfig ? (
            <div className="mt-4 space-y-4 border-t border-stone-100 pt-5">
              <div>
                <h2 className="text-base font-semibold text-stone-900">
                  {officeConfig.processedLabel}
                </h2>
                <p className="text-sm text-stone-500">
                  {officeConfig.processedDescription}
                </p>
              </div>

              {filteredOfficeProcessedRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-200 px-5 py-8 text-center text-sm text-stone-500">
                  No processed applicants match the current filters.
                </div>
              ) : (
                filteredOfficeProcessedRows.map((row) => (
                  <div
                    key={`processed-${row.slip_id}`}
                    className="rounded-xl border border-stone-200 bg-stone-50/70 p-3"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-stone-900">
                            {row.student_name}
                          </p>

                          <Badge
                            className={
                              STATUS_TONE[row.overall_status] ||
                              'bg-stone-100 text-stone-700'
                            }
                          >
                            {row.overall_status_label ||
                              formatStatus(row.overall_status)}
                          </Badge>
                        </div>

                        <p className="text-sm text-stone-600">
                          {row.pdm_id || 'No PDM ID'} •{' '}
                          {row.program_name ||
                            row.opening_title ||
                            'Program not set'}
                        </p>

                        <p className="text-xs text-stone-500">
                          Current stage:{' '}
                          {row.current_stage_label ||
                            formatStatus(row.current_stage)}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-lg border-blue-200 bg-blue-50 px-3 font-medium text-blue-800 hover:bg-blue-100"
                        onClick={() =>
                          navigate(`${detailBasePath}/${row.slip_id}`)
                        }
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View Slip
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}