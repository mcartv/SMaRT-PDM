import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Search, Download, Eye, ChevronLeft, ChevronRight, SlidersHorizontal } from 'lucide-react';

// ─── Palette ─────────────────────────────────────────────────
const C = {
  blue: '#1E3A8A',
  blueMid: '#2563EB',
  blueSoft: '#EFF6FF',
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

// ─── Status config ────────────────────────────────────────────
const STATUS_MAP: Record<string, { label: string; bg: string; color: string }> = {
  ready: { label: 'Documents Ready', bg: '#F0FDF4', color: '#16a34a' },
  missing: { label: 'Missing Docs', bg: '#FEF2F2', color: '#dc2626' },
  review: { label: 'Under Review', bg: '#FFF7ED', color: '#d97706' },
  approved: { label: 'Approved', bg: C.blueSoft, color: C.blueMid },
};

// ─── Data ────────────────────────────────────────────────────
const APPS = [
  { id: '2025-001', name: 'Dela Cruz, Juan', program: 'TES', submitted: 'Oct 20, 2025', status: 'ready' },
  { id: '2025-002', name: 'Santos, Maria', program: 'TDP', submitted: 'Oct 21, 2025', status: 'missing' },
  { id: '2025-003', name: 'Reyes, Ana', program: 'TES', submitted: 'Oct 19, 2025', status: 'review' },
  { id: '2025-004', name: 'Garcia, Pedro', program: 'Private', submitted: 'Oct 22, 2025', status: 'approved' },
  { id: '2025-005', name: 'Lopez, Rosa', program: 'TES', submitted: 'Oct 18, 2025', status: 'ready' },
  { id: '2025-006', name: 'Martinez, Carlos', program: 'TDP', submitted: 'Oct 23, 2025', status: 'missing' },
  { id: '2025-007', name: 'Fernandez, Lisa', program: 'TES', submitted: 'Oct 17, 2025', status: 'review' },
  { id: '2025-008', name: 'Torres, Miguel', program: 'TES', submitted: 'Oct 24, 2025', status: 'ready' },
  { id: '2025-009', name: 'Villanueva, Sofia', program: 'Private', submitted: 'Oct 16, 2025', status: 'review' },
  { id: '2025-010', name: 'Ramos, Daniel', program: 'TDP', submitted: 'Oct 25, 2025', status: 'approved' },
];

const PROGRAMS = ['All Programs', 'TES', 'TDP', 'Private'];
const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'ready', label: 'Documents Ready' },
  { value: 'missing', label: 'Missing Docs' },
  { value: 'review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
];

// ─── Small components ─────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, bg: C.bg, color: C.muted };
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 shrink-0" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────
const PAGE_SIZE = 10;

export default function ApplicationReview() {
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [program, setProgram] = useState('All Programs');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAdv, setShowAdv] = useState(false);

  // Filter
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return APPS.filter((a) => {
      const matchSearch = !q || a.name.toLowerCase().includes(q) || a.id.includes(q);
      const matchProgram = program === 'All Programs' || a.program === program;
      const matchStatus = status === 'all' || a.status === status;
      return matchSearch && matchProgram && matchStatus;
    });
  }, [search, program, status]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Selection
  const allSelected = pageData.length > 0 && pageData.every((a) => selected.has(a.id));
  const someSelected = pageData.some((a) => selected.has(a.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pageData.forEach((a) => next.delete(a.id));
      else pageData.forEach((a) => next.add(a.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function clearSelection() { setSelected(new Set()); }

  // Status summary counts
  const counts = useMemo(() =>
    Object.fromEntries(Object.keys(STATUS_MAP).map((k) => [k, APPS.filter((a) => a.status === k).length])),
    []);

  return (
    <div className="space-y-5 py-1" style={{ fontFamily: 'system-ui, sans-serif', color: C.text }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
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

      {/* ── Status summary pills ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {Object.entries(STATUS_MAP).map(([key, s]) => (
          <button
            key={key}
            onClick={() => { setStatus(status === key ? 'all' : key); setPage(1); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all"
            style={{
              background: status === key ? s.bg : C.white,
              borderColor: status === key ? s.color : C.border,
              color: status === key ? s.color : C.muted,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
            {s.label}
            <span className="ml-0.5 font-bold">{counts[key]}</span>
          </button>
        ))}
      </div>

      {/* ── Filter bar ── */}
      <div style={CARD} className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <Input
              placeholder="Search name or ID…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 h-9 text-sm rounded-xl border-gray-200 bg-gray-50 focus:bg-white"
            />
          </div>

          {/* Program */}
          <Select value={program} onValueChange={(v) => { setProgram(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[150px] text-sm rounded-xl border-gray-200 bg-gray-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROGRAMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Status */}
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="h-9 w-[160px] text-sm rounded-xl border-gray-200 bg-gray-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Advanced toggle */}
          <button
            onClick={() => setShowAdv((v) => !v)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-medium border transition-colors"
            style={{
              borderColor: showAdv ? C.blue : C.border,
              color: showAdv ? C.blue : C.muted,
              background: showAdv ? C.blueSoft : C.white,
            }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filters
          </button>
        </div>

        {/* Advanced filters */}
        {showAdv && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
            <Select>
              <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50">
                <SelectValue placeholder="Year Level" />
              </SelectTrigger>
              <SelectContent>
                {['1st Year', '2nd Year', '3rd Year', '4th Year'].map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {['Engineering', 'Business', 'Arts & Sciences', 'Education'].map((d) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="GWA range (e.g. 1.0–2.0)" className="h-9 text-sm rounded-xl border-gray-200 bg-gray-50" />
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div style={CARD} className="overflow-hidden">

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between px-5 py-3"
            style={{ background: C.blueSoft, borderBottom: `1px solid #bfdbfe` }}>
            <span className="text-sm font-medium" style={{ color: C.blue }}>
              {selected.size} selected
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" className="text-xs rounded-lg h-8 text-white"
                style={{ background: '#16a34a', border: 'none' }}>
                Approve
              </Button>
              <Button size="sm" className="text-xs rounded-lg h-8"
                style={{ background: C.white, border: `1px solid ${C.border}`, color: '#d97706' }}>
                Request Changes
              </Button>
              <Button size="sm" className="text-xs rounded-lg h-8"
                style={{ background: C.white, border: `1px solid ${C.border}`, color: C.muted }}
                onClick={clearSelection}>
                Clear
              </Button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
                <th className="pl-5 pr-3 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                    style={{ accentColor: C.blue }}
                  />
                </th>
                {['Student Name', 'ID', 'Program', 'Submitted', 'Status', ''].map((h, i) => (
                  <th key={i}
                    className={`px-4 py-3 text-[11px] font-bold uppercase tracking-wider ${i === 5 ? 'text-right pr-5' : 'text-left'}`}
                    style={{ color: C.muted }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-gray-400">
                    No applications match the current filters.
                  </td>
                </tr>
              ) : pageData.map((app, i) => {
                const isSelected = selected.has(app.id);
                return (
                  <tr
                    key={app.id}
                    style={{
                      borderBottom: `1px solid ${C.border}`,
                      background: isSelected ? C.blueSoft : i % 2 === 0 ? C.white : C.bg,
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f0f9ff'; }}
                    onMouseLeave={(e) => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? C.white : C.bg; }}
                  >
                    <td className="pl-5 pr-3 py-3.5">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(app.id)}
                        className="w-4 h-4 rounded border-gray-300 cursor-pointer"
                        style={{ accentColor: C.blue }}
                      />
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-gray-900">{app.name}</td>
                    <td className="px-4 py-3.5 text-sm font-mono text-gray-400">{app.id}</td>
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                        style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}` }}>
                        {app.program}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-gray-400">{app.submitted}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={app.status} /></td>
                    <td className="px-4 py-3.5 pr-5 text-right">
                      <button
                        onClick={() => navigate(`/admin/applications/${app.id}`)}
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
            Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border text-gray-400 disabled:opacity-40 transition-colors"
              style={{ borderColor: C.border }}
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
              style={{ borderColor: C.border }}
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