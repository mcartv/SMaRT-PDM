import { useState } from 'react';
import { Button } from '../ui/button';
import {
  Users, GraduationCap, TrendingUp, TrendingDown,
  Download, AlertCircle, Award,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── Palette ─────────────────────────────────────────────────
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
} as const;

// ─── Border helper — avoids template literals in style props ──
const BD = '1px solid ' + C.border;
const BD2 = '2px solid ' + C.border;

// ─── Shared styles ────────────────────────────────────────────
const CARD: React.CSSProperties = {
  background: C.white,
  border: BD,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(107,58,31,0.07)',
};

const TOOLTIP_STYLE = {
  contentStyle: {
    background: C.white,
    border: BD,
    borderRadius: 10,
    fontSize: 12,
    color: C.text,
    boxShadow: '0 4px 12px rgba(107,58,31,0.10)',
  },
};

const AXIS_PROPS = {
  tick: { fontSize: 11, fill: C.muted },
  axisLine: false as const,
  tickLine: false as const,
};

// ─── Data ────────────────────────────────────────────────────
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
const FAB_COLS = ['bcPkg', 'food', 'gen', 'kai'] as const;

const INSIGHTS = [
  { label: 'UAQTEA Growth', val: '64%', note: 'From 1,473 (2018) → 2,418 (2025)', accent: C.brown, soft: C.amberSoft },
  { label: 'TDP Decline', val: '94%', note: 'Peak 386 (2021–22) → 24 (2024–25)', accent: C.amber, soft: C.yellowSoft },
  { label: 'FHE Peak Batch', val: '382', note: 'Highest graduate count in 2023', accent: C.green, soft: C.greenSoft },
  { label: 'Kaizen Dominance', val: '76%', note: '96 of 126 private beneficiaries', accent: C.brownLight, soft: C.sand },
  { label: 'BSIT Leading', val: '34', note: 'Most private assistance recipients', accent: C.brownMid, soft: '#fef9f0' },
  { label: 'Summer Recovery', val: '240', note: 'FHE from 0 (pandemic) → 240 in 2025', accent: C.amber, soft: C.amberSoft },
];

const TABS = [
  { key: 'uaqtea', label: 'UAQTEA' },
  { key: 'tdp', label: 'TDP' },
  { key: 'fhe', label: 'FHE' },
] as const;
type TabKey = typeof TABS[number]['key'];

// ─── Sub-components ──────────────────────────────────────────
function CardHeader({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-sm font-bold" style={{ color: C.text }}>{title}</h2>
      {sub && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</p>}
    </div>
  );
}

function ChartGrid() {
  return <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />;
}

// ─── Component ───────────────────────────────────────────────
export default function AdminDashboard() {
  const [tab, setTab] = useState<TabKey>('uaqtea');

  return (
    <div className="space-y-6 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text, background: C.bg }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: C.text }}>Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>Scholarship Overview · AY 2025–2026</p>
        </div>
        <Button
          size="sm"
          className="flex items-center gap-1.5 text-white text-xs font-semibold rounded-xl px-4"
          style={{ background: C.brown, border: 'none', height: 36 }}
        >
          <Download className="w-3.5 h-3.5" />
          Export
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => (
          <div key={s.label} style={CARD} className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: s.soft }}>
                <s.icon className="w-4 h-4" style={{ color: s.accent }} />
              </div>
              <div className="flex items-center gap-1">
                {s.up
                  ? <TrendingUp className="w-3 h-3" style={{ color: C.green }} />
                  : <TrendingDown className="w-3 h-3" style={{ color: C.red }} />}
                <span className="text-[11px] font-semibold" style={{ color: s.up ? C.green : C.red }}>
                  {s.trend}
                </span>
              </div>
            </div>
            <p className="text-2xl font-bold leading-none mb-1" style={{ color: C.text }}>{s.value}</p>
            <p className="text-xs font-medium" style={{ color: C.muted }}>{s.label}</p>
            <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Enrollment Trends (tabbed) */}
      <div style={CARD} className="p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-sm font-bold" style={{ color: C.text }}>Enrollment Trends</h2>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>Multi-program historical overview</p>
          </div>
          <div
            className="flex items-center gap-1 p-1 rounded-xl"
            style={{ background: C.sand, border: BD }}
          >
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{
                  background: tab === key ? C.white : 'transparent',
                  color: tab === key ? C.brown : C.muted,
                  boxShadow: tab === key ? '0 1px 3px rgba(107,58,31,0.12)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'uaqtea' && (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={UAQTEA_DATA} barGap={3} barCategoryGap="30%">
              <ChartGrid />
              <XAxis dataKey="year" {...AXIS_PROPS} />
              <YAxis domain={[0, 2700]} ticks={[0, 500, 1000, 1500, 2000, 2500]} {...AXIS_PROPS} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="sem1" fill={C.brown} name="1st Semester" radius={[5, 5, 0, 0]} />
              <Bar dataKey="sem2" fill={C.yellow} name="2nd Semester" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {tab === 'tdp' && (
          <>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={TDP_DATA} barGap={3} barCategoryGap="30%">
                <ChartGrid />
                <XAxis dataKey="year" {...AXIS_PROPS} />
                <YAxis domain={[0, 220]} ticks={[0, 50, 100, 150, 200]} {...AXIS_PROPS} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="sem1" fill={C.brownMid} name="1st Sem" radius={[5, 5, 0, 0]} />
                <Bar dataKey="sem2" fill={C.amber} name="2nd Sem" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div
              className="flex items-center gap-2 mt-3 pt-3"
              style={{ borderTop: BD }}
            >
              <AlertCircle className="w-3.5 h-3.5" style={{ color: C.red }} />
              <p className="text-xs font-medium" style={{ color: C.red }}>Program declined 88% over 3 years</p>
            </div>
          </>
        )}

        {tab === 'fhe' && (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={FHE_GRAD_DATA} barCategoryGap="40%">
              <ChartGrid />
              <XAxis dataKey="batch" {...AXIS_PROPS} />
              <YAxis domain={[0, 420]} ticks={[0, 100, 200, 300, 400]} {...AXIS_PROPS} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v} graduates`]} />
              <Bar dataKey="n" name="Graduates" radius={[5, 5, 0, 0]}>
                {FHE_GRAD_DATA.map((e) => (
                  <Cell key={e.batch} fill={e.batch === '2023' ? C.yellow : C.brownLight} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* FHE Summer + Pie */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <div style={CARD} className="p-6">
          <CardHeader title="FHE Summer Enrollment" sub="2018–2025 · pandemic years highlighted" />
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={FHE_SUMMER_DATA} barCategoryGap="38%">
              <ChartGrid />
              <XAxis dataKey="year" {...AXIS_PROPS} />
              <YAxis domain={[0, 270]} ticks={[0, 100, 200]} {...AXIS_PROPS} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v} enrolled`]} />
              <Bar dataKey="n" name="Enrolled" radius={[5, 5, 0, 0]}>
                {FHE_SUMMER_DATA.map((e, i) => (
                  <Cell key={i} fill={e.pandemic ? '#fca5a5' : C.brown} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: BD }}>
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: '#fca5a5' }} />
            <p className="text-[11px]" style={{ color: C.muted }}>Pandemic years 2019–2022 · zero enrollment</p>
          </div>
        </div>

        <div style={CARD} className="p-6">
          <CardHeader title="Distribution by Benefactor" sub={'AY 2025–2026 · ' + BENEFACTOR_TOTAL + ' total'} />
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="50%" height={200}>
              <PieChart>
                <Pie
                  data={BENEFACTORS}
                  cx="50%" cy="50%"
                  innerRadius={50} outerRadius={80}
                  dataKey="value" paddingAngle={3}
                >
                  {BENEFACTORS.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} formatter={(v, n) => [`${v} scholars`, n]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2.5">
              {BENEFACTORS.map((e) => (
                <div key={e.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: e.color }} />
                    <span className="text-xs" style={{ color: C.muted }}>{e.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" style={{ color: C.text }}>{e.value}</span>
                    <span className="text-[10px]" style={{ color: C.muted }}>
                      {Math.round(e.value / BENEFACTOR_TOTAL * 100)}%
                    </span>
                  </div>
                </div>
              ))}
              <div className="pt-2 mt-1 flex items-center justify-between" style={{ borderTop: BD }}>
                <span className="text-xs font-semibold" style={{ color: C.text }}>Total</span>
                <span className="text-xs font-bold" style={{ color: C.text }}>{BENEFACTOR_TOTAL}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Financial Assistance Table */}
      <div style={{ ...CARD, overflow: 'hidden' }}>
        <div className="px-6 py-4" style={{ borderBottom: BD }}>
          <h2 className="text-sm font-bold" style={{ color: C.text }}>Financial Assistance by Program</h2>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            {'First Semester AY 2025–2026 · ' + BENEFACTOR_TOTAL + ' total beneficiaries'}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: C.yellowSoft, borderBottom: BD }}>
                {['Program', 'BC Packaging', 'Food Crafters', 'Genmart', 'Kaizen', 'Total'].map((h, i) => (
                  <th
                    key={h}
                    className={'px-5 py-3 text-[11px] font-bold uppercase tracking-wider ' + (i === 0 ? 'text-left' : 'text-center')}
                    style={{
                      color: i === 5 ? C.white : C.muted,
                      background: i === 5 ? C.brown : 'transparent',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FAB_ROWS.map((row, i) => (
                <tr
                  key={row.program}
                  style={{ borderBottom: BD, background: i % 2 === 0 ? C.white : C.sand }}
                >
                  <td className="px-5 py-3 text-sm font-semibold" style={{ color: C.text }}>{row.program}</td>
                  {FAB_COLS.map((col) => (
                    <td key={col} className="px-5 py-3 text-center text-sm" style={{ color: C.muted }}>
                      {row[col] || '—'}
                    </td>
                  ))}
                  <td className="px-5 py-3 text-center text-sm font-bold" style={{ color: C.white, background: C.brownMid }}>
                    {row.total}
                  </td>
                </tr>
              ))}
              <tr style={{ background: C.yellowSoft, borderTop: BD2 }}>
                <td className="px-5 py-3 text-sm font-bold" style={{ color: C.text }}>Total</td>
                {[5, 10, 15, 96].map((v) => (
                  <td key={v} className="px-5 py-3 text-center text-sm font-bold" style={{ color: C.text }}>{v}</td>
                ))}
                <td className="px-5 py-3 text-center text-sm font-bold" style={{ color: C.white, background: C.brown }}>
                  {BENEFACTOR_TOTAL}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Key Insights */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold" style={{ color: C.text }}>Key Insights</h2>
          <span className="text-xs" style={{ color: C.muted }}>{INSIGHTS.length} data points</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {INSIGHTS.map((ins) => (
            <div key={ins.label} style={{ ...CARD, background: ins.soft }} className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: ins.accent }}>
                {ins.label}
              </p>
              <p className="text-3xl font-bold mb-1" style={{ color: ins.accent }}>{ins.val}</p>
              <p className="text-xs leading-relaxed" style={{ color: C.muted }}>{ins.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <p
        className="text-center text-[11px] pb-2"
        style={{ borderTop: BD, paddingTop: 16, color: C.muted }}
      >
        OSFA Records · AY 2025–2026 · Pambayang Dalubhasaan ng Marilao
      </p>
    </div>
  );
}