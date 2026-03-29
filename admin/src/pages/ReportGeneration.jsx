import { useState } from 'react';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { FileText, Download, Printer, Eye, Calendar } from 'lucide-react';

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

const CARD = {
  background: C.white,
  border: BD,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(107,58,31,0.07)',
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

const SAMPLE_COLS = ['Student ID', 'Full Name', 'Program', 'Scholarship', 'Award', 'AY', 'Sem', 'GWA', 'Status'];

const FILE_TYPE_COLOR = {
  PDF: { bg: '#FEF2F2', color: '#dc2626' },
  Excel: { bg: C.sand, color: C.brownLight },
  CSV: { bg: C.yellowSoft, color: C.amber },
};

function PillGroup({ options, value, onChange }) {
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

export default function ReportGeneration() {
  const [selected, setSelected] = useState('uaqtea');
  const [ay, setAy] = useState('2025-2026');
  const [semester, setSemester] = useState('1st');
  const [program, setProgram] = useState('all');
  const [format, setFormat] = useState('pdf');

  const selectedReport = REPORT_TYPES.find(r => r.id === selected);

  return (
    <div className="space-y-5 py-1 text-stone-800">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-stone-500">CHED / UniFAST compliance & custom exports</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div style={CARD} className="lg:col-span-2 p-5">
          <h2 className="text-sm font-bold mb-4">Report Types</h2>
          <div className="space-y-2">
            {REPORT_TYPES.map((r) => {
              const isActive = selected === r.id;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelected(r.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${isActive ? 'border-stone-800 bg-amber-50' : 'border-stone-200 bg-white'}`}
                >
                  <FileText className={`w-4 h-4 mt-1 ${isActive ? 'text-amber-900' : 'text-stone-400'}`} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{r.name}</p>
                    <p className="text-[10px] text-stone-500">{r.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={CARD} className="lg:col-span-3 p-5 space-y-5">
          <h2 className="text-sm font-bold">Configuration</h2>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">Academic Year</label>
              <Select value={ay} onValueChange={setAy}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['2025-2026', '2024-2025', '2023-2024'].map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase text-stone-400 block mb-1">Semester</label>
              <PillGroup options={[{ value: '1st', label: '1st Sem' }, { value: '2nd', label: '2nd Sem' }]} value={semester} onChange={setSemester} />
            </div>
            <Button className="w-full bg-stone-800 text-white font-bold h-10 rounded-xl">Generate Report</Button>
          </div>
        </div>
      </div>
    </div>
  );
}