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
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

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

  const loadRegistry = async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/student-registry?limit=200`, {
        headers: getAuthHeaders(),
      });

      const data = await res.json();
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

  const handleFileSelect = (f) => {
    if (!f) return;

    const valid = ['.xlsx', '.xls', '.csv'].some((ext) =>
      f.name.toLowerCase().endsWith(ext)
    );

    if (!valid) {
      setError('Only .xlsx, .xls, and .csv files are allowed.');
      return;
    }

    setError('');
    setFile(f);
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

      const data = await res.json();
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
    const q = search.trim().toLowerCase();

    return registry.filter((row) => {
      const fullName = [row.given_name, row.middle_name, row.last_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const studentNumber = String(row.student_number || '').toLowerCase();
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

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-xs text-red-500 flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-12">
        {/* LEFT */}
        <Card className="xl:col-span-4 p-4 space-y-4 border-stone-200 shadow-none">
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition ${isDragging
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
            <p className="mt-1 text-xs text-stone-400">
              or click to browse
            </p>
            <p className="mt-3 text-[11px] text-stone-400">
              Accepted: .xlsx, .xls, .csv
            </p>
          </div>

          {file && (
            <div className="flex justify-between items-center border border-stone-200 px-3 py-2 rounded-lg bg-white">
              <div className="min-w-0 text-xs">
                <p className="truncate text-stone-700 font-medium">{file.name}</p>
                <span className="block text-stone-400">
                  {formatFileSize(file.size)}
                </span>
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
            <Button onClick={handleImport} disabled={!file || isImporting}>
              <Upload className="h-4 w-4 mr-1" />
              {isImporting ? 'Importing' : 'Import'}
            </Button>

            <Button variant="outline" onClick={loadRegistry}>
              <RefreshCcw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>

            <Button asChild variant="outline">
              <a href="/templates/student-registry-import-template.csv" download>
                <Download className="h-4 w-4 mr-1" />
                Template
              </a>
            </Button>
          </div>

          <p className="text-xs text-stone-400 leading-6">
            Only students in this registry can register and apply.
          </p>
        </Card>

        {/* RIGHT */}
        <Card className="xl:col-span-8 border-stone-200 overflow-hidden shadow-none">
          <div className="flex flex-col gap-3 px-4 py-3 border-b bg-white">
            <div className="flex justify-between items-center text-xs text-stone-500">
              <span>{total} records</span>
              <span className="flex items-center gap-1">
                <FileSpreadsheet className="h-4 w-4" />
                {rows.length} shown
              </span>
            </div>

            <div className="grid gap-2 md:grid-cols-[1fr_160px_120px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search student number or name..."
                  className="pl-9"
                />
              </div>

              <Select value={courseFilter} onValueChange={setCourseFilter}>
                <SelectTrigger>
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

              <Select value={yearFilter} onValueChange={setYearFilter}>
                <SelectTrigger>
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

          {/* KEEP TABLE STRUCTURE */}
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-stone-50 text-stone-400 uppercase">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Course</th>
                  <th className="px-3 py-2">Year</th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-stone-400">
                      {isLoading ? 'Loading...' : 'No data'}
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.registry_id} className="border-t">
                      <td className="px-3 py-2">{r.sequence_number}</td>
                      <td className="px-3 py-2 font-mono">{r.student_number}</td>
                      <td className="px-3 py-2">
                        {[r.given_name, r.last_name].filter(Boolean).join(' ')}
                      </td>
                      <td className="px-3 py-2">
                        {r.academic_course?.course_code || '-'}
                      </td>
                      <td className="px-3 py-2">{r.year_level}</td>
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