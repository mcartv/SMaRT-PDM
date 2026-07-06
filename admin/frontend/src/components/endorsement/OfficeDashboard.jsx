import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSocketEvent } from '@/hooks/useSocket';

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

function SummaryCard({ icon: Icon, label, value, tone }) {
  return (
    <Card className="border-stone-200 shadow-none">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-xl p-2 ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">{label}</p>
          <p className="text-2xl font-semibold text-stone-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

const DASHBOARD_CONFIG = {
  sdo: {
    title: 'SDO Dashboard',
    subtitle: 'Quick SDO endorsement overview without repeating the full queue.',
    queueStage: 'pending_sdo',
    queueLabel: 'Awaiting SDO',
    trackerPath: '/sdo/tracker',
    reportsPath: '/sdo/reports',
    maintenancePath: '/sdo/maintenance',
    detailBasePath: '/sdo/endorsements',
    cards: (rows) => [
      {
        label: 'Awaiting SDO',
        value: rows.filter((row) => row.current_stage === 'pending_sdo').length,
        icon: ClipboardList,
        tone: 'bg-orange-50 text-orange-700',
      },
      {
        label: 'No Offense',
        value: rows.filter((row) => row.sdo_decision === 'cleared').length,
        icon: CheckCircle2,
        tone: 'bg-green-50 text-green-700',
      },
      {
        label: 'Minor Offense',
        value: rows.filter((row) => row.sdo_decision === 'disqualified_minor').length,
        icon: ShieldAlert,
        tone: 'bg-amber-50 text-amber-700',
      },
      {
        label: 'Major Offense',
        value: rows.filter((row) => row.sdo_decision === 'disqualified_major').length,
        icon: XCircle,
        tone: 'bg-red-50 text-red-700',
      },
    ],
  },
  guidance: {
    title: 'Guidance Dashboard',
    subtitle: 'See what needs counseling review today and what has already been resolved.',
    queueStage: 'pending_guidance',
    queueLabel: 'Awaiting Guidance',
    trackerPath: '/guidance/tracker',
    reportsPath: '/guidance/reports',
    maintenancePath: '/guidance/maintenance',
    detailBasePath: '/guidance/endorsements',
    cards: (rows) => [
      {
        label: 'Awaiting Guidance',
        value: rows.filter((row) => row.current_stage === 'pending_guidance').length,
        icon: ClipboardList,
        tone: 'bg-blue-50 text-blue-700',
      },
      {
        label: 'Good Moral',
        value: rows.filter((row) => row.guidance_decision === 'cleared').length,
        icon: CheckCircle2,
        tone: 'bg-green-50 text-green-700',
      },
      {
        label: 'On Hold',
        value: rows.filter((row) => row.guidance_decision === 'held').length,
        icon: ShieldAlert,
        tone: 'bg-amber-50 text-amber-700',
      },
      {
        label: 'Rejected',
        value: rows.filter((row) => row.guidance_decision === 'rejected').length,
        icon: XCircle,
        tone: 'bg-red-50 text-red-700',
      },
    ],
  },
  pd: {
    title: 'PD Dashboard',
    subtitle: 'Track pending PD decisions and completed endorsement outcomes at a glance.',
    queueStage: 'pending_pd',
    queueLabel: 'Awaiting PD',
    trackerPath: '/pd/tracker',
    reportsPath: '/pd/reports',
    maintenancePath: '/pd/maintenance',
    detailBasePath: '/pd/endorsements',
    cards: (rows) => [
      {
        label: 'Awaiting PD',
        value: rows.filter((row) => row.current_stage === 'pending_pd').length,
        icon: ClipboardList,
        tone: 'bg-violet-50 text-violet-700',
      },
      {
        label: 'Approved',
        value: rows.filter((row) => row.pd_decision === 'approved').length,
        icon: CheckCircle2,
        tone: 'bg-green-50 text-green-700',
      },
      {
        label: 'Rejected',
        value: rows.filter((row) => row.pd_decision === 'rejected').length,
        icon: XCircle,
        tone: 'bg-red-50 text-red-700',
      },
      {
        label: 'Completed',
        value: rows.filter((row) => row.overall_status === 'completed').length,
        icon: FileText,
        tone: 'bg-stone-100 text-stone-700',
      },
    ],
  },
};

const STATUS_TONE = {
  pending_sdo: 'bg-orange-50 text-orange-700',
  pending_guidance: 'bg-blue-50 text-blue-700',
  pending_pd: 'bg-violet-50 text-violet-700',
  held: 'bg-amber-50 text-amber-700',
  rejected: 'bg-red-50 text-red-700',
  guidance_rejected: 'bg-red-50 text-red-700',
  completed: 'bg-green-50 text-green-700',
  disqualified_minor: 'bg-amber-50 text-amber-700',
  disqualified_major: 'bg-red-50 text-red-700',
};

export default function OfficeDashboard({ officeKey, tokenStorageKey = 'adminToken' }) {
  const navigate = useNavigate();
  const config = DASHBOARD_CONFIG[officeKey];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

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
        throw new Error(data.message || 'Failed to load office dashboard.');
      }

      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Failed to load office dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, [tokenStorageKey]);

  useSocketEvent(
    'endorsement:updated',
    () => {
      loadRows({ soft: true });
    },
    [tokenStorageKey]
  );

  const cards = useMemo(() => config.cards(rows), [config, rows]);

  const recentRows = useMemo(() => {
    return rows
      .filter((row) => row.current_stage === config.queueStage || row.overall_status === 'completed')
      .slice(0, 5);
  }, [config.queueStage, rows]);

  if (loading) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-3">
        <Loader2 className="h-7 w-7 animate-spin text-stone-400" />
        <p className="text-sm text-stone-500">Loading office dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{config.title}</h1>
          <p className="mt-1 text-sm text-stone-500">{config.subtitle}</p>
        </div>
        <Button variant="outline" className="border-stone-200" onClick={() => loadRows({ soft: true })}>
          {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {cards.map((card) => (
          <SummaryCard key={card.label} icon={card.icon} label={card.label} value={card.value} tone={card.tone} />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-stone-200 shadow-none">
          <CardHeader className="border-b border-stone-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-stone-900">Recent Endorsements</h2>
                <p className="text-sm text-stone-500">
                  A light overview so you can jump straight into the right applicant.
                </p>
              </div>
              <Button variant="outline" size="sm" className="border-stone-200" onClick={() => navigate(config.trackerPath)}>
                Open Tracker
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {recentRows.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-200 px-5 py-10 text-center text-sm text-stone-500">
                No endorsements found for this office yet.
              </div>
            ) : (
              recentRows.map((row) => (
                <button
                  key={row.slip_id}
                  type="button"
                  onClick={() => navigate(`${config.detailBasePath}/${row.slip_id}`)}
                  className="w-full rounded-2xl border border-stone-200 p-4 text-left transition-colors hover:border-stone-300 hover:bg-stone-50"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-stone-900">{row.student_name}</p>
                      <p className="text-xs text-stone-500">
                        {row.pdm_id} • {row.opening_title || 'Opening not set'}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">Submitted: {formatDate(row.submitted_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={STATUS_TONE[row.overall_status] || 'bg-stone-100 text-stone-700'}>
                        {row.overall_status_label}
                      </Badge>
                      <Badge variant="outline" className="border-stone-200 text-stone-700">
                        {row.current_stage_label}
                      </Badge>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-none">
          <CardHeader className="border-b border-stone-100">
            <h2 className="text-base font-semibold text-stone-900">Quick Links</h2>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <Button variant="outline" className="w-full justify-between border-stone-200" onClick={() => navigate(config.trackerPath)}>
              {config.queueLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="w-full justify-between border-stone-200" onClick={() => navigate(config.reportsPath)}>
              Reports
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="w-full justify-between border-stone-200" onClick={() => navigate(config.maintenancePath)}>
              Maintenance
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
