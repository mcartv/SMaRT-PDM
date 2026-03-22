import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Search, Download, Eye, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';

// ─── Palette ─────────────────────────────────────────────────
const C = {
  blue: '#1E3A8A',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  orange: '#d97706',
  orangeSoft: '#FFF7ED',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  purple: '#7c3aed',
  purpleSoft: '#FAF5FF',
  border: '#E5E7EB',
  muted: '#6B7280',
  text: '#111827',
  bg: '#F9FAFB',
  white: '#FFFFFF',
} as const;

const CARD = {
  background: C.white,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
} as const;

// ─── Config ───────────────────────────────────────────────────
const SCHOLARSHIP_STYLE: Record<string, { bg: string; color: string }> = {
  TES: { bg: C.blueSoft, color: C.blue },
  TDP: { bg: C.greenSoft, color: C.green },
  Private: { bg: C.purpleSoft, color: C.purple },
};

const RO_STATUS_COLOR: Record<string, string> = {
  complete: C.green,
  progress: C.orange,
  behind: C.red,
};

// ─── Data ─────────────────────────────────────────────────────
type ROStatus = 'complete' | 'progress' | 'behind';

const SCHOLARS = [
  { id: 'S2023-001', name: 'Dela Cruz, Maria', program: 'BS Computer Science', scholarship: 'TES', gwa: 1.45, status: 'Active', roPct: 100, roStatus: 'complete' as ROStatus },
  { id: 'S2023-002', name: 'Santos, Juan', program: 'BS Business Admin', scholarship: 'TDP', gwa: 1.78, status: 'Active', roPct: 75, roStatus: 'progress' as ROStatus },
  { id: 'S2023-003', name: 'Reyes, Ana', program: 'BS Engineering', scholarship: 'TES', gwa: 2.15, status: 'At Risk', roPct: 50, roStatus: 'progress' as ROStatus },
  { id: 'S2023-004', name: 'Garcia, Pedro', program: 'BS Education', scholarship: 'Private', gwa: 1.62, status: 'Active', roPct: 100, roStatus: 'complete' as ROStatus },
  { id: 'S2023-005', name: 'Lopez, Rosa', program: 'BS Nursing', scholarship: 'TES', gwa: 1.55, status: 'Active', roPct: 80, roStatus: 'progress' as ROStatus },
  { id: 'S2023-006', name: 'Martinez, Carlos', program: 'BS Computer Science', scholarship: 'TDP', gwa: 2.35, status: 'At Risk', roPct: 25, roStatus: 'behind' as ROStatus },
  { id: 'S2023-007', name: 'Fernandez, Lisa', program: 'BS Psychology', scholarship: 'TES', gwa: 1.42, status: 'Active', roPct: 100, roStatus: 'complete' as ROStatus },
  { id: 'S2023-008', name: 'Torres, Miguel', program: 'BS Architecture', scholarship: 'Private', gwa: 1.88, status: 'Active', roPct: 90, roStatus: 'progress' as ROStatus },
  { id: 'S2023-009', name: 'Villanueva, Sofia', program: 'BS Accountancy', scholarship: 'TES', gwa: 1.35, status: 'Active', roPct: 100, roStatus: 'complete' as ROStatus },
  { id: 'S2023-010', name: 'Ramos, Daniel', program: 'BS Engineering', scholarship: 'TDP', gwa: 2.05, status: 'At Risk', roPct: 60, roStatus: 'progress' as ROStatus },
];

const PROGRAMS = ['All Programs', 'Computer Science', 'Engineering', 'Business Admin', 'Education', 'Nursing', 'Psychology', 'Architecture', 'Accountancy'];
const SCHOLARSHIPS = ['All Scholarships', 'TES', 'TDP', 'Private'];
const STATUSES = ['All Statuses', 'Active', 'At Risk'];

const SUMMARY_STATS = [
  { label: 'Total Scholars', value: '1,280', color: C.blue },
  { label: 'Active', value: '1,103', color: C.green },
  { label: 'At Risk', value: '177', color: C.red },
  { label: 'Average GWA', value: '1.68', color: C.orange },
];

function gwaColor(gwa: number) {
  if (gwa >= 2.0) return C.red;
  if (gwa >= 1.75) return C.orange;
  return C.green;
}

const PAGE_SIZE = 10;

// ─── Component ───────────────────────────────────────────────
export default function ScholarMonitoring() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [scholarship, setScholarship] = useState('All Scholarships');
  const [status, setStatus] = useState('All Statuses');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return SCHOLARS.filter((s) => {
      const matchSearch = !q || s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
      const matchProgram = program === 'All Programs' || s.program.includes(program);
      const matchScholarship = scholarship === 'All Scholarships' || s.scholarship === scholarship;
      const matchStatus = status === 'All Statuses' || s.status === status;
      return matchSearch && matchProgram && matchScholarship && matchStatus;
    });
  }, [search, program, scholarship, status]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage() { setPage(1); }

  return (
    <div className="space-y-5 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>

      {/* ── Summary stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {SUMMARY_STATS.map((s) => (
          <div key={s.label} style={CARD} className="p-5">
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scholars</h1>
          <p className="text-sm text-gray-400 mt-0.5">{filtered.length} results · AY 2025–2026</p>
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

      {/* ── Status filter pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {['All Statuses', 'Active', 'At Risk'].map((s) => {
          const color = s === 'Active' ? C.green : s === 'At Risk' ? C.red : C.muted;
          const soft = s === 'Active' ? C.greenSoft : s === 'At Risk' ? C.redSoft : C.bg;
          const isActive = status === s;
          return (
            <button
              key={s}
              onClick={() => { setStatus(s); resetPage(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
              style={{
                background: isActive ? soft : C.white,
                borderColor: isActive ? color : C.border,
                color: isActive ? color : C.muted,
              }}
            >
              {s !== 'All Statuses' && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              )}
              {s}
              {s !== 'All Statuses' && (
                <span className="font-bold ml-0.5">
                  {SCHOLARS.filter(sc => sc.status === s).length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Filter bar ── */}
      <div style={CARD} className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search name or ID…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); resetPage(); }}
              className="pl-9 h-9 text-sm rounded-xl border-gray-200 bg-gray-50 focus:bg-white"
            />
          </div>

          <Select value={program} onValueChange={(v) => { setProgram(v); resetPage(); }}>
            <SelectTrigger className="h-9 w-[180px] text-sm rounded-xl border-gray-200 bg-gray-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROGRAMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={scholarship} onValueChange={(v) => { setScholarship(v); resetPage(); }}>
            <SelectTrigger className="h-9 w-[170px] text-sm rounded-xl border-gray-200 bg-gray-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHOLARSHIPS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Table ── */}
      <div style={CARD} className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                {['Scholar ID', 'Name', 'Program', 'Scholarship', 'GWA', 'Status', 'RO Progress', ''].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider ${i === 7 ? 'text-right pr-5' : 'text-left'}`}
                    style={{ color: C.muted }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-12 text-center text-sm text-gray-400">
                    No scholars match the current filters.
                  </td>
                </tr>
              ) : pageData.map((s, i) => {
                const isAtRisk = s.gwa >= 2.0;
                const schStyle = SCHOLARSHIP_STYLE[s.scholarship] ?? { bg: C.bg, color: C.muted };
                const roColor = RO_STATUS_COLOR[s.roStatus];

                return (
                  <tr
                    key={s.id}
                    style={{
                      borderBottom: `1px solid ${C.border}`,
                      background: isAtRisk ? '#fff7f7' : i % 2 === 0 ? C.white : C.bg,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = isAtRisk ? '#fee2e2' : '#f0f9ff'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isAtRisk ? '#fff7f7' : i % 2 === 0 ? C.white : C.bg; }}
                  >
                    {/* ID */}
                    <td className="px-4 py-3.5 text-xs font-mono text-gray-400">{s.id}</td>

                    {/* Name */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900">{s.name}</span>
                        {isAtRisk && <AlertTriangle className="w-3.5 h-3.5 shrink-0" style={{ color: C.red }} />}
                      </div>
                    </td>

                    {/* Program */}
                    <td className="px-4 py-3.5 text-xs text-gray-500 max-w-[160px]">
                      <span className="truncate block">{s.program}</span>
                    </td>

                    {/* Scholarship */}
                    <td className="px-4 py-3.5">
                      <span
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                        style={{ background: schStyle.bg, color: schStyle.color }}
                      >
                        {s.scholarship}
                      </span>
                    </td>

                    {/* GWA */}
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-bold tabular-nums" style={{ color: gwaColor(s.gwa) }}>
                        {s.gwa.toFixed(2)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      {s.status === 'Active' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: C.greenSoft, color: C.green }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                          style={{ background: C.redSoft, color: C.red }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.red }} />
                          At Risk
                        </span>
                      )}
                    </td>

                    {/* RO Progress */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-1.5 rounded-full" style={{ background: C.border }}>
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{ width: `${s.roPct}%`, background: roColor }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold tabular-nums w-8 text-right"
                          style={{ color: roColor }}>
                          {s.roPct}%
                        </span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3.5 pr-5 text-right">
                      <button
                        onClick={() => navigate(`/admin/scholars/${s.id}`)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
                        style={{ borderColor: C.border, color: C.blue, background: C.white }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = C.blueSoft)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = C.white)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3.5"
          style={{ borderTop: `1px solid ${C.border}` }}>
          <p className="text-xs text-gray-400">
            Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border text-gray-400 disabled:opacity-40 transition-colors"
              style={{ borderColor: C.border, background: C.white }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = C.white)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold border transition-all"
                style={{
                  background: page === n ? C.blue : C.white,
                  color: page === n ? C.white : C.muted,
                  borderColor: page === n ? C.blue : C.border,
                }}
              >
                {n}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border text-gray-400 disabled:opacity-40 transition-colors"
              style={{ borderColor: C.border, background: C.white }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.bg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = C.white)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}