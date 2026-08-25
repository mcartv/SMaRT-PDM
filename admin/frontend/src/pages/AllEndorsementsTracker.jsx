import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Eye, Loader2, RefreshCw, Search } from 'lucide-react';
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

const STATUS_TONE = {
  completed: 'bg-green-50 text-green-700',
  pending_sdo: 'bg-orange-50 text-orange-700',
  pending_guidance: 'bg-blue-50 text-blue-700',
  pending_pd: 'bg-violet-50 text-violet-700',
  held: 'bg-amber-50 text-amber-700',
  rejected: 'bg-red-50 text-red-700',
  disqualified_minor: 'bg-amber-50 text-amber-700',
  disqualified_major: 'bg-red-50 text-red-700',
};

const FINISHED_STATUSES = new Set([
  'completed',
  'rejected',
  'guidance_rejected',
  'disqualified_major',
]);

const READY_FOR_PD_STATUSES = new Set(['pending_pd']);

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
      stage: 'pending_sdo',
      resultKey: 'sdo',
      processedLabel: 'Cleared / Routed by SDO',
      processedDescription: 'Applicants already handled by SDO and moved out of the active queue.',
    };
  }

  if (tokenStorageKey === 'guidanceToken') {
    return {
      stage: 'pending_guidance',
      resultKey: 'guidance',
      processedLabel: 'Processed by Guidance',
      processedDescription: 'Applicants already handled by Guidance and moved out of the active queue.',
    };
  }

  if (tokenStorageKey === 'pdToken') {
    return {
      stage: 'pending_pd',
      resultKey: 'pd',
      processedLabel: 'Processed by Program Director',
      processedDescription: 'Applicants already handled by Program Director and moved out of the active queue.',
    };
  }

  return null;
}

export default function AllEndorsementsTracker({
  tokenStorageKey = 'adminToken',
  detailBasePath,
  title = 'All Applicants Tracker',
  subtitle = 'View every endorsement slip and where it currently is in the workflow.',
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('active');

  const loadRows = async ({ soft = false } = {}) => {
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
  };

  useEffect(() => {
    loadRows();
  }, [tokenStorageKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadRows({ soft: true });
    }, 8000);

    return () => window.clearInterval(timer);
  }, [tokenStorageKey]);

  useSocketEvent(
    'endorsement:updated',
    () => {
      loadRows({ soft: true });
    },
    [tokenStorageKey]
  );

  const filteredSourceRows = useMemo(() => {
    if (viewMode === 'ready_pd') {
      return rows.filter((row) => READY_FOR_PD_STATUSES.has(row.current_stage));
    }

    if (viewMode === 'finished') {
      return rows.filter((row) => FINISHED_STATUSES.has(row.overall_status));
    }

    return getActiveRowsForOffice(rows, tokenStorageKey);
  }, [rows, tokenStorageKey, viewMode]);

  const officeProcessedRows = useMemo(() => {
    const officeConfig = getOfficeConfig(tokenStorageKey);

    if (!officeConfig || viewMode !== 'active') {
      return [];
    }

    return rows.filter((row) => {
      const hasOfficeDecision = Boolean(row.office_results?.[officeConfig.resultKey]);
      return hasOfficeDecision && row.current_stage !== officeConfig.stage;
    });
  }, [rows, tokenStorageKey, viewMode]);

  const filteredOfficeProcessedRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return officeProcessedRows.filter((row) => {
      const matchesSearch =
        !query ||
        (row.student_name || '').toLowerCase().includes(query) ||
        (row.pdm_id || '').toLowerCase().includes(query) ||
        (row.program_name || '').toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'all' || row.overall_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [officeProcessedRows, search, statusFilter]);

  const statuses = useMemo(() => {
    const source =
      viewMode === 'active' && officeProcessedRows.length
        ? [...filteredSourceRows, ...officeProcessedRows]
        : filteredSourceRows;

    return ['all', ...new Set(source.map((row) => row.overall_status).filter(Boolean))];
  }, [filteredSourceRows, officeProcessedRows, viewMode]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return filteredSourceRows.filter((row) => {
      const matchesSearch =
        !query ||
        (row.student_name || '').toLowerCase().includes(query) ||
        (row.pdm_id || '').toLowerCase().includes(query) ||
        (row.program_name || '').toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'all' || row.overall_status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [filteredSourceRows, search, statusFilter]);

  const trackerSummary = useMemo(
    () => ({
      active: getActiveRowsForOffice(rows, tokenStorageKey).length,
      processed: viewMode === 'active' ? officeProcessedRows.length : 0,
      finished: rows.filter((row) => FINISHED_STATUSES.has(row.overall_status)).length,
      completed: rows.filter((row) => row.overall_status === 'completed').length,
      rejected: rows.filter((row) => ['rejected', 'guidance_rejected', 'disqualified_major'].includes(row.overall_status)).length,
      readyForPD: rows.filter((row) => row.current_stage === 'pending_pd').length,
      visible: filteredRows.length + filteredOfficeProcessedRows.length,
    }),
    [rows, filteredRows, filteredOfficeProcessedRows, officeProcessedRows, tokenStorageKey, viewMode]
  );

  const officeConfig = getOfficeConfig(tokenStorageKey);

  if (loading) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-stone-400" />
        <p className="text-sm text-stone-500">Loading endorsement tracker...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{title}</h1>
          <p className="mt-1 text-sm text-stone-500">{subtitle}</p>
        </div>
        <Button variant="outline" className="border-stone-200" onClick={() => loadRows({ soft: true })}>
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <Card className="border-stone-200 shadow-none">
        <CardHeader className="space-y-3 border-b border-stone-100 bg-stone-50/60 px-5 py-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: 'Visible Slips', value: trackerSummary.visible },
              { label: 'Active', value: trackerSummary.active },
              {
                label: officeConfig && viewMode === 'active' ? 'Processed by Office' : 'Completed',
                value: officeConfig && viewMode === 'active' ? trackerSummary.processed : trackerSummary.completed,
              },
              { label: 'Rejected / Stopped', value: trackerSummary.rejected },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">{item.label}</p>
                <p className="mt-2 text-xl font-semibold text-stone-900">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setViewMode('active');
                setStatusFilter('all');
              }}
              className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition ${
                viewMode === 'active'
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              Active Applicants
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('ready_pd');
                setStatusFilter('all');
              }}
              className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition ${
                viewMode === 'ready_pd'
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              Waiting for PD
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('finished');
                setStatusFilter('all');
              }}
              className={`inline-flex h-9 items-center rounded-full border px-4 text-sm font-medium transition ${
                viewMode === 'finished'
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
              }`}
            >
              Completed / Rejected
            </button>
            <span className="text-xs text-stone-500">
              {viewMode === 'active'
                ? tokenStorageKey === 'sdoToken'
                  ? 'Applicants currently waiting for SDO endorsement.'
                  : tokenStorageKey === 'guidanceToken'
                    ? 'Applicants currently waiting for Guidance endorsement.'
                    : tokenStorageKey === 'pdToken'
                      ? 'Applicants currently waiting for Program Director endorsement.'
                      : 'Current endorsement applicants still moving through SDO, Guidance, or PD.'
                : viewMode === 'ready_pd'
                  ? 'Applicants already forwarded and currently waiting for Program Director review.'
                  : 'Applicants with finished endorsement outcomes.'}
            </span>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by student, PDM ID, or program"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-64">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status === 'all' ? 'All Statuses' : status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          {filteredRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-200 px-5 py-10 text-center text-sm text-stone-500">
              {viewMode === 'active'
                ? tokenStorageKey === 'sdoToken'
                  ? 'No applicants are currently waiting in SDO.'
                  : tokenStorageKey === 'guidanceToken'
                    ? 'No applicants are currently waiting in Guidance.'
                    : tokenStorageKey === 'pdToken'
                      ? 'No applicants are currently waiting in Program Director.'
                      : 'No active applicants match the current filters.'
                : viewMode === 'ready_pd'
                  ? 'No applicants are currently waiting for PD.'
                  : 'No completed or rejected applicants match the current filters.'}
            </div>
          ) : (
            filteredRows.map((row) => (
              <div
                key={row.slip_id}
                className="rounded-2xl border border-stone-200 bg-white p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-stone-900">{row.student_name}</p>
                      <Badge className={STATUS_TONE[row.overall_status] || 'bg-stone-100 text-stone-700'}>
                        {row.overall_status_label}
                      </Badge>
                      {row.slip_code ? (
                        <Badge variant="outline" className="border-stone-200 font-mono text-[11px] text-stone-500">
                          {row.slip_code}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-stone-600">
                      {row.pdm_id} - {row.program_name}
                    </p>
                    <p className="text-xs text-stone-500">Submitted: {formatDate(row.submitted_at)}</p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 rounded-xl border-blue-200 bg-blue-50 px-4 font-medium text-blue-800 hover:bg-blue-100"
                      onClick={() => navigate(`${detailBasePath}/${row.slip_id}`)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Slip
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-3">
                  <EndorsementProgressTracker
                    tracker={row.tracker}
                    compact
                    className="space-y-2"
                  />
                </div>
              </div>
            ))
          )}

          {viewMode === 'active' && officeConfig ? (
            <div className="space-y-4 border-t border-stone-100 pt-5">
              <div className="flex flex-col gap-1">
                <h2 className="text-base font-semibold text-stone-900">{officeConfig.processedLabel}</h2>
                <p className="text-sm text-stone-500">{officeConfig.processedDescription}</p>
              </div>

              {filteredOfficeProcessedRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-200 px-5 py-8 text-center text-sm text-stone-500">
                  No processed applicants match the current filters.
                </div>
              ) : (
                filteredOfficeProcessedRows.map((row) => (
                  <div
                    key={`processed-${row.slip_id}`}
                    className="rounded-2xl border border-stone-200 bg-stone-50/70 p-4"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-base font-semibold text-stone-900">{row.student_name}</p>
                          <Badge className={STATUS_TONE[row.overall_status] || 'bg-stone-100 text-stone-700'}>
                            {row.overall_status_label}
                          </Badge>
                          {row.slip_code ? (
                            <Badge variant="outline" className="border-stone-200 font-mono text-[11px] text-stone-500">
                              {row.slip_code}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-sm text-stone-600">
                          {row.pdm_id} - {row.program_name}
                        </p>
                        <p className="text-xs text-stone-500">
                          Latest stage: {row.current_stage_label || row.overall_status_label || 'Processed'}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10 rounded-xl border-blue-200 bg-blue-50 px-4 font-medium text-blue-800 hover:bg-blue-100"
                          onClick={() => navigate(`${detailBasePath}/${row.slip_id}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View Slip
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
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
