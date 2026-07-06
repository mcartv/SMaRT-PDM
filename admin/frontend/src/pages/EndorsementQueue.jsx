import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Eye,
  FileText,
  Hourglass,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import EndorsementProgressTracker from '@/components/endorsement/EndorsementProgressTracker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const QUEUE_META = {
  pd: {
    title: 'Program Director Queue',
    subtitle: 'Finalize applicants already cleared by SDO and Guidance.',
    endpoint: '/api/endorsement-slips/pd',
    actionEndpoint: (slipId) => `/api/endorsement-slips/${slipId}/pd-action`,
    allowedRoles: ['pd', 'admin'],
  },
  guidance: {
    title: 'Guidance Queue',
    subtitle: 'Review applicants already cleared by SDO before they proceed to Program Director, are held for counseling, or are rejected.',
    endpoint: '/api/endorsement-slips/guidance',
    actionEndpoint: (slipId) => `/api/endorsement-slips/${slipId}/guidance-action`,
    allowedRoles: ['guidance', 'admin'],
  },
  sdo: {
    title: 'SDO Queue',
    subtitle: 'Start the endorsement flow and record no offense, minor offense, or major offense findings.',
    endpoint: '/api/endorsement-slips/sdo',
    actionEndpoint: (slipId) => `/api/endorsement-slips/${slipId}/sdo-action`,
    allowedRoles: ['sdo', 'admin'],
  },
};

const SDO_STANDARD_REASONS = {
  clear: 'No record - cleared.',
  disqualify_minor: 'Minor offense noted and forwarded to Guidance.',
  disqualify_major: 'Major offense - disqualified.',
};

const STAGE_TONE = {
  pending_pd: 'bg-amber-50 text-amber-700',
  pending_guidance: 'bg-blue-50 text-blue-700',
  pending_sdo: 'bg-orange-50 text-orange-700',
  completed: 'bg-green-50 text-green-700',
  held: 'bg-amber-100 text-amber-800',
  disqualified_minor: 'bg-amber-100 text-amber-800',
  disqualified_major: 'bg-red-100 text-red-800',
  rejected: 'bg-red-100 text-red-800',
  guidance_rejected: 'bg-red-50 text-red-700',
};

const QUEUE_RESULT_FILTERS = {
  sdo: [
    { value: 'all', label: 'All SDO Results' },
    { value: 'pending', label: 'Pending' },
    { value: 'cleared', label: 'No Offense' },
    { value: 'disqualified_minor', label: 'Minor Offense' },
    { value: 'disqualified_major', label: 'Major Offense' },
  ],
  guidance: [
    { value: 'all', label: 'All Guidance Results' },
    { value: 'pending', label: 'Pending' },
    { value: 'cleared', label: 'Good Moral Standing' },
    { value: 'held', label: 'For Counseling / Hold' },
    { value: 'rejected', label: 'Rejected' },
  ],
  pd: [
    { value: 'all', label: 'All PD Results' },
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
  ],
};

function authHeaders(tokenStorageKey = 'adminToken') {
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

function getQueueDecisionValue(queueKey, row) {
  if (queueKey === 'sdo') {
    return row.sdo_decision || 'pending';
  }
  if (queueKey === 'guidance') {
    return row.guidance_decision || 'pending';
  }
  return row.pd_decision || 'pending';
}

function getQueueDecisionLabel(queueKey, row) {
  if (queueKey === 'sdo') {
    return row.office_results?.sdo || 'Pending SDO review';
  }
  if (queueKey === 'guidance') {
    return row.office_results?.guidance || 'Pending Guidance review';
  }
  return row.office_results?.pd || 'Pending PD review';
}

function getQueueDecisionTone(value) {
  if (['cleared', 'approved'].includes(value)) {
    return 'bg-green-50 text-green-700 border-green-200';
  }
  if (['held', 'disqualified_minor', 'pending'].includes(value)) {
    return 'bg-amber-50 text-amber-700 border-amber-200';
  }
  if (['rejected', 'guidance_rejected', 'disqualified_major'].includes(value)) {
    return 'bg-red-50 text-red-700 border-red-200';
  }
  return 'bg-stone-100 text-stone-700 border-stone-200';
}

function QueueSummary({ queueKey, rows }) {
  if (queueKey === 'sdo') {
    return (
      <>
        <SummaryCard icon={FileText} label="Pending Slips" value={rows.length} tone="bg-orange-50 text-orange-700" />
        <SummaryCard
          icon={CheckCircle2}
          label="No Offense"
          value={rows.filter((row) => row.sdo_decision === 'cleared').length}
          tone="bg-green-50 text-green-700"
        />
        <SummaryCard
          icon={Hourglass}
          label="Minor Offense"
          value={rows.filter((row) => row.sdo_decision === 'disqualified_minor').length}
          tone="bg-amber-50 text-amber-700"
        />
        <SummaryCard
          icon={AlertOctagon}
          label="Major Offense"
          value={rows.filter((row) => row.sdo_decision === 'disqualified_major').length}
          tone="bg-red-50 text-red-700"
        />
      </>
    );
  }

  if (queueKey === 'guidance') {
    return (
      <>
        <SummaryCard icon={FileText} label="Pending Slips" value={rows.length} tone="bg-blue-50 text-blue-700" />
        <SummaryCard
          icon={CheckCircle2}
          label="Good Moral"
          value={rows.filter((row) => row.guidance_decision === 'cleared').length}
          tone="bg-green-50 text-green-700"
        />
        <SummaryCard
          icon={Hourglass}
          label="On Hold"
          value={rows.filter((row) => row.guidance_decision === 'held').length}
          tone="bg-amber-50 text-amber-700"
        />
        <SummaryCard
          icon={AlertOctagon}
          label="Rejected"
          value={rows.filter((row) => row.guidance_decision === 'rejected').length}
          tone="bg-red-50 text-red-700"
        />
      </>
    );
  }

  return (
    <>
      <SummaryCard icon={FileText} label="Pending Slips" value={rows.length} tone="bg-amber-50 text-amber-700" />
      <SummaryCard
        icon={CheckCircle2}
        label="With Grade File"
        value={rows.filter((row) => row.grade_document?.url).length}
        tone="bg-green-50 text-green-700"
      />
      <SummaryCard
        icon={ShieldAlert}
        label="Programs"
        value={new Set(rows.map((row) => row.program_name).filter(Boolean)).size}
        tone="bg-blue-50 text-blue-700"
      />
    </>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <Card className="border-stone-200 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-xl p-2 ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
          <p className="text-xl font-semibold text-stone-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ActionPanel({ queueKey, row, actionState, setActionState, onSubmit, loading }) {
  const state = actionState[row.slip_id] || {
    remarks: '',
    sdoReason: 'clear',
    offenseType: '',
    incidentDate: '',
    caseReferenceNumber: '',
  };

  const updateState = (patch) => {
    setActionState((current) => ({
      ...current,
      [row.slip_id]: {
        ...state,
        ...patch,
      },
    }));
  };

  if (queueKey === 'pd') {
    return (
      <div className="space-y-2">
        <Textarea
          rows={2}
          value={state.remarks}
          onChange={(event) => updateState({ remarks: event.target.value })}
          placeholder="Optional remark"
          className="min-h-[72px]"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-green-700 text-white hover:bg-green-800"
            disabled={loading}
            onClick={() => onSubmit(row, 'approve')}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-red-200 text-red-700"
            disabled={loading}
            onClick={() => onSubmit(row, 'reject')}
          >
            Reject
          </Button>
        </div>
      </div>
    );
  }

  if (queueKey === 'guidance') {
    return (
      <div className="space-y-2">
        <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
          Clear students with good moral standing, hold them for counseling, or reject them with a reason.
        </div>
        <Textarea
          rows={2}
          value={state.remarks}
          onChange={(event) => updateState({ remarks: event.target.value })}
          placeholder="Reason is required when holding or rejecting a student"
          className="min-h-[72px]"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-green-700 text-white hover:bg-green-800"
            disabled={loading}
            onClick={() => onSubmit(row, 'clear')}
          >
            Clear
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-200 text-amber-700"
            disabled={loading}
            onClick={() => onSubmit(row, 'hold')}
          >
            For Counseling / Hold
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-red-200 text-red-700"
            disabled={loading}
            onClick={() => onSubmit(row, 'reject')}
          >
            Reject
          </Button>
        </div>
      </div>
    );
  }

  const selectedReason = state.sdoReason;
  const needsOffenseDetail = ['disqualify_minor', 'disqualify_major'].includes(selectedReason);

  return (
    <div className="space-y-2">
      <div className="rounded-xl bg-stone-50 p-3 text-xs text-stone-600">
        Minor offense still proceeds to Guidance. Major offense stops the slip in SDO.
      </div>
      <Select
        value={state.sdoReason}
        onValueChange={(value) =>
          updateState({
            sdoReason: value,
            remarks:
              state.remarks && state.remarks !== SDO_STANDARD_REASONS.clear && state.remarks !== SDO_STANDARD_REASONS.disqualify_minor && state.remarks !== SDO_STANDARD_REASONS.disqualify_major
                ? state.remarks
                : SDO_STANDARD_REASONS[value],
          })
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="clear">No offense</SelectItem>
          <SelectItem value="disqualify_minor">Minor offense</SelectItem>
          <SelectItem value="disqualify_major">Major offense</SelectItem>
        </SelectContent>
      </Select>
      {needsOffenseDetail ? (
        <div className="grid gap-2 md:grid-cols-2">
          <Input
            value={state.offenseType}
            onChange={(event) => updateState({ offenseType: event.target.value })}
            placeholder="Offense type"
          />
          <Input
            type="date"
            value={state.incidentDate}
            onChange={(event) => updateState({ incidentDate: event.target.value })}
          />
          <div className="md:col-span-2">
            <Input
              value={state.caseReferenceNumber}
              onChange={(event) => updateState({ caseReferenceNumber: event.target.value })}
              placeholder="Case note / reference number"
            />
          </div>
        </div>
      ) : null}
      <Textarea
        rows={2}
        value={state.remarks}
        onChange={(event) => updateState({ remarks: event.target.value })}
        placeholder={needsOffenseDetail ? 'Remarks are required for minor or major offense' : 'Optional remark'}
        className="min-h-[72px]"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          className="bg-green-700 text-white hover:bg-green-800"
          disabled={loading}
          onClick={() => onSubmit(row, 'clear')}
        >
          Clear
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-amber-200 text-amber-700"
          disabled={loading}
          onClick={() => onSubmit(row, 'disqualify_minor')}
        >
          Minor Offense
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-red-200 text-red-700"
          disabled={loading}
          onClick={() => onSubmit(row, 'disqualify_major')}
        >
          Major Offense
        </Button>
      </div>
    </div>
  );
}

export default function EndorsementQueue({
  queueKey,
  tokenStorageKey = 'adminToken',
  detailBasePath = '/admin/endorsements',
  profileStorageKey = 'adminProfile',
}) {
  const navigate = useNavigate();
  const meta = QUEUE_META[queueKey];
  const profile = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem(profileStorageKey) || '{}');
    } catch {
      return {};
    }
  }, [profileStorageKey]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingSlipId, setSavingSlipId] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [actionState, setActionState] = useState({});

  const hasAccess = meta.allowedRoles.includes(profile.role);

  const loadQueue = async ({ soft = false } = {}) => {
    if (!hasAccess) return;

    try {
      if (soft) setRefreshing(true);
      else setLoading(true);
      setError('');

      const response = await fetch(buildApiUrl(meta.endpoint), {
        headers: authHeaders(tokenStorageKey),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load endorsement queue');
      }

      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load endorsement queue.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [queueKey]);

  useSocketEvent(
    'endorsement:updated',
    () => {
      loadQueue({ soft: true });
    },
    [queueKey, hasAccess]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesSearch =
        !query ||
        (row.student_name || '').toLowerCase().includes(query) ||
        (row.pdm_id || '').toLowerCase().includes(query);

      const matchesProgram =
        programFilter === 'all' || row.program_name === programFilter;

      const decisionValue = getQueueDecisionValue(queueKey, row);
      const matchesResult = resultFilter === 'all' || decisionValue === resultFilter;

      return matchesSearch && matchesProgram && matchesResult;
    });
  }, [rows, search, programFilter, queueKey, resultFilter]);

  const programs = useMemo(
    () => ['all', ...new Set(rows.map((row) => row.program_name).filter(Boolean))],
    [rows]
  );

  const handleSubmit = async (row, action) => {
    const state = actionState[row.slip_id] || { remarks: '', sdoReason: 'clear' };
    const remarks =
      queueKey === 'sdo' && !state.remarks
        ? SDO_STANDARD_REASONS[action] || ''
        : state.remarks;

    if (queueKey === 'guidance' && ['hold', 'reject'].includes(action) && !remarks.trim()) {
      setError('Guidance hold or rejection requires a reason.');
      return;
    }

    if (queueKey === 'sdo' && ['disqualify_minor', 'disqualify_major'].includes(action) && !remarks.trim()) {
      setError('SDO remarks are required for minor or major offense.');
      return;
    }

    if (queueKey === 'sdo' && ['disqualify_minor', 'disqualify_major'].includes(action) && !state.offenseType.trim()) {
      setError('Offense type is required for minor or major offense.');
      return;
    }

    try {
      setSavingSlipId(row.slip_id);
      setError('');

      const response = await fetch(buildApiUrl(meta.actionEndpoint(row.slip_id)), {
        method: 'POST',
        headers: authHeaders(tokenStorageKey),
        body: JSON.stringify({
          action,
          remarks,
          offense_type: queueKey === 'sdo' ? state.offenseType : undefined,
          incident_date: queueKey === 'sdo' ? state.incidentDate : undefined,
          case_reference_number: queueKey === 'sdo' ? state.caseReferenceNumber : undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update endorsement slip');
      }

      if (data?.pdfError) {
        setError(`Decision saved, but final PDF generation failed: ${data.pdfError}`);
      }

      await loadQueue({ soft: true });
    } catch (err) {
      setError(err.message || 'Failed to update endorsement slip.');
    } finally {
      setSavingSlipId('');
    }
  };

  if (!hasAccess) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-7 w-7 text-red-400" />
        <p className="text-sm font-semibold text-red-800">Access denied</p>
        <p className="mt-1 text-sm text-red-600">
          This account is not allowed to access the {meta.title}.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-stone-400" />
        <p className="text-sm text-stone-500">Loading endorsement queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{meta.title}</h1>
          <p className="mt-1 text-sm text-stone-500">{meta.subtitle}</p>
        </div>
        <Button variant="outline" className="border-stone-200" onClick={() => loadQueue({ soft: true })}>
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className={`grid grid-cols-1 gap-3 ${queueKey === 'pd' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
        <QueueSummary queueKey={queueKey} rows={rows} />
      </div>

      <Card className="border-stone-200 shadow-none">
        <CardHeader className="space-y-3 border-b border-stone-100 bg-stone-50/60 px-5 py-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by student name or PDM ID"
                className="pl-9"
              />
            </div>
            <Select value={programFilter} onValueChange={setProgramFilter}>
              <SelectTrigger className="w-full lg:w-64">
                <SelectValue placeholder="Filter by program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program} value={program}>
                    {program === 'all' ? 'All Programs' : program}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={resultFilter} onValueChange={setResultFilter}>
              <SelectTrigger className="w-full lg:w-64">
                <SelectValue placeholder="Filter by result" />
              </SelectTrigger>
              <SelectContent>
                {(QUEUE_RESULT_FILTERS[queueKey] || QUEUE_RESULT_FILTERS.pd).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
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
              No students match the current filters.
            </div>
          ) : (
            filteredRows.map((row) => (
              <div
                key={row.slip_id}
                className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-4 lg:grid-cols-[1.2fr_1fr_1.1fr]"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-stone-900">{row.student_name}</p>
                      <p className="text-sm text-stone-500">{row.pdm_id}</p>
                    </div>
                    <Badge className={STAGE_TONE[row.current_stage] || 'bg-stone-100 text-stone-700'}>
                      {row.overall_status_label}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-stone-200 text-stone-700">
                      {row.program_name}
                    </Badge>
                    <Badge variant="outline" className="border-stone-200 text-stone-700">
                      {row.opening_title || 'Opening not set'}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">
                      Submitted: {formatDate(row.submitted_at)}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-1 ${getQueueDecisionTone(getQueueDecisionValue(queueKey, row))}`}
                    >
                      {getQueueDecisionLabel(queueKey, row)}
                    </span>
                  </div>
                  {queueKey === 'pd' ? (
                    <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                      <p>GWA: {row.grade_summary?.gwa ?? 'N/A'}</p>
                      <p>Grade file: {row.grade_document?.url ? 'Uploaded' : 'Missing'}</p>
                    </div>
                  ) : null}
                  {queueKey !== 'sdo' ? (
                    <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                      <p className="font-medium text-stone-900">Previous SDO Review</p>
                      <p>{row.office_results?.sdo || 'Pending SDO review'}</p>
                      {row.sdo_offense_detail?.offense_type ? (
                        <p className="text-xs text-stone-500">
                          {row.sdo_offense_detail.offense_type}
                          {row.sdo_offense_detail.incident_date ? ` • ${row.sdo_offense_detail.incident_date}` : ''}
                          {row.sdo_offense_detail.case_reference_number ? ` • ${row.sdo_offense_detail.case_reference_number}` : ''}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {queueKey === 'pd' ? (
                    <div className="rounded-xl bg-stone-50 p-3 text-sm text-stone-700">
                      <p className="font-medium text-stone-900">Guidance Review</p>
                      <p>{row.office_results?.guidance || 'Pending Guidance review'}</p>
                    </div>
                  ) : null}
                  <div className="rounded-2xl bg-stone-50 p-3">
                    <EndorsementProgressTracker tracker={row.tracker} compact />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Documents</p>
                  {row.grade_document?.url ? (
                    <a
                      href={row.grade_document.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-700 hover:underline"
                    >
                      <FileText className="h-4 w-4" />
                      {row.grade_document.file_name || 'Open grade file'}
                    </a>
                  ) : (
                    <p className="text-sm text-red-600">No uploaded grade document</p>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-stone-200"
                    onClick={() => navigate(`${detailBasePath}/${row.slip_id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Slip
                  </Button>
                </div>

                <ActionPanel
                  queueKey={queueKey}
                  row={row}
                  actionState={actionState}
                  setActionState={setActionState}
                  onSubmit={handleSubmit}
                  loading={savingSlipId === row.slip_id}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
