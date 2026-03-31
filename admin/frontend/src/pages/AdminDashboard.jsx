import React, { useState } from 'react';
// --- SHADCN UI COMPONENTS ---
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";

// --- ICONS & CHARTS ---
import {
  Users, GraduationCap, TrendingUp, TrendingDown,
  Download, AlertCircle, Award,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── Palette (SMaRT PDM Industry Theme) ─────────────────────────
const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  brownLight: '#92500f',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  yellow: '#fbbf24',
  yellowSoft: '#fef3c7',
  sand: '#fdf6ec',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  border: '#e8d5b7',
  muted: '#a0785a',
  text: '#3b1f0a',
  bg: '#faf7f2',
  white: '#FFFFFF',
};

// ─── Shared Chart Styles ──────────────────────────────────────
const TOOLTIP_STYLE = {
  contentStyle: {
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    fontSize: 12,
    color: C.text,
    boxShadow: '0 4px 12px rgba(107,58,31,0.10)',
  },
};

const AXIS_PROPS = {
  tick: { fontSize: 11, fill: C.muted },
  axisLine: false,
  tickLine: false,
};

// ─── Data (Constants) ────────────────────────────────────────
const STATS = [
  { label: 'UAQTEA Beneficiaries', value: '2,418', sub: '1st Sem · AY 2025–26', icon: Users, accent: C.brown, soft: C.amberSoft, trend: '+15.9%', up: true },
  { label: 'TDP Scholars', value: '24', sub: '15 + 9 per semester', icon: Award, accent: C.amber, soft: C.yellowSoft, trend: '−71.1%', up: false },
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
const FAB_COLS = ['bcPkg', 'food', 'gen', 'kai'];

const INSIGHTS = [
  { label: 'UAQTEA Growth', val: '64%', note: 'From 1,473 (2018) → 2,418 (2025)', accent: C.brown, soft: C.amberSoft },
  { label: 'TDP Decline', val: '94%', note: 'Peak 386 (2021–22) → 24 (2024–25)', accent: C.amber, soft: C.yellowSoft },
  { label: 'FHE Peak Batch', val: '382', note: 'Highest graduate count in 2023', accent: C.green, soft: C.greenSoft },
  { label: 'Kaizen Dominance', val: '76%', note: '96 of 126 private beneficiaries', accent: C.brownLight, soft: C.sand },
  { label: 'BSIT Leading', val: '34', note: 'Most private assistance recipients', accent: C.brownMid, soft: '#fef9f0' },
  { label: 'Summer Recovery', val: '240', note: 'FHE from 0 (pandemic) → 240 in 2025', accent: C.amber, soft: C.amberSoft },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-8 py-2 px-1 animate-in fade-in duration-500" style={{ background: C.bg }}>

      {/* ─── HEADER ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ color: C.text }}>Dashboard</h1>
          <p className="text-sm font-medium" style={{ color: C.muted }}>OSFA Scholarship Monitoring & Tracking · AY 2025–2026</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="rounded-xl border-stone-200">
            Schedule Report
          </Button>
          <Button className="rounded-xl shadow-md text-white border-none" style={{ background: C.brownMid }}>
            <Download className="mr-2 h-4 w-4" /> Export Analytics
          </Button>
        </div>
      </div>

      {/* ─── STATS GRID ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <Card key={s.label} className="border-stone-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-inner" style={{ background: s.soft }}>
                <s.icon className="w-5 h-5" style={{ color: s.accent }} />
              </div>
              <Badge variant="outline" className={`border-none font-bold ${s.up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {s.up ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
                {s.trend}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tighter" style={{ color: C.text }}>{s.value}</div>
              <p className="text-[11px] font-bold text-stone-500 uppercase tracking-widest mt-1">{s.label}</p>
              <p className="text-[10px] text-stone-400 font-medium">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ─── MAIN ANALYTICS SECTION ─── */}
      <Card className="border-stone-200">
        <Tabs defaultValue="uaqtea" className="w-full">
          <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-stone-100 mb-6">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold">Enrollment Trends</CardTitle>
              <CardDescription>Longitudinal program participation metrics</CardDescription>
            </div>
            <TabsList className="bg-stone-100 p-1 rounded-xl">
              <TabsTrigger value="uaqtea" className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">UAQTEA</TabsTrigger>
              <TabsTrigger value="tdp" className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">TDP</TabsTrigger>
              <TabsTrigger value="fhe" className="rounded-lg px-6 data-[state=active]:bg-white data-[state=active]:shadow-sm">FHE</TabsTrigger>
            </TabsList>
          </CardHeader>

          <CardContent>
            <TabsContent value="uaqtea" className="h-[350px] mt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={UAQTEA_DATA} barGap={4} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="year" {...AXIS_PROPS} />
                  <YAxis domain={[0, 2700]} {...AXIS_PROPS} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="sem1" fill={C.brownMid} name="1st Semester" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sem2" fill={C.yellow} name="2nd Semester" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="tdp" className="h-[350px] mt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={TDP_DATA} barGap={4} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="year" {...AXIS_PROPS} />
                  <YAxis domain={[0, 220]} {...AXIS_PROPS} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Bar dataKey="sem1" fill={C.brownMid} name="1st Sem" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="sem2" fill={C.amber} name="2nd Sem" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </TabsContent>

            <TabsContent value="fhe" className="h-[350px] mt-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={FHE_GRAD_DATA} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="batch" {...AXIS_PROPS} />
                  <YAxis domain={[0, 420]} {...AXIS_PROPS} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v} graduates`]} />
                  <Bar dataKey="n" name="Graduates" radius={[4, 4, 0, 0]}>
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

      {/* ─── SECONDARY CHARTS GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-stone-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">FHE Summer Enrollment</CardTitle>
            <CardDescription>Performance during post-pandemic recovery</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={FHE_SUMMER_DATA} barCategoryGap="40%">
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                  <XAxis dataKey="year" {...AXIS_PROPS} />
                  <YAxis domain={[0, 270]} {...AXIS_PROPS} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v} scholars`]} />
                  <Bar dataKey="n" name="Enrolled" radius={[4, 4, 0, 0]}>
                    {FHE_SUMMER_DATA.map((e, i) => (
                      <Cell key={i} fill={e.pandemic ? C.red : C.brownMid} opacity={e.pandemic ? 0.3 : 1} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center gap-3 text-[10px] bg-stone-50/50 p-3 rounded-xl border border-stone-100">
              <AlertCircle size={14} className="text-stone-400" />
              <span className="text-stone-500 font-medium">Pandemic zero-enrollment period: 2019–2022.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-stone-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-bold">Distribution by Benefactor</CardTitle>
            <CardDescription>Stakeholder contribution weighting</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row items-center gap-8 py-6">
            <div className="h-[200px] w-full sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={BENEFACTORS} cx="50%" cy="50%" innerRadius={60} outerRadius={85} dataKey="value" paddingAngle={5}>
                    {BENEFACTORS.map((e, i) => <Cell key={i} fill={e.color} stroke="none" />)}
                  </Pie>
                  <Tooltip {...TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full sm:w-1/2 space-y-3">
              {BENEFACTORS.map((e) => (
                <div key={e.name} className="flex items-center justify-between text-xs group">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />
                    <span className="font-semibold text-stone-600">{e.name}</span>
                  </div>
                  <div className="font-bold text-stone-900">{e.value} <span className="ml-1 text-stone-400 font-medium">({Math.round(e.value / BENEFACTOR_TOTAL * 100)}%)</span></div>
                </div>
              ))}
              <div className="pt-3 mt-3 border-t border-stone-100 flex items-center justify-between text-sm font-black">
                <span style={{ color: C.text }}>Total Support</span>
                <span style={{ color: C.brownMid }}>{BENEFACTOR_TOTAL}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── DATA TABLE (Scholars by Program) ─── */}
      <Card className="border-stone-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-stone-50/40 pb-6 border-b border-stone-100">
          <CardTitle className="text-base font-bold">Financial Assistance Matrix</CardTitle>
          <CardDescription>Cross-program distribution of private sector assistance</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader className="bg-stone-50/80">
            <TableRow className="hover:bg-transparent border-stone-100">
              <TableHead className="font-bold text-stone-900 py-4 px-6">Academic Program</TableHead>
              <TableHead className="text-center font-bold text-stone-500">BC Packaging</TableHead>
              <TableHead className="text-center font-bold text-stone-500">Food Crafters</TableHead>
              <TableHead className="text-center font-bold text-stone-500">Genmart</TableHead>
              <TableHead className="text-center font-bold text-stone-500">Kaizen</TableHead>
              <TableHead className="text-center font-bold text-stone-900 bg-stone-100/50">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {FAB_ROWS.map((row) => (
              <TableRow key={row.program} className="hover:bg-amber-50/20 border-stone-100 transition-colors">
                <TableCell className="font-bold text-stone-800 py-4 px-6">{row.program}</TableCell>
                <TableCell className="text-center font-medium text-stone-500">{row.bcPkg || '—'}</TableCell>
                <TableCell className="text-center font-medium text-stone-500">{row.food || '—'}</TableCell>
                <TableCell className="text-center font-medium text-stone-500">{row.gen || '—'}</TableCell>
                <TableCell className="text-center font-medium text-stone-500">{row.kai || '—'}</TableCell>
                <TableCell className="text-center font-black text-white" style={{ background: C.brownMid }}>{row.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* ─── INSIGHTS GRID ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {INSIGHTS.map((ins) => (
          <Card key={ins.label} className="border-none shadow-none group hover:translate-y-[-2px] transition-transform" style={{ background: ins.soft }}>
            <CardContent className="pt-6">
              <Badge className="mb-3 bg-white/60 backdrop-blur-md border-none text-[10px] font-black uppercase tracking-tighter" style={{ color: ins.accent }}>
                {ins.label}
              </Badge>
              <div className="text-3xl font-black mb-1" style={{ color: ins.accent }}>{ins.val}</div>
              <p className="text-[11px] font-bold text-stone-600/70 leading-relaxed max-w-[200px]">{ins.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <footer className="pt-10 pb-6 border-t border-stone-100">
        <p className="text-center text-[10px] font-black text-stone-300 uppercase tracking-widest">
          SMaRT PDM Secure Analytics · Integrated Scholarship Management
        </p>
      </footer>
    </div>
  );
}