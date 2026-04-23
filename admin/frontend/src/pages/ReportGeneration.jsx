import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileText,
  Download,
  Printer,
  Eye,
  Calendar,
  Filter,
} from 'lucide-react';

// ─── Palette ─────────────────────────────────────────────────
const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
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

const FILE_TYPE_COLOR = {
  PDF: { bg: '#FEF2F2', color: '#dc2626' },
  Excel: { bg: '#fdf6ec', color: '#92500f' },
  CSV: { bg: '#fef3c7', color: '#d97706' },
};

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="inline-flex flex-wrap rounded-xl border border-stone-200 bg-stone-50 p-1">
      {options.map((option) => {
        const active = value === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-3 py-2 text-xs font-semibold transition-all ${active
                ? 'bg-white text-stone-900 shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
              }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function TemplateCard({ report, active, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(report.id)}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${active
          ? 'border-[#7c4a2e] bg-amber-50'
          : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
        }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${active
              ? 'border-[#7c4a2e] bg-[#7c4a2e] text-white'
              : 'border-stone-200 bg-stone-50 text-stone-500'
            }`}
        >
          <FileText className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className={`truncate text-sm font-semibold ${active ? 'text-[#5c2d0e]' : 'text-stone-900'}`}>
            {report.name}
          </p>
          <p className="mt-1 text-xs text-stone-500">{report.sub}</p>
        </div>
      </div>
    </button>
  );
}

function ReportHistoryRow({ report }) {
  const tc = FILE_TYPE_COLOR[report.type] || { bg: '#f4f4f5', color: '#71717a' };

  return (
    <div className="flex flex-col gap-4 px-4 py-4 transition-colors hover:bg-stone-50/50 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: tc.bg }}
        >
          <FileText className="h-4 w-4" style={{ color: tc.color }} />
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-stone-900">{report.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
            <span>{report.date}</span>
            <span>•</span>
            <span>{report.size}</span>
            <span
              className="rounded px-1.5 py-0.5 font-semibold"
              style={{ background: tc.bg, color: tc.color }}
            >
              {report.type}
            </span>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-lg border-stone-200 text-[11px] font-semibold uppercase"
        >
          <Eye className="mr-1.5 h-3.5 w-3.5" />
          View
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-lg border-amber-200 text-[11px] font-semibold uppercase text-amber-700 hover:bg-amber-50"
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          Download
        </Button>
      </div>
    </div>
  );
}

export default function ReportGeneration() {
  const [selected, setSelected] = useState('uaqtea');
  const [ay, setAy] = useState('2025-2026');
  const [semester, setSemester] = useState('1st');
  const [program, setProgram] = useState('all');
  const [format, setFormat] = useState('pdf');

  const selectedReport = useMemo(
    () => REPORT_TYPES.find((r) => r.id === selected) || REPORT_TYPES[0],
    [selected]
  );

  return (
    <div className="space-y-5 py-2">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="overflow-hidden border-stone-200 bg-white shadow-none xl:col-span-4">
          <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-4">
            <h2 className="text-sm font-semibold text-stone-800">Report Templates</h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Choose a report type before generating an export.
            </p>
          </div>

          <CardContent className="space-y-3 p-4">
            {REPORT_TYPES.map((report) => (
              <TemplateCard
                key={report.id}
                report={report}
                active={selected === report.id}
                onClick={setSelected}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-stone-200 bg-white shadow-none xl:col-span-8">
          <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-stone-800">Export Settings</h2>
                <p className="mt-0.5 text-xs text-stone-500">{selectedReport.name}</p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] text-stone-500">
                <Filter className="h-3.5 w-3.5" />
                Static preview mode
              </div>
            </div>
          </div>

          <CardContent className="space-y-6 p-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Academic Year
                </label>
                <Select value={ay} onValueChange={setAy}>
                  <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['2025-2026', '2024-2025', '2023-2024'].map((year) => (
                      <SelectItem key={year} value={year} className="text-sm font-medium">
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Program
                </label>
                <Select value={program} onValueChange={setProgram}>
                  <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-sm font-medium">
                      All Programs
                    </SelectItem>
                    <SelectItem value="tes" className="text-sm font-medium">
                      TES Only
                    </SelectItem>
                    <SelectItem value="tdp" className="text-sm font-medium">
                      TDP Only
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Semester
              </label>
              <SegmentedControl
                options={[
                  { value: '1st', label: '1st Sem' },
                  { value: '2nd', label: '2nd Sem' },
                  { value: 'Summer', label: 'Summer' },
                ]}
                value={semester}
                onChange={setSemester}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                Output Format
              </label>
              <SegmentedControl
                options={[
                  { value: 'pdf', label: 'PDF Document' },
                  { value: 'excel', label: 'Excel Worksheet' },
                  { value: 'csv', label: 'CSV' },
                ]}
                value={format}
                onChange={setFormat}
              />
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white">
                  <Calendar className="h-4 w-4 text-stone-500" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-stone-800">Selected configuration</p>
                  <p className="mt-1 text-xs leading-6 text-stone-500">
                    {selectedReport.name} • {ay} • {semester} •{' '}
                    {program === 'all' ? 'All Programs' : program.toUpperCase()} •{' '}
                    {format.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-stone-100 pt-4 sm:flex-row">
              <Button
                className="h-11 flex-1 rounded-xl border-none text-sm font-semibold text-white"
                style={{ background: C.brown }}
              >
                <FileText className="mr-2 h-4 w-4" />
                Generate Report
              </Button>

              <Button
                variant="outline"
                className="h-11 rounded-xl border-stone-200 text-sm font-semibold text-stone-700"
              >
                <Download className="mr-2 h-4 w-4" />
                Download Latest
              </Button>

              <Button
                variant="outline"
                className="h-11 rounded-xl border-stone-200 text-sm font-semibold text-stone-700"
              >
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden border-stone-200 bg-white shadow-none">
        <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-4">
          <h2 className="text-sm font-semibold text-stone-800">Recent Generation History</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Static preview of recently generated reports.
          </p>
        </div>

        <div className="divide-y divide-stone-100">
          {RECENT_REPORTS.map((report, index) => (
            <ReportHistoryRow key={index} report={report} />
          ))}
        </div>
      </Card>
    </div>
  );
}