import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  RefreshCcw,
  FileSpreadsheet,
  Download,
  AlertCircle,
  X,
  Search,
  Inbox,
  SlidersHorizontal,
  FileUp,
} from 'lucide-react';

import { buildApiUrl } from '@/api';

const API_BASE = buildApiUrl('/api');
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

function getAuthHeaders() {
  const token = localStorage.getItem('adminToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function getFullName(row) {
  return [row.given_name, row.middle_name, row.last_name].filter(Boolean).join(' ');
}

function FilterModal({
  open,
  onClose,
  draftCourseFilter,
  setDraftCourseFilter,
  draftYearFilter,
  setDraftYearFilter,
  courseOptions,
  yearOptions,
  onApply,
  onClear,
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md overflow-hidden border-stone-200 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-stone-800">Filter Registry</h3>
            <p className="mt-0.5 text-xs text-stone-500">
              Refine registrar records by course and year level
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Course
            </label>
            <Select value={draftCourseFilter} onValueChange={setDraftCourseFilter}>
              <SelectTrigger className="h-10 rounded-lg border-stone-200">
                <SelectValue placeholder="Course" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courseOptions.map((course) => (
                  <SelectItem key={course} value={course}>
                    {course}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
              Year Level
            </label>
            <Select value={draftYearFilter} onValueChange={setDraftYearFilter}>
              <SelectTrigger className="h-10 rounded-lg border-stone-200">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year}>
                    Year {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-4">
          <Button
            variant="outline"
            onClick={onClear}
            className="h-8 rounded-lg border-stone-200 text-xs"
          >
            Clear
          </Button>
          <Button
            onClick={onApply}
            className="h-8 rounded-lg border-none bg-stone-900 text-xs text-white hover:bg-stone-800"
          >
            Apply
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function RegistrarSync() {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [registry, setRegistry] = useState([]);
  const [total, setTotal] = useState(0);

  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  const [filterOpen, setFilterOpen] = useState(false);
  const [draftCourseFilter, setDraftCourseFilter] = useState('all');
  const [draftYearFilter, setDraftYearFilter] = useState('all');

  const loadRegistry = async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/student-registry?limit=200`, {
        headers: getAuthHeaders(),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to load registry');

      setRegistry(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
    } catch (err) {
      setError(err.message || 'Failed to load registry');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRegistry();
  }, []);

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    const valid = ACCEPTED_EXTENSIONS.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!valid) {
      setError('Only .xlsx, .xls, and .csv files are allowed.');
      return;
    }

    setError('');
    setFile(selectedFile);
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setError('');

    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch(`${API_BASE}/student-registry/import`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: fd,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Import failed');

      setFile(null);
      if (inputRef.current) inputRef.current.value = '';

      await loadRegistry();
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) handleFileSelect(droppedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const courseOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        registry
          .map((row) => row.academic_course?.course_code)
          .filter(Boolean)
      )
    );

    return unique.sort((a, b) => String(a).localeCompare(String(b)));
  }, [registry]);

  const yearOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        registry
          .map((row) => row.year_level)
          .filter((value) => value !== null && value !== undefined && value !== '')
          .map((value) => String(value))
      )
    );

    return unique.sort((a, b) => Number(a) - Number(b));
  }, [registry]);

  const filteredRegistry = useMemo(() => {
    const q = normalizeText(search);

    return registry.filter((row) => {
      const fullName = normalizeText(getFullName(row));
      const studentNumber = normalizeText(row.student_number);
      const courseCode = String(row.academic_course?.course_code || '');
      const yearLevel = String(row.year_level || '');

      const matchesSearch =
        !q ||
        fullName.includes(q) ||
        studentNumber.includes(q);

      const matchesCourse =
        courseFilter === 'all' || courseCode === courseFilter;

      const matchesYear =
        yearFilter === 'all' || yearLevel === yearFilter;

      return matchesSearch && matchesCourse && matchesYear;
    });
  }, [registry, search, courseFilter, yearFilter]);

  const rows = useMemo(() => filteredRegistry.slice(0, 50), [filteredRegistry]);

  const hasActiveFilters = courseFilter !== 'all' || yearFilter !== 'all';

  const openFilterModal = () => {
    setDraftCourseFilter(courseFilter);
    setDraftYearFilter(yearFilter);
    setFilterOpen(true);
  };

  const applyFilters = () => {
    setCourseFilter(draftCourseFilter);
    setYearFilter(draftYearFilter);
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setDraftCourseFilter('all');
    setDraftYearFilter('all');
    setCourseFilter('all');
    setYearFilter('all');
    setFilterOpen(false);
  };

  return (
    <div className="space-y-4">
      <FilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        draftCourseFilter={draftCourseFilter}
        setDraftCourseFilter={setDraftCourseFilter}
        draftYearFilter={draftYearFilter}
        setDraftYearFilter={setDraftYearFilter}
        courseOptions={courseOptions}
        yearOptions={yearOptions}
        onApply={applyFilters}
        onClear={clearFilters}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="space-y-4 border-stone-200 p-4 shadow-none xl:col-span-4">
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition ${isDragging
                ? 'border-stone-500 bg-stone-50'
                : 'border-stone-300 bg-stone-50/70 hover:bg-stone-50'
              }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
            />

            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-stone-200 bg-white">
              <Inbox className="h-5 w-5 text-stone-500" />
            </div>

            <p className="text-sm font-medium text-stone-800">
              Drag and drop registrar file
            </p>
            <p className="mt-1 text-xs text-stone-400">or click to browse</p>
            <p className="mt-3 text-[11px] text-stone-400">
              Accepted: {ACCEPTED_EXTENSIONS.join(', ')}
            </p>
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2">
              <div className="min-w-0 text-xs">
                <p className="truncate font-medium text-stone-700">{file.name}</p>
                <span className="block text-stone-400">{formatFileSize(file.size)}</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = '';
                }}
                className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleImport}
              disabled={!file || isImporting}
              className="h-9"
            >
              {isImporting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-4 w-4" />
              )}
              {isImporting ? 'Importing' : 'Import'}
            </Button>

            <Button
              variant="outline"
              onClick={loadRegistry}
              className="h-9 border-stone-200"
            >
              <RefreshCcw className={`mr-1.5 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button asChild variant="outline" className="h-9 border-stone-200">
              <a href="/templates/student-registry-import-template.csv" download>
                <Download className="mr-1.5 h-4 w-4" />
                Template
              </a>
            </Button>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <FileUp className="mt-0.5 h-4 w-4 text-stone-400" />
              <p className="text-xs leading-6 text-stone-500">
                Only students in this registry can register and apply for scholarships.
              </p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-stone-200 shadow-none xl:col-span-8">
          <div className="flex flex-col gap-3 border-b bg-white px-4 py-3">
            <div className="flex items-center justify-between text-xs text-stone-500">
              <span>{total} records</span>
              <span className="flex items-center gap-1">
                <FileSpreadsheet className="h-4 w-4" />
                {rows.length} shown
              </span>
            </div>

            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student number or name..."
                  className="pl-9"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={openFilterModal}
                  className="border-stone-200"
                >
                  <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                  Filters
                  {hasActiveFilters && (
                    <span className="ml-2 rounded-full bg-stone-900 px-2 py-0.5 text-[10px] font-semibold text-white">
                      Active
                    </span>
                  )}
                </Button>

                {(search || hasActiveFilters) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch('');
                      clearFilters();
                    }}
                    className="border-stone-200"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-stone-50 text-stone-400 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Student</th>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Course</th>
                  <th className="px-3 py-2 text-left">Year</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-stone-400">
                      {isLoading ? 'Loading...' : 'No data found'}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.registry_id} className="border-t">
                      <td className="px-3 py-2">{r.sequence_number}</td>
                      <td className="px-3 py-2 font-mono">{r.student_number}</td>
                      <td className="px-3 py-2">{getFullName(r) || '-'}</td>
                      <td className="px-3 py-2">
                        {r.academic_course?.course_code || '-'}
                      </td>
                      <td className="px-3 py-2">{r.year_level || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}