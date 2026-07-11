import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Hourglass,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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

const QUEUE_ACCENT = {
  sdo: {
    card: 'from-orange-50 via-white to-white',
    border: 'border-orange-200',
    badge: 'bg-orange-100 text-orange-800',
  },
  guidance: {
    card: 'from-blue-50 via-white to-white',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-800',
  },
  pd: {
    card: 'from-emerald-50 via-white to-white',
    border: 'border-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
  },
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

function getDocumentPreviewType(row = {}) {
  const source = row.grade_document?.file_name || row.grade_document?.url || '';
  const lower = source.toLowerCase();

  if (lower.endsWith('.pdf')) return 'pdf';
  if (/\.(png|jpg|jpeg|webp|gif)$/i.test(lower)) return 'image';
  return 'file';
}

function GradePreviewModal({ row, open, onClose }) {
  if (!open || !row?.grade_document?.url) return null;

  const previewType = getDocumentPreviewType(row);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="flex h-[min(92vh,860px)] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
              Grade Preview
            </p>
            <p className="mt-1 truncate text-base font-semibold text-stone-900">
              {row.grade_document.file_name || 'Grade document'}
            </p>
            <p className="mt-1 text-sm text-stone-500">
              {row.student_name} • {row.pdm_id || 'No PDM ID'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={row.grade_document.url}
              target="_blank"
              rel="noreferrer"
              download={row.grade_document.file_name || 'grade-document'}
              className="inline-flex"
            >
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-stone-200 bg-white"
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </a>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-stone-200 bg-white"
              onClick={onClose}
            >
              Close
            </Button>
          </div>
        </div>

        <div className="flex-1 bg-stone-50 p-4">
          {previewType === 'image' ? (
            <div className="flex h-full items-center justify-center overflow-auto rounded-2xl border border-stone-200 bg-white p-4">
              <img
                src={row.grade_document.url}
                alt={row.grade_document.file_name || 'Grade document'}
                className="max-h-full max-w-full rounded-2xl object-contain"
              />
            </div>
          ) : previewType === 'pdf' ? (
            <object
              data={row.grade_document.url}
              type="application/pdf"
              className="h-full w-full rounded-2xl border border-stone-200 bg-white"
            >
              <iframe
                src={row.grade_document.url}
                title={row.grade_document.file_name || 'Grade document'}
                className="h-full w-full rounded-2xl border border-stone-200 bg-white"
              />
            </object>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white px-6 text-center">
              <FileText className="h-10 w-10 text-stone-400" />
              <p className="mt-4 text-base font-semibold text-stone-800">
                Preview is not available for this file type.
              </p>
              <p className="mt-2 text-sm text-stone-500">
                Open or download the file instead.
              </p>
              <div className="mt-4 flex gap-2">
                <a
                  href={row.grade_document.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex"
                >
                  <Button type="button" size="sm" className="border-none bg-stone-900 text-white hover:bg-stone-800">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open File
                  </Button>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
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

function getCurrentStageLabel(row) {
  return (
    row.current_stage_label ||
    row.overall_status_label ||
    row.tracker?.current_stage_label ||
    'Pending review'
  );
}

function getCurrentStageTone(row) {
  return STAGE_TONE[row.current_stage] || 'bg-stone-100 text-stone-700';
}

function shouldConfirmAction(action) {
  return ['approve', 'reject', 'hold', 'disqualify_minor', 'disqualify_major'].includes(action);
}

function getConfirmationMeta(queueKey, row, action) {
  const studentName = row?.student_name || 'this applicant';

  if (queueKey === 'sdo') {
    if (action === 'disqualify_minor') {
      return {
        tone: 'amber',
        title: 'Confirm minor offense decision',
        description: `Mark ${studentName} with a minor offense and forward the slip to Guidance for the next review stage?`,
        confirmLabel: 'Confirm Minor Offense',
      };
    }

    if (action === 'disqualify_major') {
      return {
        tone: 'red',
        title: 'Confirm major offense decision',
        description: `Mark ${studentName} with a major offense and stop the endorsement flow in SDO?`,
        confirmLabel: 'Confirm Major Offense',
      };
    }
  }

  if (queueKey === 'guidance') {
    if (action === 'hold') {
      return {
        tone: 'amber',
        title: 'Confirm counseling hold',
        description: `Place ${studentName} on hold for counseling and pause movement to Program Director?`,
        confirmLabel: 'Confirm Hold',
      };
    }

    if (action === 'reject') {
      return {
        tone: 'red',
        title: 'Confirm guidance rejection',
        description: `Reject ${studentName} in Guidance and stop the endorsement slip at this stage?`,
        confirmLabel: 'Confirm Rejection',
      };
    }
  }

  if (queueKey === 'pd') {
    if (action === 'approve') {
      return {
        tone: 'green',
        title: 'Confirm PD approval',
        description: `Approve ${studentName} in Program Director and complete the endorsement slip?`,
        confirmLabel: 'Confirm Approval',
      };
    }

    if (action === 'reject') {
      return {
        tone: 'red',
        title: 'Confirm PD rejection',
        description: `Reject ${studentName} in Program Director and stop final endorsement approval?`,
        confirmLabel: 'Confirm Rejection',
      };
    }
  }

  return {
    tone: 'amber',
    title: 'Confirm action',
    description: `Continue with this endorsement decision for ${studentName}?`,
    confirmLabel: 'Confirm',
  };
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
    <Card className="overflow-hidden border-stone-200 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-2xl p-3 ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-stone-500">{label}</p>
          <p className="text-2xl font-semibold leading-none text-stone-900">{value}</p>
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
      <div className="space-y-4 rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">PD Decision</p>
          <p className="mt-1 text-sm text-stone-600">Finalize the endorsement after checking the grade and prior office reviews.</p>
        </div>
        <Textarea
          rows={2}
          value={state.remarks}
          onChange={(event) => updateState({ remarks: event.target.value })}
          placeholder="Optional remark"
          className="min-h-[88px] bg-white"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            className="h-10 bg-green-700 text-white hover:bg-green-800"
            disabled={loading}
            onClick={() => onSubmit(row, 'approve')}
          >
            Approve
          </Button>
          <Button
            variant="outline"
            className="h-10 border-red-200 text-red-700 hover:bg-red-50"
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
      <div className="space-y-4 rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">Guidance Decision</p>
          <div className="mt-2 rounded-xl bg-white p-3 text-xs leading-5 text-stone-600">
            Clear students with good moral standing, hold them for counseling, or reject them with a reason.
          </div>
        </div>
        <Textarea
          rows={2}
          value={state.remarks}
          onChange={(event) => updateState({ remarks: event.target.value })}
          placeholder="Reason is required when holding or rejecting a student"
          className="min-h-[88px] bg-white"
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <Button
            className="h-10 bg-green-700 text-white hover:bg-green-800"
            disabled={loading}
            onClick={() => onSubmit(row, 'clear')}
          >
            Clear
          </Button>
          <Button
            variant="outline"
            className="h-10 border-amber-200 text-amber-700 hover:bg-amber-50"
            disabled={loading || row.current_stage === 'held'}
            onClick={() => onSubmit(row, 'hold')}
          >
            For Counseling / Hold
          </Button>
          <Button
            variant="outline"
            className="h-10 border-red-200 text-red-700 hover:bg-red-50"
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
    <div className="space-y-4 rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">SDO Decision</p>
        <div className="mt-2 rounded-xl bg-white p-3 text-xs leading-5 text-stone-600">
          Minor offense still proceeds to Guidance. Major offense stops the slip in SDO.
        </div>
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
        className="min-h-[88px] bg-white"
      />
      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          className="h-10 bg-green-700 text-white hover:bg-green-800"
          disabled={loading}
          onClick={() => onSubmit(row, 'clear')}
        >
          Clear
        </Button>
        <Button
          variant="outline"
          className="h-10 border-amber-200 text-amber-700 hover:bg-amber-50"
          disabled={loading}
          onClick={() => onSubmit(row, 'disqualify_minor')}
        >
          Minor Offense
        </Button>
        <Button
          variant="outline"
          className="h-10 border-red-200 text-red-700 hover:bg-red-50"
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
  const [success, setSuccess] = useState(null);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const [previewRow, setPreviewRow] = useState(null);
  const [actionState, setActionState] = useState({});
  const [confirmAction, setConfirmAction] = useState(null);

  const hasAccess = meta.allowedRoles.includes(profile.role);
  const accent = QUEUE_ACCENT[queueKey] || QUEUE_ACCENT.pd;

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

  useEffect(() => {
    if (!hasAccess) return undefined;

    const timer = window.setInterval(() => {
      loadQueue({ soft: true });
    }, 8000);

    return () => window.clearInterval(timer);
  }, [queueKey, hasAccess]);

  useSocketEvent(
    'endorsement:updated',
    () => {
      loadQueue({ soft: true });
    },
    [queueKey, hasAccess]
  );

  useEffect(() => {
    if (!success) return undefined;

    const timer = window.setTimeout(() => {
      setSuccess(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [success]);

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

  const executeSubmit = async (row, action) => {
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
      setSuccess(null);
      setConfirmAction(null);

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

      if (!data?.pdfError) {
        const nextStageLabel =
          data?.slip?.current_stage_label ||
          data?.slip?.overall_status_label ||
          data?.current_stage_label ||
          data?.overall_status_label ||
          '';

        const actionLabelMap = {
          clear: queueKey === 'guidance' ? 'cleared successfully' : 'saved successfully',
          disqualify_minor: 'saved as minor offense and forwarded to Guidance',
          disqualify_major: 'saved as major offense and stopped in SDO',
          hold: 'saved for counseling / hold',
          reject: 'saved as rejected',
          approve: 'approved successfully',
        };

        const actionLabel = actionLabelMap[action] || 'saved successfully';
        setSuccess(
          {
            slipId: row.slip_id,
            title: 'Decision saved successfully',
            studentName: row.student_name,
            actionLabel,
            detail: nextStageLabel
              ? `Status updated to ${nextStageLabel}.`
              : 'The endorsement slip was updated successfully.',
          }
        );
      }

      await loadQueue({ soft: true });
    } catch (err) {
      setError(err.message || 'Failed to update endorsement slip.');
    } finally {
      setSavingSlipId('');
    }
  };

  const handleSubmit = (row, action) => {
    if (shouldConfirmAction(action)) {
      setConfirmAction({ row, action });
      return;
    }

    executeSubmit(row, action);
  };

  const confirmMeta = confirmAction
    ? getConfirmationMeta(queueKey, confirmAction.row, confirmAction.action)
    : null;
  const openExternalFile = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
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
      <GradePreviewModal
        row={previewRow}
        open={Boolean(previewRow)}
        onClose={() => setPreviewRow(null)}
      />
      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => {
          if (!open && !savingSlipId) {
            setConfirmAction(null);
          }
        }}
      >
        {confirmAction && confirmMeta ? (
          <AlertDialogContent size="lg" className="rounded-3xl border border-stone-200 bg-white p-0">
            <AlertDialogHeader className="px-6 pt-6">
              <AlertDialogMedia
                className={`${
                  confirmMeta.tone === 'red'
                    ? 'bg-red-50 text-red-700'
                    : confirmMeta.tone === 'green'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-amber-50 text-amber-700'
                }`}
              >
                {confirmMeta.tone === 'red' ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : confirmMeta.tone === 'green' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Hourglass className="h-5 w-5" />
                )}
              </AlertDialogMedia>
              <AlertDialogTitle>{confirmMeta.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmMeta.description}</AlertDialogDescription>
              <div className="mt-3 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-left">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Applicant</p>
                <p className="mt-1 text-sm font-semibold text-stone-900">
                  {confirmAction.row.student_name}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">PDM ID</p>
                    <p className="mt-1 text-sm text-stone-700">
                      {confirmAction.row.pdm_id || 'No PDM ID'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Slip Code</p>
                    <p className="mt-1 font-mono text-sm text-stone-700">
                      {confirmAction.row.slip_code || 'Not available'}
                    </p>
                  </div>
                </div>
                {queueKey === 'pd' ? (
                  <div className="mt-3 rounded-xl border border-stone-200 bg-white px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">PD Check</p>
                    <p className="mt-1 text-sm text-stone-700">
                      Grade file:{' '}
                      <span className="font-semibold text-stone-900">
                        {confirmAction.row.grade_document?.url ? 'Uploaded' : 'Missing'}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-stone-700">
                      GWA:{' '}
                      <span className="font-semibold text-stone-900">
                        {confirmAction.row.grade_summary?.gwa ?? 'N/A'}
                      </span>
                    </p>
                  </div>
                ) : null}
              </div>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-2">
              <AlertDialogCancel disabled={Boolean(savingSlipId)} className="h-10 min-w-28 border-stone-200 bg-white px-4">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={Boolean(savingSlipId)}
                className={`h-10 min-w-40 border-transparent px-4 font-semibold !text-white shadow-sm ${
                  confirmMeta.tone === 'red'
                    ? '!bg-red-700 hover:!bg-red-800'
                    : confirmMeta.tone === 'green'
                      ? '!bg-green-700 hover:!bg-green-800'
                      : '!bg-amber-600 hover:!bg-amber-700'
                }`}
                onClick={(event) => {
                  event.preventDefault();
                  executeSubmit(confirmAction.row, confirmAction.action);
                }}
              >
                {savingSlipId === confirmAction.row.slip_id ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  confirmMeta.confirmLabel
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>

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

      <Card className="overflow-hidden border-stone-200 shadow-none">
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
            <span className="rounded-full border border-stone-200 bg-white px-3 py-1">
              {filteredRows.length} visible
            </span>
            <span className="rounded-full border border-stone-200 bg-white px-3 py-1">
              {rows.length} total in queue
            </span>
            {queueKey === 'pd' ? (
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1">
                {rows.filter((row) => row.grade_document?.url).length} with grade file
              </span>
            ) : null}
          </div>
          {success ? (
            <div className="rounded-2xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-4 text-green-900 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-2xl bg-green-100 p-2 text-green-700">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{success.title}</p>
                    <p className="mt-1 text-sm text-green-800">
                      {success.studentName} {success.actionLabel}.
                    </p>
                    <p className="mt-1 text-xs text-green-700">{success.detail}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-green-200 bg-white text-green-800 hover:bg-green-50"
                    onClick={() => navigate(`${detailBasePath}/${success.slipId}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Slip
                  </Button>
                  <button
                    type="button"
                    onClick={() => setSuccess(null)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-green-200 bg-white text-green-700 transition hover:bg-green-50"
                    title="Dismiss success message"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
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
                className={`overflow-hidden rounded-[28px] border bg-gradient-to-br p-0 shadow-sm transition-all hover:shadow-md ${accent.card} ${accent.border}`}
              >
                <div className="border-b border-stone-200/70 px-5 py-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${accent.badge}`}>
                          {meta.title}
                        </span>
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getCurrentStageTone(row)}`}>
                          {getCurrentStageLabel(row)}
                        </span>
                      </div>

                      <p className="mt-4 text-xl font-semibold text-stone-900">{row.student_name}</p>
                      <p className="mt-1 text-sm text-stone-500">{row.pdm_id || 'No PDM ID'}</p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-stone-200 bg-white/80 text-stone-700">
                          {row.program_name || 'No program'}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[360px]">
                      <div className="rounded-2xl border border-stone-200 bg-white/90 px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">Slip Code</p>
                        <p className="mt-1 font-mono text-xs text-stone-700">{row.slip_code || 'Not available'}</p>
                      </div>
                      <div className="rounded-2xl border border-stone-200 bg-white/90 px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">Submitted</p>
                        <p className="mt-1 text-sm font-medium text-stone-800">{formatDate(row.submitted_at)}</p>
                      </div>
                      <div className="rounded-2xl border border-stone-200 bg-white/90 px-3 py-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">Action Owner</p>
                        <p className="mt-1 text-sm font-medium text-stone-800">{meta.title}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-stone-200 bg-white/85 p-4 text-sm text-stone-700">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Progress Tracker</p>
                          <div className="mt-3 rounded-2xl bg-stone-50 p-3">
                            <EndorsementProgressTracker tracker={row.tracker} compact />
                          </div>
                        </div>

                        {queueKey === 'pd' ? (
                          <div className="rounded-2xl border border-stone-200 bg-white/85 p-4 text-sm text-stone-700">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Quick Grade Status</p>
                            <p className="mt-2">GWA: <span className="font-semibold text-stone-900">{row.grade_summary?.gwa ?? 'N/A'}</span></p>
                            <p className="mt-1">Grade file: <span className="font-semibold text-stone-900">{row.grade_document?.url ? 'Uploaded' : 'Missing'}</span></p>
                            {row.grade_document?.file_name ? (
                              <p className="mt-1 truncate text-xs text-stone-500">{row.grade_document.file_name}</p>
                            ) : null}
                            {!row.grade_document?.url ? (
                              <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                                PD approval is blocked until the applicant uploads the grade document.
                              </p>
                            ) : null}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-stone-200 bg-white/85 p-4 text-sm text-stone-700">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Current Review</p>
                            <p className="mt-2 font-medium text-stone-900">{meta.title}</p>
                            <p className="mt-1 text-xs text-stone-500">
                              {queueKey === 'sdo'
                                ? 'Review the offense record and route the slip correctly.'
                                : 'Review the slip and decide the next office action.'}
                            </p>
                          </div>
                        )}
                      </div>

                      {queueKey !== 'sdo' ? (
                        <div className="rounded-2xl border border-stone-200 bg-white/85 p-4 text-sm text-stone-700">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Previous SDO Review</p>
                          <p className="mt-2 font-medium text-stone-900">{row.office_results?.sdo || 'Pending SDO review'}</p>
                          {row.sdo_offense_detail?.offense_type ? (
                            <p className="mt-2 text-xs leading-5 text-stone-500">
                              {row.sdo_offense_detail.offense_type}
                              {row.sdo_offense_detail.incident_date ? ` | ${row.sdo_offense_detail.incident_date}` : ''}
                              {row.sdo_offense_detail.case_reference_number ? ` | ${row.sdo_offense_detail.case_reference_number}` : ''}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-stone-200 bg-white/85 p-4 text-sm text-stone-700">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">SDO Rule</p>
                          <p className="mt-2">Minor offense still proceeds to Guidance. Major offense stops the slip here.</p>
                        </div>
                      )}

                      {queueKey === 'pd' ? (
                        <div className="rounded-2xl border border-stone-200 bg-white/85 p-4 text-sm text-stone-700">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">Guidance Review</p>
                          <p className="mt-2 font-medium text-stone-900">{row.office_results?.guidance || 'Pending Guidance review'}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-3">
                      <div className="rounded-[24px] border border-stone-200 bg-white/85 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                      {queueKey === 'pd' ? 'PD Grade Review' : 'Slip Access'}
                        </p>
                        <p className="mt-1 text-sm text-stone-600">
                          {queueKey === 'pd'
                            ? 'Check the uploaded grade file before making the final PD decision.'
                            : 'Open the endorsement slip for the full office record and printable view.'}
                        </p>
                      </div>
                    </div>
                    {queueKey === 'pd' ? (
                      row.grade_document?.url ? (
                        <div className="mt-3 space-y-3">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              className="border-none bg-stone-900 text-white hover:bg-stone-800"
                              onClick={() => setPreviewRow(row)}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Preview Grade
                            </Button>
                            <a
                              href={row.grade_document.url}
                              target="_blank"
                              rel="noreferrer"
                              download={row.grade_document.file_name || 'grade-document'}
                              className="inline-flex"
                            >
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
                              >
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </Button>
                            </a>
                            <a
                              href={row.grade_document.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex"
                            >
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="border-stone-200 bg-white text-stone-700 hover:bg-stone-100"
                              >
                                <ExternalLink className="mr-2 h-4 w-4" />
                                Open
                              </Button>
                            </a>
                          </div>

                          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
                            <div className="flex items-center justify-between border-b border-stone-100 px-3 py-2">
                              <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-stone-700">
                                {getDocumentPreviewType(row) === 'image' ? (
                                  <ImageIcon className="h-4 w-4 shrink-0 text-stone-500" />
                                ) : (
                                  <FileText className="h-4 w-4 shrink-0 text-stone-500" />
                                )}
                                <span className="truncate">
                                  {row.grade_document.file_name || 'Grade document'}
                                </span>
                              </div>
                              <span className="text-[11px] uppercase tracking-wide text-stone-400">
                                {getDocumentPreviewType(row) === 'pdf'
                                  ? 'PDF Preview'
                                  : getDocumentPreviewType(row) === 'image'
                                    ? 'Image Preview'
                                    : 'File'}
                              </span>
                            </div>

                            {getDocumentPreviewType(row) === 'image' ? (
                              <div className="flex h-[300px] items-center justify-center bg-stone-50 p-3">
                                <img
                                  src={row.grade_document.url}
                                  alt={row.grade_document.file_name || 'Grade document'}
                                  className="max-h-full max-w-full rounded-xl object-contain"
                                />
                              </div>
                            ) : getDocumentPreviewType(row) === 'pdf' ? (
                              <object
                                data={row.grade_document.url}
                                type="application/pdf"
                                className="h-[300px] w-full bg-white"
                              >
                                <iframe
                                  src={row.grade_document.url}
                                  title={row.grade_document.file_name || 'Grade document'}
                                  className="h-[300px] w-full bg-white"
                                />
                              </object>
                            ) : (
                              <div className="flex h-[220px] flex-col items-center justify-center gap-3 bg-stone-50 px-4 text-center">
                                <FileText className="h-8 w-8 text-stone-400" />
                                <p className="text-sm text-stone-600">
                                  This file type cannot be previewed here.
                                </p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-stone-200 bg-white"
                                  onClick={() => openExternalFile(row.grade_document.url)}
                                >
                                  Open File
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-red-600">No uploaded grade document</p>
                      )
                    ) : (
                      <p className="mt-3 text-sm text-stone-600">
                        SDO and Guidance can continue first, but the applicant must upload the grade document before PD can approve the slip.
                      </p>
                    )}
                    <Button
                      variant="outline"
                      className="mt-3 h-10 w-full border-blue-200 bg-blue-50 font-medium text-blue-800 hover:bg-blue-100"
                      onClick={() => navigate(`${detailBasePath}/${row.slip_id}`)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Full Slip
                    </Button>
                  </div>
                    </div>
                  </div>

                  <div className="xl:pl-1">
                    <ActionPanel
                      queueKey={queueKey}
                      row={row}
                      actionState={actionState}
                      setActionState={setActionState}
                      onSubmit={handleSubmit}
                      loading={savingSlipId === row.slip_id}
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
