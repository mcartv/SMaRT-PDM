import { useState } from 'react';
import { Button } from '../ui/button';
import {
  Users, GraduationCap, TrendingUp, TrendingDown,
  Download, AlertCircle, Award, ChevronDown,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';

// ─── Palette ──────────────────────────────────────
const C = {
  blue: '#1E3A8A',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  teal: '#0D9488',
  tealSoft: '#F0FDFA',
  green: '#10B981',
  greenSoft: '#F0FDF4',
  orange: '#F59E0B',
  orangeSoft: '#FFF7ED',
  red: '#EF4444',
  redSoft: '#FEF2F2',
  border: '#E5E7EB',
  muted: '#6B7280',
  text: '#111827',
  subtext: '#6B7280',
  bg: '#F9FAFB',
  white: '#FFFFFF',
};

// ─── Data ────────────────────────────────────────────────────
const stats = [
  { label: 'UAQTEA Beneficiaries', value: '2,418', sub: '1st Sem · AY 2025–26', icon: Users, accent: C.blue, soft: C.blueSoft, trend: '+15.9%', up: true },
  { label: 'TDP Scholars', value: '24', sub: '15 + 9 per semester', icon: Award, accent: C.orange, soft: C.orangeSoft, trend: '−71.1%', up: false },
  { label: 'FHE Graduates', value: '1,517', sub: 'Cumulative 2020–2025', icon: GraduationCap, accent: C.green, soft: C.greenSoft, trend: '+Total', up: true },
  { label: 'Private Beneficiaries', value: '126', sub: '1st Sem · AY 2025–26', icon: Users, accent: C.teal, soft: C.tealSoft, trend: 'New AY', up: true },
];

const uaqteaData = [
  { year: '18–19', sem1: 1473, sem2: 1441 },
  { year: '19–20', sem1: 1523, sem2: 1390 },
  { year: '20–21', sem1: 1630, sem2: 1468 },
  { year: '21–22', sem1: 1654, sem2: 1565 },
  { year: '22–23', sem1: 1727, sem2: 1685 },
  { year: '23–24', sem1: 1876, sem2: 1750 },
  { year: '24–25', sem1: 2087, sem2: 1966 },
  { year: '25–26', sem1: 2418, sem2: null },
];

const tdpData = [
  { year: '19–20', sem1: 138, sem2: 128 },
  { year: '20–21', sem1: 154, sem2: 167 },
  { year: '21–22', sem1: 196, sem2: 190 },
  { year: '22–23', sem1: 105, sem2: 95 },
  { year: '23–24', sem1: 46, sem2: 37 },
  { year: '24–25', sem1: 15, sem2: 9 },
];

const fheGradData = [
  { batch: '2020', n: 160 },
  { batch: '2021', n: 134 },
  { batch: '2022', n: 268 },
  { batch: '2023', n: 382 },
  { batch: '2024', n: 279 },
  { batch: '2025', n: 294 },
];

const fheSummerData = [
  { year: '18–19', n: 162 },
  { year: '19–20', n: 0, pandemic: true },
  { year: '20–21', n: 0, pandemic: true },
  { year: '21–22', n: 0, pandemic: true },
  { year: '22–23', n: 125 },
  { year: '23–24', n: 162 },
  { year: '24–25', n: 240 },
];

const benefactors = [
  { name: 'Kaizen', value: 96, color: C.blue },
  { name: 'Genmart', value: 15, color: C.teal },
  { name: 'Food Crafters', value: 10, color: C.orange },
  { name: 'BC Packaging', value: 5, color: C.muted },
];

const fabByProgram = [
  { program: 'BECED', bcPkg: 1, food: 3, gen: 1, kai: 16, total: 21 },
  { program: 'BSCS', bcPkg: 0, food: 0, gen: 0, kai: 11, total: 11 },
  { program: 'BSHM', bcPkg: 1, food: 2, gen: 2, kai: 10, total: 13 },
  { program: 'BSIT', bcPkg: 2, food: 2, gen: 6, kai: 24, total: 34 },
  { program: 'BSOA', bcPkg: 0, food: 2, gen: 3, kai: 5, total: 10 },
  { program: 'BSTM', bcPkg: 1, food: 2, gen: 3, kai: 23, total: 29 },
  { program: 'BTLED', bcPkg: 0, food: 1, gen: 0, kai: 7, total: 8 },
];

const insights = [
  { label: 'UAQTEA Growth', val: '64%', note: 'From 1,473 (2018) → 2,418 (2025)', accent: C.blue, soft: C.blueSoft },
  { label: 'TDP Decline', val: '94%', note: 'Peak 386 (2021–22) → 24 (2024–25)', accent: C.orange, soft: C.orangeSoft },
  { label: 'FHE Peak Batch', val: '382', note: 'Highest graduate count in 2023', accent: C.green, soft: C.greenSoft },
  { label: 'Kaizen Dominance', val: '76%', note: '96 of 126 private beneficiaries', accent: C.teal, soft: C.tealSoft },
  { label: 'BSIT Leading', val: '34', note: 'Most private assistance recipients', accent: '#7c3aed', soft: '#FAF5FF' },
  { label: 'Summer Recovery', val: '240', note: 'FHE enrollment from 0 → 240 in 2025', accent: '#4338ca', soft: '#EEF2FF' },
];

// ─── Shared styles ───────────────────────────────────────────
const card = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const tt = {
  contentStyle: {
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    fontSize: 12,
    color: C.text,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
};

// ─── Sub-components ──────────────────────────────────────────
function SectionHeader({ title, sub, badge }: { title: string; sub?: string; badge?: string }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      {badge && (
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: C.blueSoft, color: C.blue }}>
          {badge}
        </span>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'uaqtea' | 'tdp' | 'fhe'>('uaqtea');

  return (
    <div className="space-y-6 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>

      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-0.5">Scholarship Overview · AY 2025–2026</p>
        </div>
        <Button
          size="sm"
          className="flex items-center gap-1.5 text-white text-xs font-semibold rounded-xl px-4"
          style={{ background: C.blue, border: 'none', height: 36 }}
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </Button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} style={card} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: s.soft }}>
                <s.icon className="w-4 h-4" style={{ color: s.accent }} />
              </div>
              <div className="flex items-center gap-1">
                {s.up
                  ? <TrendingUp className="w-3 h-3 text-green-500" />
                  : <TrendingDown className="w-3 h-3 text-red-400" />}
                <span className="text-[11px] font-semibold" style={{ color: s.up ? '#16a34a' : '#ef4444' }}>
                  {s.trend}
                </span>
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900 leading-none mb-1">{s.value}</p>
            <p className="text-xs font-medium text-gray-500">{s.label}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Enrollment Trends (tabbed) ── */}
      <div style={card} className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold text-gray-900">Enrollment Trends</h2>
            <p className="text-xs text-gray-400 mt-0.5">Multi-program historical overview</p>
          </div>
          {/* Tabs */}
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
            {(['uaqtea', 'tdp', 'fhe'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: activeTab === tab ? C.white : 'transparent',
                  color: activeTab === tab ? C.blue : C.muted,
                  boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'uaqtea' && (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={uaqteaData} barGap={3} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 2700]} ticks={[0, 500, 1000, 1500, 2000, 2500]} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
              <Tooltip {...tt} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Bar dataKey="sem1" fill={C.blue} name="1st Semester" radius={[5, 5, 0, 0]} />
              <Bar dataKey="sem2" fill={C.teal} name="2nd Semester" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {activeTab === 'tdp' && (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={tdpData} barGap={3} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 220]} ticks={[0, 50, 100, 150, 200]} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
                <Tooltip {...tt} />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Bar dataKey="sem1" fill={C.blueMid} name="1st Sem" radius={[5, 5, 0, 0]} />
                <Bar dataKey="sem2" fill={C.orange} name="2nd Sem" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <p className="text-xs text-red-500 font-medium">Program declined 88% over 3 years</p>
            </div>
          </>
        )}

        {activeTab === 'fhe' && (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={fheGradData} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="batch" tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 420]} ticks={[0, 100, 200, 300, 400]} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
              <Tooltip {...tt} formatter={(v) => [`${v} graduates`]} />
              <Bar dataKey="n" name="Graduates" radius={[5, 5, 0, 0]}>
                {fheGradData.map((e) => (
                  <Cell key={e.batch} fill={e.batch === '2023' ? C.orange : C.green} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── FHE Summer + Benefactor Pie ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* FHE Summer */}
        <div style={card} className="p-6">
          <SectionHeader title="FHE Summer Enrollment" sub="2018–2025 · pandemic years highlighted" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={fheSummerData} barCategoryGap="38%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 270]} ticks={[0, 100, 200]} tick={{ fontSize: 11, fill: C.muted }} axisLine={false} tickLine={false} />
              <Tooltip {...tt} formatter={(v) => [`${v} enrolled`]} />
              <Bar dataKey="n" name="Enrolled" radius={[5, 5, 0, 0]}>
                {fheSummerData.map((e, i) => (
                  <Cell key={i} fill={e.pandemic ? '#FCA5A5' : C.blue} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#FCA5A5' }} />
            <p className="text-[11px] text-gray-400">Pandemic years 2019–2022 · zero enrollment</p>
          </div>
        </div>

        {/* Pie */}
        <div style={card} className="p-6">
          <SectionHeader title="Distribution by Benefactor" sub="AY 2025–2026 · 126 total" />
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie data={benefactors} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                  dataKey="value" paddingAngle={3}>
                  {benefactors.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip {...tt} formatter={(v, n) => [`${v} scholars`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2.5">
              {benefactors.map((e) => (
                <div key={e.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: e.color }} />
                    <span className="text-xs text-gray-600">{e.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">{e.value}</span>
                    <span className="text-[10px] text-gray-400">
                      {Math.round(e.value / 126 * 100)}%
                    </span>
                  </div>
                </div>
              ))}
              <div className="pt-2 mt-1" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-700">Total</span>
                  <span className="text-xs font-bold text-gray-900">126</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Financial Assistance Table ── */}
      <div style={card} className="overflow-hidden">
        <div className="px-6 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <h2 className="text-sm font-bold text-gray-900">Financial Assistance by Program</h2>
          <p className="text-xs text-gray-400 mt-0.5">First Semester AY 2025–2026 · 126 total beneficiaries</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {['Program', 'BC Packaging', 'Food Crafters', 'Genmart', 'Kaizen', 'Total'].map((h, i) => (
                  <th key={h}
                    className={`px-5 py-3 text-[11px] font-bold uppercase tracking-wider ${i === 0 ? 'text-left' : 'text-center'}`}
                    style={{ color: i === 5 ? C.white : C.muted, background: i === 5 ? C.blue : 'transparent' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fabByProgram.map((row, i) => (
                <tr key={row.program} style={{ borderBottom: `1px solid ${C.border}`, background: i % 2 === 0 ? C.white : C.bg }}>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-800">{row.program}</td>
                  <td className="px-5 py-3 text-center text-sm text-gray-500">{row.bcPkg || '—'}</td>
                  <td className="px-5 py-3 text-center text-sm text-gray-500">{row.food || '—'}</td>
                  <td className="px-5 py-3 text-center text-sm text-gray-500">{row.gen || '—'}</td>
                  <td className="px-5 py-3 text-center text-sm text-gray-500">{row.kai}</td>
                  <td className="px-5 py-3 text-center text-sm font-bold text-white" style={{ background: C.blueMid }}>{row.total}</td>
                </tr>
              ))}
              <tr style={{ background: C.blueSoft, borderTop: `2px solid ${C.border}` }}>
                <td className="px-5 py-3 text-sm font-bold text-gray-900">Total</td>
                {[5, 10, 15, 96].map(v => (
                  <td key={v} className="px-5 py-3 text-center text-sm font-bold text-gray-900">{v}</td>
                ))}
                <td className="px-5 py-3 text-center text-sm font-bold text-white" style={{ background: C.blue }}>126</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Key Insights ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-900">Key Insights</h2>
          <span className="text-xs text-gray-400">6 data points</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {insights.map((ins) => (
            <div key={ins.label} style={{ ...card, background: ins.soft }} className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: ins.accent }}>
                {ins.label}
              </p>
              <p className="text-3xl font-bold mb-1" style={{ color: ins.accent }}>{ins.val}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{ins.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <p className="text-center text-[11px] text-gray-300 pb-2" style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
        OSFA Records · AY 2025–2026 · Pambayang Dalubhasaan ng Marilao
      </p>

    </div>
  );
}