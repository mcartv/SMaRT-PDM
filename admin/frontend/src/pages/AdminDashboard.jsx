import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, GraduationCap, TrendingUp, TrendingDown, Download, AlertCircle, Award,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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
  { label: 'UAQTEA Beneficiaries', value: '2,418', sub: '1st Sem · AY 2025–26', icon: Users, accent: C.brown, soft: C.amberSoft, trend: '+15.9%', up: true },
  { label: 'TDP Scholars', value: '24', sub: '15 + 9 per semester', icon: Award, accent: C.amber, soft: '#fef3c7', trend: '−71.1%', up: false },
  { label: 'FHE Graduates', value: '1,517', sub: 'Cumulative 2020–2025', icon: GraduationCap, accent: C.green, soft: C.greenSoft, trend: '+Total', up: true },
  { label: 'Private Beneficiaries', value: '126', sub: '1st Sem · AY 2025–26', icon: Users, accent: C.brownLight, soft: C.sand, trend: 'New AY', up: true },
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

const INSIGHTS = [
  { label: 'UAQTEA Growth', val: '64%', note: 'From 1,473 (2018) → 2,418 (2025)', accent: C.brown, soft: C.amberSoft },
  { label: 'TDP Decline', val: '94%', note: 'Peak 386 (2021–22) → 24 (2024–25)', accent: C.amber, soft: '#fef3c7' },
  { label: 'FHE Peak Batch', val: '382', note: 'Highest graduate count in 2023', accent: C.green, soft: C.greenSoft },
  { label: 'Kaizen Dominance', val: '76%', note: '96 of 126 private beneficiaries', accent: C.brownLight, soft: C.sand },
  { label: 'BSIT Leading', val: '34', note: 'Most private assistance recipients', accent: C.brownMid, soft: '#fef9f0' },
  { label: 'Summer Recovery', val: '240', note: 'FHE from 0 (pandemic) → 240 in 2025', accent: C.amber, soft: C.amberSoft },
];

// ─── Component ───────────────────────────────────────────────────
export default function AdminDashboard() {
  return (
    <div className="space-y-6 py-2" style={{ background: C.bg }}>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: C.text }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>OSFA Scholarship Monitoring & Tracking · AY 2025–2026</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-lg border-stone-200 text-stone-600 text-xs">
            Schedule Report
          </Button>
          <Button size="sm" className="rounded-lg text-white text-xs border-none" style={{ background: C.brownMid }}>
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export Analytics
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map((s) => (
          <Card key={s.label} className="border-stone-200 shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pt-4 px-4">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: s.soft }}>
                <s.icon className="w-4 h-4" style={{ color: s.accent }} />
              </div>
              <Badge
                variant="outline"
                className={`border-none text-xs font-medium ${s.up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}
              >
                {s.up ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                {s.trend}
              </Badge>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold" style={{ color: C.text }}>{s.value}</div>
              <p className="text-xs font-medium text-stone-500 mt-0.5">{s.label}</p>
              <p className="text-[11px] text-stone-400 mt-0.5">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Enrollment Trends (Tabbed Charts) */}
      <Card className="border-stone-200 shadow-none">
        <Tabs defaultValue="uaqtea" className="w-full">
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-b border-stone-100 pb-4">
            <div>
              <CardTitle className="text-base font-semibold">Enrollment Trends</CardTitle>
              <CardDescription className="text-xs mt-0.5">Longitudinal program participation metrics</CardDescription>
            </div>
            <TabsList className="bg-stone-100 p-1 rounded-lg h-8">
              <TabsTrigger value="uaqtea" className="rounded-md text-xs px-4 h-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">UAQTEA</TabsTrigger>
              <TabsTrigger value="tdp" className="rounded-md text-xs px-4 h-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">TDP</TabsTrigger>
              <TabsTrigger value="fhe" className="rounded-md text-xs px-4 h-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">FHE</TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent className="pt-4">
            <TabsContent value="uaqtea" className="h-72 mt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={UAQTEA_DATA} barGap={4} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="year" {...AXIS_PROPS} />
                  <YAxis domain={[0, 2700]} {...AXIS_PROPS} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="sem1" fill={C.brownMid} name="1st Semester" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="sem2" fill={C.yellow} name="2nd Semester" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="tdp" className="h-72 mt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={TDP_DATA} barGap={4} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="year" {...AXIS_PROPS} />
                  <YAxis domain={[0, 220]} {...AXIS_PROPS} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="sem1" fill={C.brownMid} name="1st Sem" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="sem2" fill={C.amber} name="2nd Sem" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="fhe" className="h-72 mt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={FHE_GRAD_DATA} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="batch" {...AXIS_PROPS} />
                  <YAxis domain={[0, 420]} {...AXIS_PROPS} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v} graduates`]} />
                  <Bar dataKey="n" name="Graduates" radius={[3, 3, 0, 0]}>
                    {FHE_GRAD_DATA.map((e) => (
                      <Cell key={e.batch} fill={e.batch === '2023' ? C.yellow : C.brownLight} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Secondary Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-stone-200 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">FHE Summer Enrollment</CardTitle>
            <CardDescription className="text-xs">Performance during post-pandemic recovery</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={FHE_SUMMER_DATA} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="year" {...AXIS_PROPS} />
                  <YAxis domain={[0, 270]} {...AXIS_PROPS} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v} scholars`]} />
                  <Bar dataKey="n" name="Enrolled" radius={[3, 3, 0, 0]}>
                    {FHE_SUMMER_DATA.map((e, i) => (
                      <Cell key={i} fill={e.pandemic ? C.red : C.brownMid} opacity={e.pandemic ? 0.25 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-stone-500 bg-stone-50 px-3 py-2 rounded-lg border border-stone-100">
              <AlertCircle size={13} className="text-stone-400 shrink-0" />
              Pandemic zero-enrollment period: 2019–2022.
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Distribution by Benefactor</CardTitle>
            <CardDescription className="text-xs">Stakeholder contribution weighting</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-6">
            <div className="h-44 w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={BENEFACTORS} cx="50%" cy="50%" innerRadius={52} outerRadius={72} dataKey="value" paddingAngle={4}>
                    {BENEFACTORS.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 space-y-2.5">
              {BENEFACTORS.map((e) => (
                <div key={e.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-sm" style={{ background: e.color }} />
                    <span className="text-stone-600">{e.name}</span>
                  </div>
                  <span className="font-medium text-stone-800">
                    {e.value} <span className="text-stone-400 font-normal">({Math.round(e.value / BENEFACTOR_TOTAL * 100)}%)</span>
                  </span>
                </div>
              ))}
              <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs font-medium">
                <span style={{ color: C.text }}>Total Support</span>
                <span style={{ color: C.brownMid }}>{BENEFACTOR_TOTAL}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Assistance Matrix */}
      <Card className="border-stone-200 shadow-none overflow-hidden">
        <CardHeader className="bg-stone-50/60 border-b border-stone-100 pb-3">
          <CardTitle className="text-sm font-semibold">Financial Assistance Matrix</CardTitle>
          <CardDescription className="text-xs">Cross-program distribution of private sector assistance</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader className="bg-stone-50/80">
            <TableRow className="hover:bg-transparent border-stone-100">
              <TableHead className="font-medium text-stone-700 py-3 px-5 text-xs">Academic Program</TableHead>
              <TableHead className="text-center font-medium text-stone-500 text-xs">BC Packaging</TableHead>
              <TableHead className="text-center font-medium text-stone-500 text-xs">Food Crafters</TableHead>
              <TableHead className="text-center font-medium text-stone-500 text-xs">Genmart</TableHead>
              <TableHead className="text-center font-medium text-stone-500 text-xs">Kaizen</TableHead>
              <TableHead className="text-center font-medium text-stone-700 text-xs">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FAB_ROWS.map((row) => (
              <TableRow key={row.program} className="hover:bg-amber-50/20 border-stone-100 transition-colors">
                <TableCell className="font-medium text-stone-800 py-3 px-5 text-sm">{row.program}</TableCell>
                <TableCell className="text-center text-stone-500 text-sm">{row.bcPkg || '—'}</TableCell>
                <TableCell className="text-center text-stone-500 text-sm">{row.food || '—'}</TableCell>
                <TableCell className="text-center text-stone-500 text-sm">{row.gen || '—'}</TableCell>
                <TableCell className="text-center text-stone-500 text-sm">{row.kai || '—'}</TableCell>
                <TableCell className="text-center font-semibold text-white text-sm" style={{ background: C.brownMid }}>{row.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {INSIGHTS.map((ins) => (
          <Card key={ins.label} className="border-none shadow-none hover:-translate-y-0.5 transition-transform" style={{ background: ins.soft }}>
            <CardContent className="pt-4 pb-4">
              <Badge className="mb-2 bg-white/60 border-none text-xs font-medium" style={{ color: ins.accent }}>
                {ins.label}
              </Badge>
              <div className="text-2xl font-semibold mb-1" style={{ color: ins.accent }}>{ins.val}</div>
              <p className="text-xs text-stone-600/70 leading-relaxed">{ins.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <footer className="pt-6 pb-2 border-t border-stone-100">
        <p className="text-center text-[11px] text-stone-300 uppercase tracking-widest">
          SMaRT PDM · Integrated Scholarship Management
        </p>
      </footer>
    </div>
  );
}