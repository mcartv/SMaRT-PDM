import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocketEvent } from '@/hooks/useSocket';
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
  Award,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  FileCheck2,
  GraduationCap,
  ListOrdered,
  RefreshCw,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
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

const AXIS_PROPS = {
  tick: { fontSize: 12, fill: C.muted },
  axisLine: false,
  tickLine: false,
};

const CHART_COLORS = [
  C.brownMid,
  C.yellow,
  C.amber,
  C.brownLight,
  C.green,
  C.red,
];

const ICON_MAP = {
  total_applications: ClipboardList,
  needs_action: ClipboardCheck,
  ready_for_activation: FileCheck2,
  waitlisted: ListOrdered,
  active_scholars: GraduationCap,
  open_openings: Award,
  active_payouts: Wallet,
  benefactors: Building2,
  default: Users,
};

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
      <p className="text-xs font-medium text-stone-500">{label}</p>
    </div>
  );
}

function StatCard({ item }) {
  const Icon = ICON_MAP[item.key] || ICON_MAP.default;

  return (
    <Card
      className="min-w-0 rounded-xl shadow-none"
      style={{ borderColor: C.border, background: C.surface }}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <p className="text-xs font-medium leading-4 text-stone-500">
              {item.label}
            </p>
            <p className="mt-1 text-xl font-semibold leading-none text-stone-900">
              {formatNumber(item.value)}
            </p>
          </div>

          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: item.soft || C.amberSoft }}
          >
            <Icon
              className="h-4 w-4"
              style={{ color: item.accent || C.brown }}
            />
          </div>
        </div>

        <p className="mt-2 text-xs leading-4 text-stone-400">
          {item.sub || 'Current system data'}
        </p>
      </CardContent>
    </Card>
  );
}

function ActionRow({ item, onOpen }) {
  const count = Number(item.value || 0);
  const needsAttention = count > 0;

  return (
    <button
      type="button"
      onClick={() => onOpen(item.path)}
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-3.5 py-3 text-left transition hover:border-stone-300 hover:bg-stone-50"
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-stone-800">{item.label}</p>
        <p className="mt-0.5 text-xs leading-4 text-stone-500">{item.sub}</p>
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
            size="sm"
            className="mt-4 border-red-200 text-xs text-red-600"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-1" style={{ background: C.bg }}>
      <section>
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 2xl:grid-cols-8">
          {summaryCards.map((item) => (
            <StatCard key={item.key || item.label} item={item} />
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.45fr)]">
        <Card
          className="shadow-none"
          style={{ borderColor: C.border, background: C.surface }}
        >
          <CardHeader className="border-b border-stone-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-stone-500" />
              <CardTitle className="text-sm font-semibold">
                Action Center
              </CardTitle>
            </div>
            <p className="text-xs text-stone-500">
              Work items that may require administrator attention.
            </p>
          </CardHeader>

          <CardContent className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-1">
            {actionSummary.map((item) => (
              <ActionRow
                key={item.key}
                item={item}
                onOpen={(path) => navigate(path)}
              />
            ))}
          </CardContent>
        </Card>

        <Card
          className="min-w-0 shadow-none"
          style={{ borderColor: C.border, background: C.surface }}
        >
          <CardHeader className="border-b border-stone-100 px-4 py-3">
            <CardTitle className="text-sm font-semibold">
              Application Lifecycle
            </CardTitle>
            <p className="text-xs text-stone-500">
              Current active applications grouped by their actual workflow stage.
            </p>
          </CardHeader>

          <CardContent className="h-[280px] min-h-0 min-w-0 px-3 pb-3 pt-3">
            {dashboard.applicationPipeline.length ? (
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={1}
              >
                <BarChart
                  data={dashboard.applicationPipeline}
                  layout="vertical"
                  margin={{ top: 4, right: 16, bottom: 4, left: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke={C.border}
                  />
                  <XAxis
                    type="number"
                    {...AXIS_PROPS}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={126}
                    {...AXIS_PROPS}
                  />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar
                    dataKey="value"
                    fill={C.brownMid}
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No active application data available." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card
        className="min-w-0 shadow-none"
        style={{ borderColor: C.border, background: C.surface }}
      >
        <CardHeader className="border-b border-stone-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-stone-500" />
            <CardTitle className="text-sm font-semibold">
              Active Scholars by Benefactor
            </CardTitle>
          </div>
          <p className="text-xs text-stone-500">
            Distribution of currently active scholars across benefactors.
          </p>
        </CardHeader>

        <CardContent className="grid min-h-[230px] min-w-0 grid-cols-1 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(210px,0.65fr)]">
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
                      innerRadius={58}
                      outerRadius={92}
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
                    className="flex items-center justify-between gap-3 rounded-lg border border-stone-100 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          background:
                            CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                      <span className="truncate text-xs text-stone-600">
                        {item.name}
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-stone-800">
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

      <Card
        className="min-w-0 shadow-none"
        style={{ borderColor: C.border, background: C.surface }}
      >
        <CardHeader className="border-b border-stone-100 px-4 py-3">
          <CardTitle className="text-sm font-semibold">
            Recent Applicants
          </CardTitle>
          <p className="text-xs text-stone-500">
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