import { useState } from 'react';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Input } from '../ui/input';
import { FileText, Download, Printer, Eye, Calendar } from 'lucide-react';

// ─── Palette ─────────────────────────────────────────────────
const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  brownLight: '#92500f',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  yellowSoft: '#fef3c7',
  sand: '#fdf6ec',
  border: '#e8d5b7',
  muted: '#a0785a',
  text: '#3b1f0a',
  bg: '#faf7f2',
  white: '#FFFFFF',
} as const;

const BD = '1px solid ' + C.border;

const CARD: React.CSSProperties = {
  background: C.white,
  border: BD,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(107,58,31,0.07)',
};

// ─── Static data ─────────────────────────────────────────────
const REPORT_TYPES = [
  { id: 'uaqtea', name: 'UAQTEA Enrollment Report', sub: 'AY 2018–2026 · CHED format compliance' },
  { id: 'tdp', name: 'TDP Beneficiary Report', sub: '2019–2025 · With decline analysis' },
  { id: 'fhe-grad', name: 'FHE Graduates Master List', sub: 'Batch 2020–2025 · 1,517 graduates' },
  { id: 'fhe-summer', name: 'FHE Summer Enrollment', sub: '2018–2025 · Pandemic impact & recovery' },
  { id: 'private', name: 'Private Assistance Report', sub: 'AY 2025–2026 · 126 beneficiaries' },
  { id: 'comparison', name: 'TES vs TDP Comparison', sub: '2019–2025 · Trend analysis with projections' },
];

const RECENT_REPORTS = [
  { name: 'UAQTEA_Enrollment_2018-2026.pdf', date: 'Feb 14, 2026', size: '3.2 MB', type: 'PDF' },
  { name: 'FHE_Graduates_Master_List_2020-2025.xlsx', date: 'Feb 12, 2026', size: '2.1 MB', type: 'Excel' },
  { name: 'TDP_Decline_Analysis_2019-2025.pdf', date: 'Feb 10, 2026', size: '1.8 MB', type: 'PDF' },
  { name: 'Private_Beneficiaries_AY2025-2026.csv', date: 'Feb 08, 2026', size: '156 KB', type: 'CSV' },
];

const SAMPLE_COLS = ['Student ID', 'Full Name', 'Program', 'Scholarship', 'Award', 'AY', 'Sem', 'GWA', 'Status'];

const FILE_TYPE_COLOR: Record<string, { bg: string; color: string }> = {
  PDF: { bg: '#FEF2F2', color: '#dc2626' },
  Excel: { bg: C.sand, color: C.brownLight },
  CSV: { bg: C.yellowSoft, color: C.amber },
};

// ─── Pill toggle helper ───────────────────────────────────────
function PillGroup<T extends string>({
  options, value, onChange,
}: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
          style={{
            background: value === o.value ? C.brown : C.white,
            color: value === o.value ? C.white : C.muted,
            borderColor: value === o.value ? C.brown : C.border,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────
export default function ReportGeneration() {
  const [selected, setSelected] = useState('uaqtea');
  const [ay, setAy] = useState('2025-2026');
  const [semester, setSemester] = useState('1st');
  const [program, setProgram] = useState('all');
  const [format, setFormat] = useState('pdf');

  const selectedReport = REPORT_TYPES.find(r => r.id === selected)!;

  return (
    <div className="space-y-5 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: C.text }}>Reports</h1>
          <p className="text-sm mt-0.5" style={{ color: C.muted }}>CHED / UniFAST compliance & custom exports</p>
        </div>
      </div>

      {/* Two-column: report picker + config */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* Report type list */}
        <div style={CARD} className="lg:col-span-2 p-5">
          <h2 className="text-sm font-bold mb-4" style={{ color: C.text }}>Report Types</h2>
          <div className="space-y-2">
            {REPORT_TYPES.map((r) => {
              const isActive = selected === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className="w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all"
                  style={{
                    borderColor: isActive ? C.brown : C.border,
                    background: isActive ? C.yellowSoft : C.white,
                  }}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = C.sand; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = C.white; }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: isActive ? C.brown : C.sand }}
                  >
                    <FileText className="w-4 h-4" style={{ color: isActive ? C.white : C.muted }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-tight truncate" style={{ color: isActive ? C.brown : C.text }}>
                      {r.name}
                    </p>
                    <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{r.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Config panel */}
        <div style={CARD} className="lg:col-span-3 p-5 space-y-5">
          <div>
            <h2 className="text-sm font-bold" style={{ color: C.text }}>Configuration</h2>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>{selectedReport.name}</p>
          </div>

          {/* Academic Year */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
              Academic Year
            </label>
            <Select value={ay} onValueChange={setAy}>
              <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['2025-2026', '2024-2025', '2023-2024'].map(y => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Semester */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
              Semester
            </label>
            <PillGroup
              options={[{ value: '1st', label: '1st Sem' }, { value: '2nd', label: '2nd Sem' }, { value: 'Summer', label: 'Summer' }]}
              value={semester}
              onChange={setSemester}
            />
          </div>

          {/* Program Filter */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
              Program Filter
            </label>
            <Select value={program} onValueChange={setProgram}>
              <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Programs</SelectItem>
                <SelectItem value="tes">TES Only</SelectItem>
                <SelectItem value="tdp">TDP Only</SelectItem>
                <SelectItem value="private">Private Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
              Date Range
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Input type="date" defaultValue="2025-08-01" className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50" />
                <p className="text-[10px] mt-1" style={{ color: C.muted }}>From</p>
              </div>
              <div>
                <Input type="date" defaultValue="2026-02-14" className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50" />
                <p className="text-[10px] mt-1" style={{ color: C.muted }}>To</p>
              </div>
            </div>
          </div>

          {/* Format */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: C.muted }}>
              Export Format
            </label>
            <PillGroup
              options={[{ value: 'pdf', label: 'PDF' }, { value: 'excel', label: 'Excel' }, { value: 'csv', label: 'CSV' }]}
              value={format}
              onChange={setFormat}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-1">
            <button
              className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-bold text-white transition-opacity"
              style={{ background: C.brown }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <FileText className="w-4 h-4" />
              Generate
            </button>
            <button
              className="flex items-center justify-center gap-1.5 px-4 h-10 rounded-xl text-xs font-semibold border transition-colors"
              style={{ borderColor: C.border, color: C.muted, background: C.white }}
              onMouseEnter={e => (e.currentTarget.style.background = C.sand)}
              onMouseLeave={e => (e.currentTarget.style.background = C.white)}
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button
              className="flex items-center justify-center gap-1.5 px-4 h-10 rounded-xl text-xs font-semibold border transition-colors"
              style={{ borderColor: C.border, color: C.muted, background: C.white }}
              onMouseEnter={e => (e.currentTarget.style.background = C.sand)}
              onMouseLeave={e => (e.currentTarget.style.background = C.white)}
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
      <div style={CARD} className="overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: BD }}>
          <div>
            <h2 className="text-sm font-bold" style={{ color: C.text }}>Preview</h2>
            <p className="text-xs mt-0.5" style={{ color: C.muted }}>{selectedReport.name}</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
            style={{ background: C.yellowSoft, color: C.brownLight }}>
            <Calendar className="w-3 h-3" />
            1,280 records
          </div>
        </div>
        <div className="overflow-x-auto p-5" style={{ background: C.bg }}>
          <div style={{ ...CARD, overflow: 'hidden' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: C.yellowSoft, borderBottom: BD }}>
                  {SAMPLE_COLS.map((col) => (
                    <th key={col} className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider whitespace-nowrap"
                      style={{ color: C.muted }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((row, i) => (
                  <tr key={row} style={{ borderBottom: BD, background: i % 2 === 0 ? C.white : C.sand }}>
                    {SAMPLE_COLS.map((_, idx) => (
                      <td key={idx} className="px-4 py-2.5 text-xs whitespace-nowrap" style={{ color: C.muted }}>
                        — — —
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-center text-[11px] mt-3" style={{ color: C.muted }}>
            Showing first 3 rows · {SAMPLE_COLS.length} columns
          </p>
        </div>
      </div>

      {/* Recent Reports */}
      <div style={CARD} className="overflow-hidden">
        <div className="px-5 py-4" style={{ borderBottom: BD }}>
          <h2 className="text-sm font-bold" style={{ color: C.text }}>Recent Reports</h2>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>Previously generated files</p>
        </div>
        <div className="divide-y" style={{ borderColor: C.border }}>
          {RECENT_REPORTS.map((r, i) => {
            const tc = FILE_TYPE_COLOR[r.type] ?? { bg: C.sand, color: C.muted };
            return (
              <div
                key={i}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors"
                style={{ background: C.white }}
                onMouseEnter={e => (e.currentTarget.style.background = C.sand)}
                onMouseLeave={e => (e.currentTarget.style.background = C.white)}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: tc.bg }}>
                  <FileText className="w-4 h-4" style={{ color: tc.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: C.text }}>{r.name}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>
                    {r.date} · {r.size} ·{' '}
                    <span className="font-semibold px-1.5 py-0.5 rounded-md"
                      style={{ background: tc.bg, color: tc.color }}>
                      {r.type}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                    style={{ borderColor: C.border, color: C.muted, background: C.white }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.sand)}
                    onMouseLeave={e => (e.currentTarget.style.background = C.white)}
                  >
                    <Eye className="w-3.5 h-3.5" /> View
                  </button>
                  <button
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors"
                    style={{ borderColor: C.border, color: C.brownLight, background: C.white }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.amberSoft)}
                    onMouseLeave={e => (e.currentTarget.style.background = C.white)}
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}