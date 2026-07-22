import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Loader2, RefreshCcw, Search, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSocketEvent } from '@/hooks/useSocket';

const API_URL = buildApiUrl('/api/student-registry');
const PAGE_SIZE = 20;

function studentName(row) {
  return [row.given_name || row.first_name, row.middle_name, row.last_name]
    .filter(Boolean)
    .join(' ');
}

export default function SDOStudentRegistryImport({ palette }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [importSummary, setImportSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [offenseFilter, setOffenseFilter] = useState('all');
  const [page, setPage] = useState(1);

  const headers = useCallback(() => {
    const token = sessionStorage.getItem('sdoToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadRegistry = useCallback(async ({ soft = false } = {}) => {
    if (!soft) setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}?limit=500&offset=0`, { headers: headers() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Failed to load the SDO list.');

      setRows(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
    } catch (requestError) {
      setError(requestError.message || 'Failed to load the SDO list.');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  useSocketEvent('maintenance:updated', (payload = {}) => {
    if (!payload.module || payload.module === 'student_registry') loadRegistry({ soft: true });
  }, [loadRegistry]);

  const importFile = async () => {
    if (!file) {
      toast.info('Choose a CSV or XLSX file first.');
      return;
    }

    setImporting(true);
    setError('');

    try {
      const body = new FormData();
      body.append('file', file);
      const response = await fetch(`${API_URL}/import`, {
        method: 'POST',
        headers: headers(),
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.message || 'Import failed.');

      toast.success('SDO student list imported', {
        description: `${data.imported || 0} imported, ${(data.unmatched_rows || []).length} unmatched, ${data.duplicate_rows || 0} duplicates skipped.`,
      });
      setImportSummary(data);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      await loadRegistry({ soft: true });
    } catch (requestError) {
      const message = requestError.message || 'Import failed.';
      setError(message);
      toast.error('Unable to import the SDO list', { description: message });
    } finally {
      setImporting(false);
    }
  };

  const courseOptions = useMemo(
    () => [...new Set(rows.map((row) => row.course_code).filter(Boolean))].sort(),
    [rows]
  );
  const yearOptions = useMemo(
    () => [...new Set(rows.map((row) => String(row.year_level || '')).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [rows]
  );
  const offenseOptions = useMemo(
    () => [...new Set(rows.map((row) => row.offense_type).filter(Boolean))].sort(),
    [rows]
  );
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const searchable = [row.student_number, studentName(row), row.case_reference_number, row.offense_type]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (!query || searchable.includes(query))
        && (courseFilter === 'all' || row.course_code === courseFilter)
        && (yearFilter === 'all' || String(row.year_level || '') === yearFilter)
        && (offenseFilter === 'all' || row.offense_type === offenseFilter);
    });
  }, [rows, search, courseFilter, yearFilter, offenseFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const visibleRows = useMemo(
    () => filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRows, page]
  );
  const affectedStudents = useMemo(
    () => new Set(rows.map((row) => row.student_number).filter(Boolean)).size,
    [rows]
  );

  useEffect(() => {
    setPage(1);
  }, [search, courseFilter, yearFilter, offenseFilter]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">SDO Disciplinary Records</h2>
          <p className="mt-1 text-sm text-stone-500">
            Match existing students by PDM ID and maintain their recorded offense history.
          </p>
        </div>
        <Button variant="outline" className="h-9 rounded-lg" onClick={() => loadRegistry()}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-stone-200 p-4 shadow-none">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Import file</p>
            <p className="mt-1 text-xs text-stone-500">
              Required: PDM ID and offense type. Student identity, course, and year are taken from the Admin Student Registry.
            </p>
            <label className="mt-3 flex min-h-20 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 transition hover:border-stone-400">
              <FileSpreadsheet className="h-6 w-6" style={{ color: palette.base }} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-stone-800">
                  {file?.name || 'Choose a CSV or XLSX file'}
                </span>
                <span className="text-xs text-stone-500">Maximum file size: 15 MB</span>
              </span>
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.xlsx"
                className="sr-only"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-9 rounded-lg">
              <a href="/templates/sdo-student-list-import-template.csv" download>
                <Download className="mr-2 h-4 w-4" /> Template
              </a>
            </Button>
            <Button
              className="h-9 rounded-lg text-white"
              style={{ backgroundColor: palette.base }}
              disabled={!file || importing}
              onClick={importFile}
            >
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Import Records
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {importSummary && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${importSummary.unmatched_rows?.length || importSummary.invalid_rows?.length ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-green-200 bg-green-50 text-green-800'}`}>
          <p className="font-semibold">Import completed: {importSummary.imported || 0} new records</p>
          <p className="mt-1 text-xs leading-5">
            {importSummary.duplicate_rows || 0} duplicates skipped. {(importSummary.unmatched_rows || []).length} PDM IDs were not found in the Admin Student Registry.
          </p>
          {importSummary.unmatched_rows?.length ? (
            <p className="mt-2 text-xs font-medium">Unmatched: {importSummary.unmatched_rows.map((row) => `${row.student_number} (row ${row.row_number})`).join(', ')}</p>
          ) : null}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-stone-200 p-4 shadow-none">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Offense records</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{total}</p>
        </Card>
        <Card className="border-stone-200 p-4 shadow-none">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Students with records</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{affectedStudents}</p>
        </Card>
        <Card className="border-stone-200 p-4 shadow-none">
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Filtered results</p>
          <p className="mt-1 text-2xl font-semibold text-stone-900">{filteredRows.length}</p>
        </Card>
      </div>

      <Card className="overflow-hidden border-stone-200 shadow-none">
        <div className="space-y-3 border-b border-stone-100 px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-stone-900">Recorded offenses</p>
            <p className="text-xs text-stone-500">Only students already registered by Admin can receive imported SDO records.</p>
          </div>
          <div className="grid gap-2 md:grid-cols-[minmax(240px,1fr)_180px_140px_190px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search PDM ID, name, offense, or reference..." className="h-9 pl-9" />
            </div>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Course" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All courses</SelectItem>{courseOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Year" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All years</SelectItem>{yearOptions.map((value) => <SelectItem key={value} value={value}>Year {value}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={offenseFilter} onValueChange={setOffenseFilter}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Offense" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All offenses</SelectItem>{offenseOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" className="h-9" disabled={!search && courseFilter === 'all' && yearFilter === 'all' && offenseFilter === 'all'} onClick={() => { setSearch(''); setCourseFilter('all'); setYearFilter('all'); setOffenseFilter('all'); }}>Reset</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-stone-50 text-[11px] uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">PDM ID</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Offense Type</th>
                <th className="px-4 py-3 font-medium">Incident Date</th>
                <th className="px-4 py-3 font-medium">Case Reference</th>
                <th className="px-4 py-3 font-medium">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {visibleRows.map((row) => (
                <tr key={row.record_id} className="text-stone-700">
                  <td className="px-4 py-3 font-medium text-stone-900">{row.student_number || '-'}</td>
                  <td className="px-4 py-3">{studentName(row) || '-'}</td>
                  <td className="px-4 py-3">{row.course_code || row.degree_program || '-'}</td>
                  <td className="px-4 py-3">{row.year_level || '-'}</td>
                  <td className="px-4 py-3">{row.offense_type || '-'}</td>
                  <td className="px-4 py-3">{row.offense_incident_date || '-'}</td>
                  <td className="px-4 py-3">{row.case_reference_number || '-'}</td>
                  <td className="max-w-[260px] truncate px-4 py-3" title={row.remarks || ''}>{row.remarks || '-'}</td>
                </tr>
              ))}
              {!loading && visibleRows.length === 0 && (
                <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-stone-500">No disciplinary records match the current search and filters.</td></tr>
              )}
              {loading && (
                <tr><td colSpan="8" className="px-4 py-10 text-center text-sm text-stone-500">Loading disciplinary records...</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 border-t border-stone-100 px-4 py-3 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {visibleRows.length} of {filteredRows.length} records</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-20 text-center">Page {page} of {totalPages}</span>
            <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
