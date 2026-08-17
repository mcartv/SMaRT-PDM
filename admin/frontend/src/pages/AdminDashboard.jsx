import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocketEvent } from '@/hooks/useSocket';
import usePortalTheme from '@/hooks/usePortalTheme';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  LayoutDashboard,
  Megaphone,
  RefreshCw,
  UsersRound,
} from 'lucide-react';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { buildApiUrl } from '@/api';

const C = {
  brown: 'var(--portal-base)',
  brownMid: 'var(--portal-chart-primary)',
  brownLight: 'var(--portal-chart-quaternary)',
  amber: 'var(--portal-chart-tertiary)',
  amberSoft: 'var(--portal-accent-soft)',
  yellow: 'var(--portal-chart-secondary)',
  sand: 'var(--portal-surface-soft)',
  green: 'var(--portal-chart-positive)',
  greenSoft: 'color-mix(in srgb, var(--portal-chart-positive) 12%, white)',
  red: 'var(--portal-chart-negative)',
  redSoft: 'color-mix(in srgb, var(--portal-chart-negative) 12%, white)',
  border: 'var(--portal-border)',
  muted: 'var(--portal-muted)',
  text: 'var(--portal-text)',
  surface: 'var(--portal-surface)',
  bg: 'var(--portal-main-bg, #faf7f2)',
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    fontSize: 12,
    color: C.text,
    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
  },
};

const CHART_COLORS = [
  C.brownMid,
  C.yellow,
  C.amber,
  C.brownLight,
  C.green,
  C.red,
];

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString() : '0';
}

function formatDate(value) {
  if (!value) return 'N/A';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N/A';

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return 'Just now';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Just now';

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusMeta(status) {
  const normalized = String(status || '').trim().toLowerCase();

  if (
    normalized.includes('approved') ||
    normalized.includes('verified') ||
    normalized.includes('active') ||
    normalized.includes('completed') ||
    normalized.includes('reserved') ||
    normalized.includes('promoted')
  ) {
    return { bg: C.greenSoft, color: C.green };
  }

  if (
    normalized.includes('pending') ||
    normalized.includes('review') ||
    normalized.includes('waiting') ||
    normalized.includes('waitlisted') ||
    normalized.includes('uploaded') ||
    normalized.includes('submitted')
  ) {
    return { bg: C.amberSoft, color: C.amber };
  }

  if (
    normalized.includes('rejected') ||
    normalized.includes('flagged') ||
    normalized.includes('disqualified') ||
    normalized.includes('failed')
  ) {
    return { bg: C.redSoft, color: C.red };
  }

  return { bg: C.sand, color: C.muted };
}

function EmptyChart({ label }) {
  return (
    <div className="flex h-full min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/70 px-4 text-center">
      <AlertCircle className="mb-2 h-5 w-5 text-stone-300" />
      <p className="text-sm font-medium text-stone-500">{label}</p>
    </div>
  );
}

function ActionRow({ item, onOpen }) {
  const count = Number(item.value || 0);
  const needsAttention = count > 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(item.path)}
      className="flex w-full items-center justify-between gap-3 rounded-[18px] border border-stone-200 bg-white p-4 text-left transition hover:border-stone-300 hover:bg-stone-50"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-stone-800">{item.label}</p>
        <p className="mt-1 text-sm leading-5 text-stone-500">{item.sub}</p>
      </div>

      <span
        className="flex min-w-8 shrink-0 items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold"
        style={{
          background: needsAttention ? C.amberSoft : C.greenSoft,
          color: needsAttention ? C.amber : C.green,
        }}
      >
        {formatNumber(count)}
      </span>
    </button>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { theme } = usePortalTheme('admin');

  const [dashboard, setDashboard] = useState({
    summaryCards: [],
    actionSummary: [],
    applicationPipeline: [],
    scholarsByBenefactor: [],
    recentApplications: [],
    generatedAt: null,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    const audit = options.audit === true;

    try {
      if (!silent) setLoading(true);

      setError('');

      const token = sessionStorage.getItem('adminToken') || '';
      const res = await fetch(
        buildApiUrl(`/api/dashboard${audit ? '?audit=1' : ''}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          payload?.message ||
          payload?.error ||
          'Failed to load dashboard data.'
        );
      }

      setDashboard({
        summaryCards: Array.isArray(payload.summaryCards)
          ? payload.summaryCards
          : [],
        actionSummary: Array.isArray(payload.actionSummary)
          ? payload.actionSummary
          : [],
        applicationPipeline: Array.isArray(payload.applicationPipeline)
          ? payload.applicationPipeline
          : [],
        scholarsByBenefactor: Array.isArray(payload.scholarsByBenefactor)
          ? payload.scholarsByBenefactor
          : [],
        recentApplications: Array.isArray(payload.recentApplications)
          ? payload.recentApplications
          : [],
        generatedAt: payload.generatedAt || null,
      });
    } catch (err) {
      console.error('DASHBOARD LOAD ERROR:', err);
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard({ audit: true });
  }, [loadDashboard]);

  const refreshRealtime = useCallback(() => {
    loadDashboard({ silent: true });
  }, [loadDashboard]);

  useSocketEvent('dashboard:updated', refreshRealtime, [refreshRealtime]);

  useSocketEvent('application:created', refreshRealtime, [refreshRealtime]);
  useSocketEvent('application:updated', refreshRealtime, [refreshRealtime]);
  useSocketEvent('application:approved', refreshRealtime, [refreshRealtime]);
  useSocketEvent('application:rejected', refreshRealtime, [refreshRealtime]);
  useSocketEvent('application:disqualified', refreshRealtime, [refreshRealtime]);
  useSocketEvent('application-document:uploaded', refreshRealtime, [refreshRealtime]);
  useSocketEvent('application-document:reviewed', refreshRealtime, [refreshRealtime]);

  useSocketEvent('endorsement:updated', refreshRealtime, [refreshRealtime]);
  useSocketEvent('endorsement:completed', refreshRealtime, [refreshRealtime]);

  useSocketEvent('scholar:created', refreshRealtime, [refreshRealtime]);
  useSocketEvent('scholar:updated', refreshRealtime, [refreshRealtime]);
  useSocketEvent('scholar:archived', refreshRealtime, [refreshRealtime]);
  useSocketEvent('scholar:restored', refreshRealtime, [refreshRealtime]);

  useSocketEvent('opening:created', refreshRealtime, [refreshRealtime]);
  useSocketEvent('opening:updated', refreshRealtime, [refreshRealtime]);
  useSocketEvent('opening:closed', refreshRealtime, [refreshRealtime]);
  useSocketEvent('opening:archived', refreshRealtime, [refreshRealtime]);
  useSocketEvent('opening:restored', refreshRealtime, [refreshRealtime]);

  useSocketEvent('payout:created', refreshRealtime, [refreshRealtime]);
  useSocketEvent('payout:updated', refreshRealtime, [refreshRealtime]);
  useSocketEvent('payout:archived', refreshRealtime, [refreshRealtime]);
  useSocketEvent('payout:restored', refreshRealtime, [refreshRealtime]);
  useSocketEvent('scholar:released', refreshRealtime, [refreshRealtime]);

  useSocketEvent('renewal:created', refreshRealtime, [refreshRealtime]);
  useSocketEvent('renewal:updated', refreshRealtime, [refreshRealtime]);
  useSocketEvent('renewal:reviewed', refreshRealtime, [refreshRealtime]);

  useSocketEvent('ro:updated', refreshRealtime, [refreshRealtime]);
  useSocketEvent('ro:archived', refreshRealtime, [refreshRealtime]);
  useSocketEvent('ro:restored', refreshRealtime, [refreshRealtime]);

  useSocketEvent('maintenance:updated', refreshRealtime, [refreshRealtime]);

  const summaryCards = useMemo(() => {
    if (dashboard.summaryCards.length) return dashboard.summaryCards;

    return [
      {
        key: 'total_applications',
        label: 'Applications',
        value: 0,
        sub: 'Active application records',
      },
      {
        key: 'needs_action',
        label: 'Needs Review',
        value: 0,
        sub: 'Applications still requiring OSFA processing',
      },
      {
        key: 'ready_for_activation',
        label: 'Ready for Activation',
        value: 0,
        sub: 'Reserved or promoted applicants',
      },
      {
        key: 'waitlisted',
        label: 'Waiting List',
        value: 0,
        sub: 'Qualified applicants waiting for a slot',
      },
      {
        key: 'active_scholars',
        label: 'Active Scholars',
        value: 0,
        sub: 'Current active scholar records',
      },
      {
        key: 'open_openings',
        label: 'Open Openings',
        value: 0,
        sub: 'Scholarship openings accepting applicants',
      },
      {
        key: 'active_payouts',
        label: 'Active Payout Batches',
        value: 0,
        sub: 'Payout batches not yet completed',
      },
      {
        key: 'benefactors',
        label: 'Benefactors',
        value: 0,
        sub: 'Current active benefactor records',
      },
    ];
  }, [dashboard.summaryCards]);

  const actionSummary = useMemo(() => {
    if (dashboard.actionSummary.length) return dashboard.actionSummary;

    return [
      {
        key: 'requirements_review',
        label: 'Requirements Review',
        value: 0,
        sub: 'Applications whose requirements are not yet verified',
        path: '/admin/applications',
      },
      {
        key: 'endorsement_review',
        label: 'Endorsement Review',
        value: 0,
        sub: 'Verified applicants still completing endorsements',
        path: '/admin/endorsements',
      },
      {
        key: 'renewals_pending',
        label: 'Renewal Review',
        value: 0,
        sub: 'Renewal records that still need processing',
        path: '/admin/renewals',
      },
      {
        key: 'ro_attention',
        label: 'RO Obligations',
        value: 0,
        sub: 'Active obligations or logs requiring attention',
        path: '/admin/obligations',
      },
      {
        key: 'payout_pending',
        label: 'Payout Status',
        value: 0,
        sub: 'Scholar payout entries still Pending or On Hold',
        path: '/admin/payout',
      },
      {
        key: 'waiting_list',
        label: 'Waiting List',
        value: 0,
        sub: 'Qualified applicants currently waiting for capacity',
        path: '/admin/applications',
      },
    ];
  }, [dashboard.actionSummary]);


  const summaryByKey = useMemo(() => {
    return summaryCards.reduce((accumulator, item) => {
      accumulator[item.key] = item;
      return accumulator;
    }, {});
  }, [summaryCards]);

  const adminSnapshotCards = useMemo(() => ([
    {
      ...(summaryByKey.ready_for_activation || {
        key: 'ready_for_activation',
        label: 'Ready for Activation',
        value: 0,
        sub: 'Reserved or promoted applicants ready for scholar activation',
      }),
      icon: FileCheck2,
      path: '/admin/applications',
    },
    {
      ...(summaryByKey.waitlisted || {
        key: 'waitlisted',
        label: 'Waiting List',
        value: 0,
        sub: 'Qualified applicants currently waiting for scholarship capacity',
      }),
      icon: Clock3,
      path: '/admin/applications',
    },
    {
      ...(summaryByKey.open_openings || {
        key: 'open_openings',
        label: 'Open Openings',
        value: 0,
        sub: 'Scholarship openings currently accepting applicants',
      }),
      icon: Megaphone,
      path: '/admin/openings',
    },
    {
      ...(summaryByKey.benefactors || {
        key: 'benefactors',
        label: 'Benefactors',
        value: 0,
        sub: 'Active scholarship benefactors represented in the system',
      }),
      icon: Building2,
      path: '/admin/maintenance',
    },
  ]), [summaryByKey]);

  const pipelineData = useMemo(
    () => dashboard.applicationPipeline.map((item) => ({
      ...item,
      value: Number(item.value || 0),
    })),
    [dashboard.applicationPipeline]
  );

  const pipelineTotal = useMemo(
    () => pipelineData.reduce((total, item) => total + item.value, 0),
    [pipelineData]
  );

  if (loading) {
    return (
      <PageLoadingSkeleton
        label="Loading Admin dashboard"
        variant="dashboard"
      />
    );
  }

  if (error) {
    return (
      <div className="space-y-4 py-2" style={{ background: C.bg }}>
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-7 w-7 text-red-400" />
          <p className="text-sm font-semibold text-red-800">
            Failed to load dashboard
          </p>
          <p className="mt-1 text-xs text-red-600">{error}</p>

          <Button
            onClick={() => loadDashboard({ audit: true })}
            variant="outline"
            className="mt-4 border-red-200 text-red-600"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2" style={{ background: C.bg }}>
      <section
        className="overflow-hidden rounded-[28px] text-white shadow-sm"
        style={{ background: `linear-gradient(135deg, ${theme.base} 0%, ${theme.active} 55%, ${theme.accent} 100%)` }}
      >
        <div className="flex flex-col gap-6 px-6 py-6 xl:flex-row xl:items-end xl:justify-between lg:px-7">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85">
              <LayoutDashboard className="h-3.5 w-3.5" />
              OSFA Administration
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">Administrator Dashboard</h1>
            <p className="mt-2 text-sm text-white/80">
              Monitor scholarship operations, pending work, scholars, payouts, and openings from one administrative workspace.
            </p>
            <p className="mt-3 text-xs text-white/60">Updated {formatDateTime(dashboard.generatedAt)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Applications', summaryByKey.total_applications?.value || 0],
              ['Needs Review', summaryByKey.needs_action?.value || 0],
              ['Active Scholars', summaryByKey.active_scholars?.value || 0],
              ['Active Payouts', summaryByKey.active_payouts?.value || 0],
            ].map(([label, value]) => (
              <div key={label} className="min-w-[118px] rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/70">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{formatNumber(value)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-stone-900">Scholarship operations</p>
            <p className="mt-1 text-sm text-stone-500">Capacity and activation indicators that complement the headline dashboard counts.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              className="h-9 border-none px-3 text-xs font-medium text-white shadow-sm"
              style={{ background: theme.base }}
              onClick={() => navigate('/admin/applications')}
            >
              Open Applications
              <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-9 bg-white px-3 text-xs font-medium"
              style={{ borderColor: theme.border, color: theme.base }}
              onClick={() => loadDashboard({ audit: true })}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {adminSnapshotCards.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.path)}
                className="group rounded-[20px] border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderColor: C.border }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-xl"
                    style={{ background: theme.accentSoft, color: theme.base }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-stone-500" />
                </div>
                <p className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">
                  {formatNumber(item.value)}
                </p>
                <p className="mt-1 text-sm font-semibold text-stone-800">{item.label}</p>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-stone-500">{item.sub}</p>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 2xl:grid-cols-[0.92fr_1.08fr]">
        <Card
          className="rounded-[24px] shadow-none"
          style={{ borderColor: C.border, background: C.surface }}
        >
          <CardHeader className="border-b border-stone-100">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-stone-500" />
              <CardTitle className="text-base font-semibold">
                Action Center
              </CardTitle>
            </div>
            <p className="text-sm text-stone-500">
              Work items that may require administrator attention.
            </p>
          </CardHeader>

          <CardContent className="grid gap-3 p-5 sm:grid-cols-2 2xl:grid-cols-1">
            {actionSummary.map((item) => (
              <ActionRow
                key={item.key}
                item={item}
                onOpen={(path) => navigate(path)}
              />
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-5">
          <Card
            className="min-w-0 rounded-[24px] shadow-none"
            style={{ borderColor: C.border, background: C.surface }}
          >
            <CardHeader className="border-b border-stone-100">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">
                    Application Flow
                  </CardTitle>
                  <p className="mt-1 text-sm text-stone-500">
                    Distribution of active applications across the current scholarship processing stages.
                  </p>
                </div>
                <div className="shrink-0 rounded-xl bg-stone-50 px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Tracked</p>
                  <p className="text-lg font-semibold text-stone-900">{formatNumber(pipelineTotal)}</p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5">
              {pipelineData.length && pipelineTotal > 0 ? (
                <div className="space-y-5">
                  <div className="flex h-3 overflow-hidden rounded-full bg-stone-100" aria-label="Application stage distribution">
                    {pipelineData.map((item, index) => {
                      if (item.value <= 0) return null;
                      return (
                        <div
                          key={`${item.name}-${index}`}
                          title={`${item.name}: ${formatNumber(item.value)}`}
                          style={{
                            width: `${Math.max((item.value / pipelineTotal) * 100, 1.5)}%`,
                            background: CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                      );
                    })}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    {pipelineData.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50/50 px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                          />
                          <span className="min-w-0 text-sm leading-5 text-stone-600">
                            {item.name}
                          </span>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-stone-900">
                          {formatNumber(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="min-h-[190px]">
                  <EmptyChart label="No active application flow is available yet." />
                </div>
              )}
            </CardContent>
          </Card>

          <Card
            className="min-w-0 rounded-[24px] shadow-none"
            style={{ borderColor: C.border, background: C.surface }}
          >
            <CardHeader className="border-b border-stone-100">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-stone-500" />
                <CardTitle className="text-base font-semibold">
                  Active Scholars by Benefactor
                </CardTitle>
              </div>
              <p className="text-sm text-stone-500">
                Distribution of currently active scholars across benefactors.
              </p>
            </CardHeader>

            <CardContent className="grid min-h-[250px] min-w-0 grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(220px,1fr)]">
              {dashboard.scholarsByBenefactor.length ? (
                <>
                  <div className="h-[220px] min-w-0">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                      minWidth={0}
                      minHeight={1}
                    >
                      <PieChart>
                        <Pie
                          data={dashboard.scholarsByBenefactor}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={54}
                          outerRadius={88}
                          paddingAngle={2}
                        >
                          {dashboard.scholarsByBenefactor.map((entry, index) => (
                            <Cell
                              key={`${entry.name}-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip {...TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid content-center gap-2 sm:grid-cols-2 lg:grid-cols-1">
                    {dashboard.scholarsByBenefactor.map((item, index) => (
                      <div
                        key={`${item.name}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 px-3 py-2.5"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{
                              background:
                                CHART_COLORS[index % CHART_COLORS.length],
                            }}
                          />
                          <span className="truncate text-sm text-stone-600">
                            {item.name}
                          </span>
                        </div>

                        <span className="text-sm font-semibold text-stone-800">
                          {formatNumber(item.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="lg:col-span-2">
                  <EmptyChart label="No active scholar distribution is available yet." />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card
        className="min-w-0 rounded-[24px] shadow-none"
        style={{ borderColor: C.border, background: C.surface }}
      >
        <CardHeader className="border-b border-stone-100">
          <CardTitle className="text-base font-semibold">
            Recent Applicants
          </CardTitle>
          <p className="text-sm text-stone-500">
            Latest active application records across scholarship openings.
          </p>
        </CardHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[170px]">Student</TableHead>
                <TableHead className="min-w-[200px]">
                  Program / Opening
                </TableHead>
                <TableHead className="min-w-[140px]">
                  Application Status
                </TableHead>
                <TableHead className="min-w-[140px]">
                  Requirements Status
                </TableHead>
                <TableHead className="min-w-[130px]">
                  FCFS / Activation
                </TableHead>
                <TableHead className="min-w-[110px]">Submitted</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {dashboard.recentApplications.length ? (
                dashboard.recentApplications.map((row) => {
                  const appMeta = getStatusMeta(row.application_status);
                  const documentMeta = getStatusMeta(row.document_status);
                  const workflowMeta = getStatusMeta(row.workflow_status);

                  return (
                    <TableRow key={row.application_id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-stone-800">
                            {row.student_name || 'Unknown Student'}
                          </p>
                          <p className="text-xs text-stone-400">
                            {row.student_number || 'No Student ID'}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div>
                          <p className="text-sm text-stone-700">
                            {row.program_name || 'No Program'}
                          </p>
                          <p className="text-xs text-stone-400">
                            {row.opening_title || 'No Opening'}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <span
                          className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{
                            background: appMeta.bg,
                            color: appMeta.color,
                          }}
                        >
                          {row.application_status || 'Unknown'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span
                          className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{
                            background: documentMeta.bg,
                            color: documentMeta.color,
                          }}
                        >
                          {row.document_status || 'Unknown'}
                        </span>
                      </TableCell>

                      <TableCell>
                        <span
                          className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold"
                          style={{
                            background: workflowMeta.bg,
                            color: workflowMeta.color,
                          }}
                        >
                          {row.workflow_status || 'Processing'}
                        </span>
                      </TableCell>

                      <TableCell className="text-xs text-stone-500">
                        {formatDate(row.submission_date)}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6}>
                    <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 text-center">
                      <AlertCircle className="h-5 w-5 text-stone-300" />
                      <p className="text-sm font-medium text-stone-500">
                        No application records found.
                      </p>
                      <p className="text-xs text-stone-400">
                        New applications will appear here.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}