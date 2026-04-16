import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Database,
  Upload,
  RefreshCcw,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
  Inbox,
  X,
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
  amber: '#d97706',
  amberSoft: '#FFF7ED',
  green: '#16a34a',
  greenSoft: '#F0FDF4',
  red: '#dc2626',
  redSoft: '#FEF2F2',
  border: '#e7e5e4',
  muted: '#78716c',
  bg: '#faf7f2',
};

function getAuthHeaders() {
  const token = localStorage.getItem('adminToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function StatCard({ label, value, tone = 'neutral' }) {
  const toneMap = {
    neutral: { bg: '#fff', color: C.brown },
    success: { bg: C.greenSoft, color: C.green },
    warning: { bg: C.amberSoft, color: C.amber },
    danger: { bg: C.redSoft, color: C.red },
  };

  const styles = toneMap[tone] || toneMap.neutral;

  return (
    <div
      className="rounded-2xl border px-4 py-4"
      style={{ borderColor: C.border, background: styles.bg }}
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold" style={{ color: styles.color }}>
        {value}
      </p>
    </div>
  );
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
  const [summary, setSummary] = useState(null);
  const [registry, setRegistry] = useState([]);
  const [total, setTotal] = useState(0);

  const loadRegistry = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE}/student-registry?limit=25`, {
        headers: getAuthHeaders(),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to load registry');
      }

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

    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const lowerName = selectedFile.name.toLowerCase();
    const isValid = allowedExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isValid) {
      setError('Only .xlsx, .xls, and .csv files are allowed.');
      return;
    }

    setError('');
    setFile(selectedFile);
  };

  const handleImport = async () => {
    if (!file) {
      setError('Choose an Excel or CSV file first.');
      return;
    }

    setIsImporting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/student-registry/import`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Import failed');
      }

      setSummary(data);
      setFile(null);

      if (inputRef.current) {
        inputRef.current.value = '';
      }

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
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
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

  const recentRows = useMemo(() => registry.slice(0, 25), [registry]);

  return (
    <div className="space-y-6 py-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-stone-500">
          <Database className="h-4 w-4" />
          Registrar Sync
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">
          Student Registry Import
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-stone-500">
          Upload the official registrar workbook or CSV to sync the master student
          registry. Only students found in this registry can continue registration
          and scholarship application flows.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <StatCard label="Imported" value={summary.total ?? 0} tone="success" />
          <StatCard label="Inserted" value={summary.inserted ?? 0} tone="success" />
          <StatCard label="Replaced Old Rows" value={summary.updated ?? 0} tone="warning" />
          <StatCard
            label="Duplicates / Skipped"
            value={`${summary.duplicate_count ?? 0} / ${(summary.skipped || []).length}`}
            tone="danger"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <Card className="overflow-hidden border-stone-200 shadow-sm xl:col-span-4">
          <div className="border-b border-stone-100 bg-stone-50/70 px-5 py-4">
            <h2 className="text-sm font-bold text-stone-800">Upload Registrar File</h2>
            <p className="mt-1 text-xs text-stone-500">
              Drag and drop the file or browse manually.
            </p>
          </div>

          <CardContent className="space-y-5 p-5">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
              className={`cursor-pointer rounded-2xl border-2 border-dashed px-5 py-8 text-center transition ${isDragging
                ? 'border-amber-500 bg-amber-50'
                : 'border-stone-300 bg-stone-50/70 hover:border-stone-400 hover:bg-stone-50'
                }`}
            >
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                <Inbox className="h-6 w-6 text-stone-600" />
              </div>

              <p className="mt-4 text-sm font-semibold text-stone-800">
                Drag and drop your registrar file here
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Accepts .xlsx, .xls, and .csv
              </p>

              <Button
                type="button"
                variant="outline"
                className="mt-4 rounded-xl border-stone-200 text-stone-700"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                Choose File
              </Button>

              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
              />
            </div>

            {file && (
              <div className="flex items-start justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-stone-800">
                    {file.name}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {formatFileSize(file.size)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = '';
                  }}
                  className="rounded-lg p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
              <p className="text-sm font-semibold text-stone-800">Accepted columns</p>
              <div className="mt-3 grid grid-cols-1 gap-y-1 text-xs text-stone-500 sm:grid-cols-2">
                <span>Sequence Number</span>
                <span>Student Number</span>
                <span>Learner&apos;s Reference Number</span>
                <span>Last Name</span>
                <span>Given Name</span>
                <span>Middle Name</span>
                <span>Degree Program</span>
                <span>Year Level</span>
                <span>Sex at Birth</span>
                <span>Email Address</span>
                <span>Phone Number</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleImport}
                disabled={isImporting || !file}
                className="rounded-xl border-none text-white"
                style={{ background: C.brown }}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isImporting ? 'Importing...' : 'Import Registry'}
              </Button>

              <Button
                variant="outline"
                onClick={loadRegistry}
                disabled={isLoading}
                className="rounded-xl border-stone-200 text-stone-700"
              >
                <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <Button
                asChild
                variant="outline"
                className="rounded-xl border-stone-200 text-stone-700"
              >
                <a href="/templates/student-registry-import-template.csv" download>
                  <Download className="mr-2 h-4 w-4" />
                  Template
                </a>
              </Button>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
              Registration and application submission are blocked unless the
              student number exists in this registry.
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-stone-200 shadow-sm xl:col-span-8">
          <div className="flex items-center justify-between gap-4 border-b border-stone-100 bg-stone-50/70 px-5 py-4">
            <div>
              <h2 className="text-sm font-bold text-stone-800">Registry Preview</h2>
              <p className="mt-1 text-xs text-stone-500">
                {total} total records stored in the registry
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-stone-500">
              <FileSpreadsheet className="h-4 w-4" />
              Latest {recentRows.length} rows
            </div>
          </div>

          <CardContent className="p-0">
            <div className="overflow-hidden">
              <div className="max-h-[520px] overflow-auto">
                <table className="min-w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 bg-stone-50 text-[11px] uppercase tracking-[0.2em] text-stone-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Seq</th>
                      <th className="px-4 py-3 font-semibold">Student Number</th>
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Course</th>
                      <th className="px-4 py-3 font-semibold">Year</th>
                      <th className="px-4 py-3 font-semibold">Sex</th>
                      <th className="px-4 py-3 font-semibold">Email</th>
                      <th className="px-4 py-3 font-semibold">Phone</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-stone-100">
                    {recentRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-12 text-center text-sm text-stone-400"
                        >
                          {isLoading ? 'Loading registry...' : 'No registry records yet.'}
                        </td>
                      </tr>
                    ) : (
                      recentRows.map((row) => (
                        <tr key={row.registry_id} className="transition hover:bg-stone-50/70">
                          <td className="px-4 py-3 text-sm text-stone-600">
                            {row.sequence_number ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-stone-800">
                            {row.student_number}
                          </td>
                          <td className="px-4 py-3 text-sm font-medium text-stone-700">
                            {[row.given_name, row.middle_name, row.last_name]
                              .filter(Boolean)
                              .join(' ')}
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-600">
                            {row.academic_course?.course_code ||
                              row.academic_course?.course_name ||
                              '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-600">
                            {row.year_level || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-600">
                            {row.sex_at_birth || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-600">
                            {row.email_address || '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-stone-600">
                            {row.phone_number || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Validation rule
          </div>
          <p className="mt-2 text-xs leading-6 text-stone-500">
            A user can proceed only if the student number exists in the imported
            registrar registry.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Applicant detection
          </div>
          <p className="mt-2 text-xs leading-6 text-stone-500">
            A valid student becomes an applicant only after at least one
            application record exists.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Scholar detection
          </div>
          <p className="mt-2 text-xs leading-6 text-stone-500">
            Existing scholars are still resolved from the scholars table and are
            not determined by this import.
          </p>
        </div>
      </div>
    </div>
  );
}