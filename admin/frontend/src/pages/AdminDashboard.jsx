import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSocketEvent } from '@/hooks/useSocket';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Users,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Award,
  FileCheck2,
  ClipboardList,
  Building2,
  Loader2,
  RefreshCw,
  FileWarning,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
    borderRadius: 8,
    fontSize: 12,
    color: C.text,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
};

const AXIS_PROPS = {
  tick: { fontSize: 11, fill: C.muted },
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
  pending_review: FileWarning,
  verified_documents: FileCheck2,
  active_scholars: GraduationCap,
  open_openings: Award,
  benefactors: Building2,
  default: Users,
};

function formatNumber(value) {
  const num = Number(value || 0);
  return num.toLocaleString();
}

function getStatusMeta(status) {
  const normalized = String(status || '').toLowerCase();

  if (normalized.includes('approved') || normalized.includes('verified') || normalized.includes('active')) {
    return {
      bg: C.greenSoft,
      color: C.green,
    };
  }

  if (normalized.includes('pending') || normalized.includes('review') || normalized.includes('queued')) {
    return {
      bg: C.amberSoft,
      color: C.amber,
    };
  }

  if (normalized.includes('rejected') || normalized.includes('flagged') || normalized.includes('disqualified')) {
    return {
      bg: C.redSoft,
      color: C.red,
    };
  }

  return {
    bg: C.sand,
    color: C.muted,
  };
}

function EmptyChart({ label }) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/70">
      <AlertCircle className="mb-2 h-5 w-5 text-stone-300" />
      <p className="text-xs font-medium text-stone-500">{label}</p>
    </div>
  );
}

function StatCard({ item }) {
  const Icon = ICON_MAP[item.key] || ICON_MAP.default;
  const up = item.up !== false;

  return (
    <Card className="shadow-none" style={{ borderColor: C.border, background: C.surface }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{
            background: item.soft || C.amberSoft,
          }}
        >
          <Icon
            className="h-4 w-4"
            style={{
              color: item.accent || C.brown,
            }}
          />
        </div>

        <Badge
          variant="outline"
          className="border-none text-xs font-medium"
          style={{
            background: up ? C.greenSoft : C.redSoft,
            color: up ? C.green : C.red,
          }}
        >
          {up ? (
            <TrendingUp className="mr-1 h-3 w-3" />
          ) : (
            <TrendingDown className="mr-1 h-3 w-3" />
          )}
          {item.trend || 'Live'}
        </Badge>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        <div className="text-2xl font-semibold">{formatNumber(item.value)}</div>
        <p className="text-xs text-stone-500">{item.label}</p>
        <p className="text-[11px] text-stone-400">{item.sub || 'Current system data'}</p>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState({
    summaryCards: [],
    applicationStatus: [],
    openingStatus: [],
    documentSummary: [],
    scholarsByBenefactor: [],
    recentApplications: [],
  });
  const [loading, setLoading] = useState(true);
  const [silentLoading, setSilentLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    const audit = options.audit === true;

    try {
      if (silent) {
        setSilentLoading(true);
      } else {
        setLoading(true);
      }

      setError('');

      const token = sessionStorage.getItem('adminToken') || '';

      const res = await fetch(buildApiUrl(`/api/dashboard${audit ? '?audit=1' : ''}`), {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const payload = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(payload?.message || payload?.error || 'Failed to load dashboard data.');
      }

      setDashboard({
        summaryCards: Array.isArray(payload.summaryCards) ? payload.summaryCards : [],
        applicationStatus: Array.isArray(payload.applicationStatus) ? payload.applicationStatus : [],
        openingStatus: Array.isArray(payload.openingStatus) ? payload.openingStatus : [],
        documentSummary: Array.isArray(payload.documentSummary) ? payload.documentSummary : [],
        scholarsByBenefactor: Array.isArray(payload.scholarsByBenefactor) ? payload.scholarsByBenefactor : [],
        recentApplications: Array.isArray(payload.recentApplications) ? payload.recentApplications : [],
      });
    } catch (err) {
      console.error('DASHBOARD LOAD ERROR:', err);
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
      setSilentLoading(false);
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
  useSocketEvent('application-ocr:queued', refreshRealtime, [refreshRealtime]);
  useSocketEvent('application-ocr:snapshot-saved', refreshRealtime, [refreshRealtime]);

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

  useSocketEvent('ro:updated', refreshRealtime, [refreshRealtime]);
  useSocketEvent('ro:archived', refreshRealtime, [refreshRealtime]);
  useSocketEvent('ro:restored', refreshRealtime, [refreshRealtime]);

  useSocketEvent('maintenance:updated', refreshRealtime, [refreshRealtime]);
  useSocketEvent('report:updated', refreshRealtime, [refreshRealtime]);

  const summaryCards = useMemo(() => {
    if (dashboard.summaryCards.length) return dashboard.summaryCards;

    return [
      {
        key: 'total_applications',
        label: 'Total Applications',
        value: 0,
        sub: 'Current active records',
        trend: 'Live',
        up: true,
        accent: C.brown,
        soft: C.amberSoft,
      },
      {
        key: 'pending_review',
        label: 'Pending Review',
        value: 0,
        sub: 'Applications needing action',
        trend: 'Needs action',
        up: false,
        accent: C.amber,
        soft: C.amberSoft,
      },
      {
        key: 'verified_documents',
        label: 'Verified Documents',
        value: 0,
        sub: 'Completed verification',
        trend: 'Verified',
        up: true,
        accent: C.green,
        soft: C.greenSoft,
      },
      {
        key: 'active_scholars',
        label: 'Active Scholars',
        value: 0,
        sub: 'Current scholar records',
        trend: 'Current',
        up: true,
        accent: C.brownLight,
        soft: C.sand,
      },
    ];
  }, [dashboard.summaryCards]);

  if (loading) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3" style={{ background: C.bg }}>
        <Loader2 className="h-7 w-7 animate-spin text-stone-300" />
        <p className="text-xs uppercase tracking-widest text-stone-400">
          Loading dashboard...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 py-2" style={{ background: C.bg }}>
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-7 w-7 text-red-400" />
          <p className="text-sm font-semibold text-red-800">Failed to load dashboard</p>
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
    <div className="space-y-5 py-2" style={{ background: C.bg }}>
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          className="h-8 rounded-lg border-stone-200 text-xs"
          onClick={() => loadDashboard({ silent: true })}
          disabled={silentLoading}
        >
          {silentLoading ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          )}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((item) => (
          <StatCard key={item.key || item.label} item={item} />
        ))}
      </div>

      <Card className="shadow-none" style={{ borderColor: C.border, background: C.surface }}>
        <Tabs defaultValue="applications" className="w-full">
          <CardHeader className="flex flex-col gap-3 border-b border-stone-100 pb-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-sm font-semibold">
              Scholarship Operations Overview
            </CardTitle>

            <TabsList
              className="h-8 rounded-lg p-1"
              style={{ background: 'color-mix(in srgb, var(--portal-base) 8%, white)' }}
            >
              <TabsTrigger value="applications" className="px-4 text-xs">
                Applications
              </TabsTrigger>
              <TabsTrigger value="openings" className="px-4 text-xs">
                Openings
              </TabsTrigger>
              <TabsTrigger value="documents" className="px-4 text-xs">
                Documents
              </TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="h-72 pt-4">
            <TabsContent value="applications" className="h-full">
              {dashboard.applicationStatus.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.applicationStatus}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                    <XAxis dataKey="name" {...AXIS_PROPS} />
                    <YAxis {...AXIS_PROPS} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="value" fill={C.brownMid} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No application status data available." />
              )}
            </TabsContent>

            <TabsContent value="openings" className="h-full">
              {dashboard.openingStatus.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.openingStatus}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                    <XAxis dataKey="name" {...AXIS_PROPS} />
                    <YAxis {...AXIS_PROPS} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="value" fill={C.yellow} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No scholarship opening data available." />
              )}
            </TabsContent>

            <TabsContent value="documents" className="h-full">
              {dashboard.documentSummary.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.documentSummary}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                    <XAxis dataKey="name" {...AXIS_PROPS} />
                    <YAxis {...AXIS_PROPS} allowDecimals={false} />
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Bar dataKey="value" fill={C.amber} radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChart label="No document verification data available." />
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="shadow-none" style={{ borderColor: C.border, background: C.surface }}>
          <CardHeader>
            <CardTitle className="text-sm">Document / OCR Verification Summary</CardTitle>
          </CardHeader>

          <CardContent className="h-56">
            {dashboard.documentSummary.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.documentSummary}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={C.border} />
                  <XAxis dataKey="name" {...AXIS_PROPS} />
                  <YAxis {...AXIS_PROPS} allowDecimals={false} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="value" fill={C.brownMid} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label="No OCR or document records found." />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none" style={{ borderColor: C.border, background: C.surface }}>
          <CardHeader>
            <CardTitle className="text-sm">Scholars by Benefactor</CardTitle>
          </CardHeader>

          <CardContent className="grid h-56 grid-cols-1 gap-3 md:grid-cols-[1fr_180px]">
            {dashboard.scholarsByBenefactor.length ? (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dashboard.scholarsByBenefactor}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
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

                <div className="flex flex-col justify-center gap-2 overflow-y-auto">
                  {dashboard.scholarsByBenefactor.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="truncate text-xs text-stone-600">{item.name}</span>
                      </div>
                      <span className="text-xs font-semibold text-stone-800">
                        {formatNumber(item.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="md:col-span-2">
                <EmptyChart label="No benefactor-scholar distribution available." />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-none" style={{ borderColor: C.border, background: C.surface }}>
        <CardHeader className="border-b border-stone-100">
          <CardTitle className="text-sm">Recent Applications Needing Action</CardTitle>
        </CardHeader>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Program / Opening</TableHead>
              <TableHead>Application Status</TableHead>
              <TableHead>Document Status</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {dashboard.recentApplications.length ? (
              dashboard.recentApplications.map((row) => {
                const appMeta = getStatusMeta(row.application_status);
                const docMeta = getStatusMeta(row.document_status);

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
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
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
                        className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                        style={{
                          background: docMeta.bg,
                          color: docMeta.color,
                        }}
                      >
                        {row.document_status || 'Unknown'}
                      </span>
                    </TableCell>

                    <TableCell className="text-xs text-stone-500">
                      {row.submission_date
                        ? new Date(row.submission_date).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 text-center">
                    <AlertCircle className="h-5 w-5 text-stone-300" />
                    <p className="text-sm font-medium text-stone-500">
                      No pending application work items.
                    </p>
                    <p className="text-xs text-stone-400">
                      Recent applications needing review will appear here.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}