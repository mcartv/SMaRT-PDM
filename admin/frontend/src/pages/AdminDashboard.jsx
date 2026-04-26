import React from 'react';
import { useSocketEvent } from '@/hooks/useSocket';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users,
  GraduationCap,
  TrendingUp,
  TrendingDown,
  Download,
  AlertCircle,
  Award,
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

// ─── Theme ───────────────────────────────────────────────────────
const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  brownLight: '#92500f',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  yellow: '#fbbf24',
  sand: '#fdf6ec',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  border: '#e8d5b7',
  muted: '#78716c',
  text: '#1c1917',
  bg: '#faf7f2',
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: '#fff',
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

// ─── Data ────────────────────────────────────────────────────────
const STATS = [
  {
    label: 'UAQTEA Beneficiaries',
    value: '2,418',
    sub: '1st Sem · AY 2025–26',
    icon: Users,
    accent: C.brown,
    soft: C.amberSoft,
    trend: '+15.9%',
    up: true,
  },
  {
    label: 'TDP Scholars',
    value: '24',
    sub: '15 + 9 per semester',
    icon: Award,
    accent: C.amber,
    soft: '#fef3c7',
    trend: '−71.1%',
    up: false,
  },
  {
    label: 'FHE Graduates',
    value: '1,517',
    sub: 'Cumulative 2020–2025',
    icon: GraduationCap,
    accent: C.green,
    soft: C.greenSoft,
    trend: '+Total',
    up: true,
  },
  {
    label: 'Private Beneficiaries',
    value: '126',
    sub: '1st Sem · AY 2025–26',
    icon: Users,
    accent: C.brownLight,
    soft: C.sand,
    trend: 'New AY',
    up: true,
  },
];

const UAQTEA_DATA = [
  { year: '18–19', sem1: 1473, sem2: 1441 },
  { year: '19–20', sem1: 1523, sem2: 1390 },
  { year: '20–21', sem1: 1630, sem2: 1468 },
  { year: '21–22', sem1: 1654, sem2: 1565 },
  { year: '22–23', sem1: 1727, sem2: 1685 },
  { year: '23–24', sem1: 1876, sem2: 1750 },
  { year: '24–25', sem1: 2087, sem2: 1966 },
  { year: '25–26', sem1: 2418, sem2: null },
];

const TDP_DATA = [
  { year: '19–20', sem1: 138, sem2: 128 },
  { year: '20–21', sem1: 154, sem2: 167 },
  { year: '21–22', sem1: 196, sem2: 190 },
  { year: '22–23', sem1: 105, sem2: 95 },
  { year: '23–24', sem1: 46, sem2: 37 },
  { year: '24–25', sem1: 15, sem2: 9 },
];

const FHE_GRAD_DATA = [
  { batch: '2020', n: 160 },
  { batch: '2021', n: 134 },
  { batch: '2022', n: 268 },
  { batch: '2023', n: 382 },
  { batch: '2024', n: 279 },
  { batch: '2025', n: 294 },
];

const FHE_SUMMER_DATA = [
  { year: '18–19', n: 162, pandemic: false },
  { year: '19–20', n: 0, pandemic: true },
  { year: '20–21', n: 0, pandemic: true },
  { year: '21–22', n: 0, pandemic: true },
  { year: '22–23', n: 125, pandemic: false },
  { year: '23–24', n: 162, pandemic: false },
  { year: '24–25', n: 240, pandemic: false },
];

const BENEFACTORS = [
  { name: 'Kaizen', value: 96, color: C.brown },
  { name: 'Genmart', value: 15, color: C.brownMid },
  { name: 'Food Crafters', value: 10, color: C.amber },
  { name: 'BC Packaging', value: 5, color: C.yellow },
];

const BENEFACTOR_TOTAL = BENEFACTORS.reduce((s, b) => s + b.value, 0);

const FAB_ROWS = [
  { program: 'BECED', bcPkg: 1, food: 3, gen: 1, kai: 16, total: 21 },
  { program: 'BSCS', bcPkg: 0, food: 0, gen: 0, kai: 11, total: 11 },
  { program: 'BSHM', bcPkg: 1, food: 2, gen: 2, kai: 10, total: 13 },
  { program: 'BSIT', bcPkg: 2, food: 2, gen: 6, kai: 24, total: 34 },
  { program: 'BSOA', bcPkg: 0, food: 2, gen: 3, kai: 5, total: 10 },
  { program: 'BSTM', bcPkg: 1, food: 2, gen: 3, kai: 23, total: 29 },
  { program: 'BTLED', bcPkg: 0, food: 1, gen: 0, kai: 7, total: 8 },
];

// ─── Component ───────────────────────────────────────────────────
export default function AdminDashboard() {
  useSocketEvent('scholar:created', () => { });
  useSocketEvent('payout:created', () => { });
  useSocketEvent('opening:created', () => { });

  return (
    <div className="space-y-5 py-2" style={{ background: C.bg }}>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {STATS.map((s) => (
          <Card key={s.label} className="border-stone-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 pb-2 pt-4">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-xl"
                style={{ background: s.soft }}
              >
                <s.icon className="h-4 w-4" style={{ color: s.accent }} />
              </div>

              <Badge
                variant="outline"
                className={`border-none text-xs font-medium ${s.up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                  }`}
              >
                {s.up ? (
                  <TrendingUp className="mr-1 h-3 w-3" />
                ) : (
                  <TrendingDown className="mr-1 h-3 w-3" />
                )}
                {s.trend}
              </Badge>
            </CardHeader>

            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold">{s.value}</div>
              <p className="text-xs text-stone-500">{s.label}</p>
              <p className="text-[11px] text-stone-400">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Enrollment Trends */}
      <Card className="border-stone-200 shadow-none">
        <Tabs defaultValue="uaqtea" className="w-full">
          <CardHeader className="flex flex-col gap-3 border-b border-stone-100 pb-4 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-sm font-semibold">Enrollment Trends</CardTitle>

            <TabsList className="h-8 rounded-lg bg-stone-100 p-1">
              <TabsTrigger value="uaqtea" className="text-xs px-4">UAQTEA</TabsTrigger>
              <TabsTrigger value="tdp" className="text-xs px-4">TDP</TabsTrigger>
              <TabsTrigger value="fhe" className="text-xs px-4">FHE</TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="pt-4 h-72">
            <TabsContent value="uaqtea" className="h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={UAQTEA_DATA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="sem1" fill={C.brownMid} />
                  <Bar dataKey="sem2" fill={C.yellow} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="tdp" className="h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={TDP_DATA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="sem1" fill={C.brownMid} />
                  <Bar dataKey="sem2" fill={C.amber} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="fhe" className="h-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={FHE_GRAD_DATA}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="batch" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="n" fill={C.brownLight} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

        {/* Summer */}
        <Card className="border-stone-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm">FHE Summer Enrollment</CardTitle>
          </CardHeader>

          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FHE_SUMMER_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="n" fill={C.brownMid} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Benefactors */}
        <Card className="border-stone-200 shadow-none">
          <CardHeader>
            <CardTitle className="text-sm">Benefactor Distribution</CardTitle>
          </CardHeader>

          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={BENEFACTORS} dataKey="value">
                  {BENEFACTORS.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Matrix */}
      <Card className="border-stone-200 shadow-none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Program</TableHead>
              <TableHead>BC</TableHead>
              <TableHead>Food</TableHead>
              <TableHead>Gen</TableHead>
              <TableHead>Kaizen</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {FAB_ROWS.map((row) => (
              <TableRow key={row.program}>
                <TableCell>{row.program}</TableCell>
                <TableCell>{row.bcPkg || '-'}</TableCell>
                <TableCell>{row.food || '-'}</TableCell>
                <TableCell>{row.gen || '-'}</TableCell>
                <TableCell>{row.kai || '-'}</TableCell>
                <TableCell className="font-semibold">{row.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

    </div>
  );
}