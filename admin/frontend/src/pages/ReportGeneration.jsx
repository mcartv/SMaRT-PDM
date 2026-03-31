import React, { useState } from 'react';
// --- SHADCN UI COMPONENTS ---
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from "@/components/ui/card";
// --- ICONS ---
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
};

const BD = '1px solid ' + C.border;

// ─── Static Data ─────────────────────────────────────────────
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

const FILE_TYPE_COLOR = {
  PDF: { bg: '#FEF2F2', color: '#dc2626' },
  Excel: { bg: '#fdf6ec', color: '#92500f' },
  CSV: { bg: '#fef3c7', color: '#d97706' },
};

// ─── Pill toggle helper ───────────────────────────────────────
function PillGroup({ options, value, onChange }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
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

// ─── Main Component ───────────────────────────────────────────────
export default function ReportGeneration() {
  const [selected, setSelected] = useState('uaqtea');
  const [ay, setAy] = useState('2025-2026');
  const [semester, setSemester] = useState('1st');
  const [program, setProgram] = useState('all');
  const [format, setFormat] = useState('pdf');

  const selectedReport = REPORT_TYPES.find(r => r.id === selected) || REPORT_TYPES[0];

  return (
    <div className="space-y-6 py-2 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900">Reports</h1>
          <p className="text-sm font-medium text-stone-400 mt-1 uppercase tracking-widest">Compliance & Custom Exports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Report Picker */}
        <Card className="lg:col-span-2 border-stone-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 bg-stone-50/50">
            <h2 className="text-sm font-bold text-stone-800">Select Report Template</h2>
          </div>
          <CardContent className="p-4 space-y-2">
            {REPORT_TYPES.map((r) => {
              const isActive = selected === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className="w-full flex items-start gap-4 p-4 rounded-xl border text-left transition-all"
                  style={{
                    borderColor: isActive ? C.brown : C.border,
                    background: isActive ? C.yellowSoft : C.white,
                  }}
                >
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: isActive ? C.brown : C.sand }}
                  >
                    <FileText className="w-5 h-5" style={{ color: isActive ? C.white : C.muted }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold leading-tight truncate" style={{ color: isActive ? C.brown : C.text }}>
                      {r.name}
                    </p>
                    <p className="text-xs mt-1 text-stone-500 font-medium">{r.sub}</p>
                  </div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Configuration Panel */}
        <Card className="lg:col-span-3 border-stone-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 bg-stone-50/50">
            <h2 className="text-sm font-bold text-stone-800">Export Settings</h2>
            <p className="text-xs text-stone-400 font-medium mt-0.5">{selectedReport.name}</p>
          </div>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Academic Year */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Academic Year</label>
                <Select value={ay} onValueChange={setAy}>
                  <SelectTrigger className="h-11 rounded-xl bg-stone-50/50 border-stone-200 font-medium text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['2025-2026', '2024-2025', '2023-2024'].map(y => (
                      <SelectItem key={y} value={y} className="text-sm font-medium">{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Program Filter */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Program</label>
                <Select value={program} onValueChange={setProgram}>
                  <SelectTrigger className="h-11 rounded-xl bg-stone-50/50 border-stone-200 font-medium text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-sm font-medium">All Programs</SelectItem>
                    <SelectItem value="tes" className="text-sm font-medium">TES Only</SelectItem>
                    <SelectItem value="tdp" className="text-sm font-medium">TDP Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Semester */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Semester</label>
              <PillGroup
                options={[{ value: '1st', label: '1st Sem' }, { value: '2nd', label: '2nd Sem' }, { value: 'Summer', label: 'Summer' }]}
                value={semester}
                onChange={setSemester}
              />
            </div>

            {/* Format */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-widest text-stone-400">Output Format</label>
              <PillGroup
                options={[{ value: 'pdf', label: 'PDF Document' }, { value: 'excel', label: 'Excel Worksheet' }, { value: 'csv', label: 'CSV' }]}
                value={format}
                onChange={setFormat}
              />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-stone-100">
              <Button className="flex-1 h-12 rounded-xl text-sm font-bold text-white shadow-lg border-none" style={{ background: C.brown }}>
                <FileText className="w-4 h-4 mr-2" /> Generate Report
              </Button>
              <Button variant="outline" className="h-12 rounded-xl text-sm font-bold text-stone-600 border-stone-200 bg-white">
                <Download className="w-4 h-4 mr-2" /> Download Latest
              </Button>
              <Button variant="outline" className="h-12 rounded-xl text-sm font-bold text-stone-600 border-stone-200 bg-white">
                <Printer className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Reports Log */}
      <Card className="border-stone-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-stone-100 bg-stone-50/50">
          <h2 className="text-sm font-bold text-stone-800">Recent Generation History</h2>
        </div>
        <div className="divide-y divide-stone-100">
          {RECENT_REPORTS.map((r, i) => {
            const tc = FILE_TYPE_COLOR[r.type] || { bg: '#f4f4f5', color: '#71717a' };
            return (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 gap-4 hover:bg-stone-50/50 transition-colors">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: tc.bg }}>
                    <FileText className="w-5 h-5" style={{ color: tc.color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-900 truncate">{r.name}</p>
                    <p className="text-[11px] font-bold text-stone-400 mt-0.5 uppercase tracking-tighter">
                      {r.date} · {r.size} · <span className="px-1.5 py-0.5 rounded ml-1" style={{ background: tc.bg, color: tc.color }}>{r.type}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="sm" className="rounded-lg h-9 font-bold text-[10px] uppercase border-stone-200"><Eye className="w-3.5 h-3.5 mr-1.5" /> View</Button>
                  <Button variant="outline" size="sm" className="rounded-lg h-9 font-bold text-[10px] uppercase border-stone-200 text-amber-700 hover:bg-amber-50 hover:border-amber-200"><Download className="w-3.5 h-3.5 mr-1.5" /> Download</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <footer className="pt-8 pb-4 text-center border-t border-stone-100">
        <p className="text-[10px] font-bold text-stone-300 uppercase tracking-widest italic">SMaRT PDM Governance Engine · Secure Reporting Subsystem</p>
      </footer>
    </div>
  );
}