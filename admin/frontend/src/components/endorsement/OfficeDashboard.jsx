import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Loader2,
  NotebookPen,
  RefreshCw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSocketEvent } from '@/hooks/useSocket';
import usePortalTheme from '@/hooks/usePortalTheme';

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

function SummaryCard({ icon: Icon, label, value, tone, theme }) {
  return (
    <Card
      className="rounded-[22px] shadow-none"
      style={{ borderColor: 'color-mix(in srgb, var(--portal-base) 14%, white)' }}
    >
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-2xl p-2.5 ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-stone-500">{label}</p>
          <p className="text-2xl font-semibold text-stone-900">{value}</p>
        </div>
        <div className="ml-auto hidden h-10 w-1 rounded-full md:block" style={{ background: theme.chartSecondary }} />
      </CardContent>
    </Card>
  );
}

const DASHBOARD_CONFIG = {
  sdo: {
    title: 'SDO Dashboard',
    subtitle: 'A lighter overview for offense checks, queue review, and recent endorsement actions.',
    queueStage: 'pending_sdo',
    queueLabel: 'Approval Requests',
    trackerPath: '/sdo/tracker',
    reportsPath: '/sdo/reports',
    maintenancePath: '/sdo/maintenance',
    detailBasePath: '/sdo/endorsements',
    accent: 'from-emerald-700 via-emerald-600 to-teal-600',
    accentSoft: 'bg-emerald-50 text-emerald-700',
    actionTint: 'hover:bg-emerald-50',
    cards: (rows) => [
      {
        label: 'Approval Requests',
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
    subtitle: 'A cleaner daily view for moral standing, counseling holds, and guidance decisions.',
    queueStage: 'pending_guidance',
    queueLabel: 'Approval Requests',
    trackerPath: '/guidance/tracker',
    reportsPath: '/guidance/reports',
    maintenancePath: '/guidance/maintenance',
    detailBasePath: '/guidance/endorsements',
    accent: 'from-sky-700 via-sky-600 to-blue-600',
    accentSoft: 'bg-sky-50 text-sky-700',
    actionTint: 'hover:bg-sky-50',
    cards: (rows) => [
      {
        label: 'Approval Requests',
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
    subtitle: 'A simpler endorsement view for pending approvals, rejections, and completed slips.',
    queueStage: 'pending_pd',
    queueLabel: 'Approval Requests',
    trackerPath: '/pd/tracker',
    reportsPath: '/pd/reports',
    maintenancePath: '/pd/maintenance',
    detailBasePath: '/pd/endorsements',
    accent: 'from-violet-700 via-violet-600 to-fuchsia-600',
    accentSoft: 'bg-violet-50 text-violet-700',
    actionTint: 'hover:bg-violet-50',
    cards: (rows) => [
      {
        label: 'Approval Requests',
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

function getFocusLabel(officeKey) {
  if (officeKey === 'sdo') return 'Minor and major offense handling';
  if (officeKey === 'guidance') return 'Counseling holds and moral standing review';
  return 'Program endorsement approvals and final review';
}

function getDecisionLabel(row, officeKey) {
  if (officeKey === 'sdo') return row.sdo_decision_label || row.sdo_decision || 'Pending SDO';
  if (officeKey === 'guidance') {
    return row.guidance_decision_label || row.guidance_decision || 'Pending Guidance';
  }
  return row.pd_decision_label || row.pd_decision || 'Pending PD';
}

export default function OfficeDashboard({ officeKey, tokenStorageKey = 'adminToken' }) {
  const navigate = useNavigate();
  const config = DASHBOARD_CONFIG[officeKey];
  const { theme } = usePortalTheme(officeKey);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadRows = async ({ soft = false } = {}) => {
    try {
      if (soft) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
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

  const pendingCount = useMemo(
    () => rows.filter((row) => row.current_stage === config.queueStage).length,
    [config.queueStage, rows]
  );

  const completedCount = useMemo(
    () => rows.filter((row) => row.overall_status === 'completed').length,
    [rows]
  );

  const completedToday = useMemo(() => {
    const today = new Date().toDateString();
    return rows.filter((row) => {
      if (!row.completed_at) return false;
      const date = new Date(row.completed_at);
      return !Number.isNaN(date.getTime()) && date.toDateString() === today;
    }).length;
  }, [rows]);

  const blockedCount = useMemo(() => {
    if (officeKey === 'sdo') {
      return rows.filter((row) =>
        ['disqualified_minor', 'disqualified_major'].includes(row.sdo_decision)
      ).length;
    }

    if (officeKey === 'guidance') {
      return rows.filter((row) => ['held', 'rejected'].includes(row.guidance_decision)).length;
    }

    return rows.filter((row) => row.pd_decision === 'rejected').length;
  }, [officeKey, rows]);

  const priorityRows = useMemo(() => {
    return rows.filter((row) => row.current_stage === config.queueStage).slice(0, 4);
  }, [config.queueStage, rows]);

  const recentRows = useMemo(() => {
    return rows
      .filter((row) => row.current_stage === config.queueStage || row.overall_status === 'completed')
      .slice(0, 5);
  }, [config.queueStage, rows]);

  const recentActivity = useMemo(() => {
    const activity = [];

    rows.forEach((row) => {
      (row.stages || []).forEach((stage) => {
        if (!stage?.acted_at) return;
        activity.push({
          slip_id: row.slip_id,
          student_name: row.student_name,
          stage_label: stage.label,
          status: stage.result_label || stage.status,
          acted_at: stage.acted_at,
        });
      });
    });

    return activity
      .sort((a, b) => new Date(b.acted_at).getTime() - new Date(a.acted_at).getTime())
      .slice(0, 4);
  }, [rows]);

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
      <section
        className="overflow-hidden rounded-[28px] text-white shadow-sm"
        style={{ background: `linear-gradient(135deg, ${theme.base} 0%, ${theme.active} 55%, ${theme.accent} 100%)` }}
      >
        <div className="flex flex-col gap-6 px-6 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-7">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
              <NotebookPen className="h-3.5 w-3.5" />
              {config.queueLabel}
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{config.title}</h1>
            <p className="mt-2 text-sm text-white/80">{config.subtitle}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">Pending</p>
              <p className="mt-1 text-2xl font-semibold">{pendingCount}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">Completed</p>
              <p className="mt-1 text-2xl font-semibold">{completedCount}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">Today</p>
              <p className="mt-1 text-2xl font-semibold">{completedToday}</p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">Attention</p>
              <p className="mt-1 text-2xl font-semibold">{blockedCount}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-stone-900">Office snapshot</p>
          <p className="mt-1 text-sm text-stone-500">Simple counts for today’s work, pending actions, and recent decisions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="border-stone-200 bg-white"
            onClick={() => navigate(config.trackerPath)}
          >
            Open Tracker
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="border-stone-200 bg-white"
            onClick={() => loadRows({ soft: true })}
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

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        {cards.map((card) => (
            <SummaryCard
              key={card.label}
              icon={card.icon}
              label={card.label}
              value={card.value}
              tone={card.tone}
              theme={theme}
            />
          ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.12fr_0.88fr]">
        <Card className="rounded-[24px] border-stone-200 shadow-none">
          <CardHeader className="border-b border-stone-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-stone-900">Priority Queue</h2>
                <p className="text-sm text-stone-500">Applicants that still need your office action first.</p>
              </div>
              <Badge
                className="border-none"
                style={{ background: theme.accentSoft, color: theme.base }}
              >
                {pendingCount} waiting
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {priorityRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 px-5 py-10 text-center text-sm text-stone-500">
                No applicants are waiting in your queue right now.
              </div>
            ) : (
              priorityRows.map((row) => (
                <button
                  key={row.slip_id}
                  type="button"
                  onClick={() => navigate(`${config.detailBasePath}/${row.slip_id}`)}
                  className="w-full rounded-[22px] border border-stone-200 bg-white p-4 text-left transition hover:bg-stone-50"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-stone-900">{row.student_name}</p>
                      <p className="mt-1 text-xs text-stone-500">
                        {row.pdm_id} • {row.opening_title || 'Opening not set'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-stone-200 text-stone-700">
                          {row.current_stage_label}
                        </Badge>
                        <Badge className={STATUS_TONE[row.overall_status] || 'bg-stone-100 text-stone-700'}>
                          {getDecisionLabel(row, officeKey)}
                        </Badge>
                        {row.slip_code ? (
                          <Badge variant="outline" className="border-stone-200 font-mono text-[11px] text-stone-500">
                            {row.slip_code}
                          </Badge>
                        ) : null}
                      </div>
                    </div>

                    <div className="shrink-0 text-left md:text-right">
                      <div className="inline-flex items-center gap-1 text-[11px] text-stone-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        Submitted
                      </div>
                      <p className="mt-1 text-xs font-medium text-stone-700">{formatDate(row.submitted_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="rounded-[24px] border-stone-200 shadow-none">
            <CardHeader className="border-b border-stone-100">
              <div>
                <h2 className="text-base font-semibold text-stone-900">Quick Actions</h2>
                <p className="text-sm text-stone-500">{getFocusLabel(officeKey)}</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              <div className="rounded-[20px] border border-stone-200 px-4 py-3" style={{ background: theme.accentSoft }}>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.base }}>
                  Daily Focus
                </p>
                <p className="mt-2 text-sm font-medium text-stone-800">
                  {pendingCount > 0
                    ? `${pendingCount} applicant${pendingCount === 1 ? '' : 's'} require${pendingCount === 1 ? 's' : ''} your office approval.`
                    : 'Your active queue is clear right now. Review the tracker and recent activity for follow-up items.'}
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full justify-between border-stone-200"
                onClick={() => navigate(config.trackerPath)}
              >
                {config.queueLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between border-stone-200"
                onClick={() => navigate(config.reportsPath)}
              >
                Reports
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="w-full justify-between border-stone-200"
                onClick={() => navigate(config.maintenancePath)}
              >
                Maintenance
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-stone-200 shadow-none">
            <CardHeader className="border-b border-stone-100">
              <h2 className="text-base font-semibold text-stone-900">Recent Activity</h2>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-stone-500">No office activity recorded yet.</p>
              ) : (
                recentActivity.map((item) => (
                  <div
                    key={`${item.slip_id}-${item.acted_at}-${item.stage_label}`}
                    className="rounded-2xl border border-stone-200 bg-stone-50/80 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-stone-900">{item.student_name}</p>
                        <p className="mt-1 text-xs text-stone-500">{item.stage_label}</p>
                      </div>
                      <Badge variant="outline" className="border-stone-200 text-stone-700">
                        {item.status}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-stone-500">{formatDate(item.acted_at)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="rounded-[24px] border-stone-200 shadow-none">
        <CardHeader className="border-b border-stone-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-stone-900">Recently Updated Slips</h2>
              <p className="text-sm text-stone-500">A lightweight list of completed or recently moved endorsements.</p>
            </div>
            <Badge variant="outline" className="border-stone-200 text-stone-700">
              {recentRows.length} shown
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          {recentRows.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 px-5 py-10 text-center text-sm text-stone-500">
              No recent endorsements found yet.
            </div>
          ) : (
            recentRows.map((row) => (
              <button
                key={row.slip_id}
                type="button"
                onClick={() => navigate(`${config.detailBasePath}/${row.slip_id}`)}
                className="w-full rounded-[22px] border border-stone-200 bg-white p-4 text-left transition hover:bg-stone-50"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900">{row.student_name}</p>
                    <p className="text-xs text-stone-500">
                      {row.pdm_id} • {row.opening_title || 'Opening not set'}
                    </p>
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
    </div>
  );
}
