import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Database,
  Upload,
  RefreshCcw,
  FileSpreadsheet,
  Download,
  AlertCircle,
  CheckCircle2,
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
    <div className="rounded-2xl border p-4" style={{ borderColor: C.border, background: styles.bg }}>
      <p className="text-[11px] uppercase tracking-[0.2em] text-stone-400">{label}</p>
      <p className="mt-2 text-2xl font-bold" style={{ color: styles.color }}>{value}</p>
    </div>
  );
}

export default function RegistrarSync() {
  const [file, setFile] = useState(null);
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
      await loadRegistry();
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const recentRows = useMemo(() => registry.slice(0, 25), [registry]);

  return (
    <div className="space-y-6 py-2">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-stone-500 text-xs uppercase tracking-[0.22em]">
          <Database className="w-4 h-4" />
          Registrar Sync
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-stone-900">Student Registry Import</h1>
        <p className="max-w-3xl text-sm text-stone-500">
          Upload the official registrar workbook or CSV to keep the registry in sync. Only records
          in this table are allowed to register and submit applications.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Imported" value={summary.total ?? 0} tone="success" />
          <StatCard label="Inserted" value={summary.inserted ?? 0} tone="success" />
          <StatCard label="Updated" value={summary.updated ?? 0} tone="warning" />
          <StatCard label="Duplicates / Skipped" value={`${summary.duplicate_count ?? 0} / ${(summary.skipped || []).length}`} tone="danger" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-stone-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 bg-stone-50/60">
            <h2 className="text-sm font-bold text-stone-800">Upload Registrar File</h2>
          </div>
          <CardContent className="p-5 space-y-4">
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/70 p-4">
              <p className="text-sm font-medium text-stone-800">Accepted columns</p>
              <ul className="mt-3 space-y-1 text-xs text-stone-500">
                <li>pdm_id</li>
                <li>first_name</li>
                <li>middle_name</li>
                <li>last_name</li>
                <li>course_id</li>
                <li>year_level</li>
                <li>gwa</li>
                <li>profile_photo_url</li>
                <li>is_active_scholar</li>
                <li>account_status</li>
                <li>sdo_status</li>
                <li>is_archived</li>
                <li>is_profile_complete</li>
                <li>learners_reference_number</li>
                <li>sex_at_birth</li>
                <li>email_address</li>
                <li>phone_number</li>
              </ul>
            </div>

            <Input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="rounded-xl border-stone-200 bg-white"
            />

            <div className="flex gap-3">
              <Button
                onClick={handleImport}
                disabled={isImporting || !file}
                className="rounded-xl text-white border-none"
                style={{ background: C.brown }}
              >
                <Upload className="w-4 h-4 mr-2" />
                {isImporting ? 'Importing...' : 'Import Registry'}
              </Button>

              <Button
                variant="outline"
                onClick={loadRegistry}
                disabled={isLoading}
                className="rounded-xl border-stone-200 text-stone-700"
              >
                <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              <Button
                asChild
                variant="outline"
                className="rounded-xl border-stone-200 text-stone-700"
              >
                <a href="/templates/student-registry-import-template.csv" download>
                  <Download className="w-4 h-4 mr-2" />
                  Template
                </a>
              </Button>
            </div>

            <div className="rounded-2xl bg-amber-50 border border-amber-100 p-4 text-xs text-amber-900 leading-6">
              Registrations and application submission are blocked unless the PDM ID exists in
              this registry. Existing scholar detection still comes from the active scholars table.
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 border-stone-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-stone-100 bg-stone-50/60 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-stone-800">Registry Preview</h2>
              <p className="text-xs text-stone-500 mt-1">
                {total} total records stored in the registry.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500">
              <FileSpreadsheet className="w-4 h-4" />
              Latest {recentRows.length} rows
            </div>
          </div>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-stone-50 text-[11px] uppercase tracking-[0.2em] text-stone-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">PDM ID</th>
                    <th className="px-4 py-3 font-semibold">Name</th>
                    <th className="px-4 py-3 font-semibold">Course</th>
                    <th className="px-4 py-3 font-semibold">Year</th>
                    <th className="px-4 py-3 font-semibold">GWA</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {recentRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-stone-400">
                        {isLoading ? 'Loading registry...' : 'No registry records yet.'}
                      </td>
                    </tr>
                  ) : (
                    recentRows.map((row) => (
                      <tr key={row.registry_id} className="hover:bg-stone-50/60">
                        <td className="px-4 py-3 text-sm font-mono text-stone-800">
                          {row.pdm_id}
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-700">
                          {[row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')}
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-600">{row.course_id || '-'}</td>
                        <td className="px-4 py-3 text-sm text-stone-600">{row.year_level || '-'}</td>
                        <td className="px-4 py-3 text-sm text-stone-600">{row.gwa || '-'}</td>
                        <td className="px-4 py-3 text-sm text-stone-600">
                          {row.account_status || '-'} / {row.sdo_status || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-stone-600">{row.email_address || '-'}</td>
                        <td className="px-4 py-3 text-sm text-stone-600">{row.phone_number || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Validation rule
          </div>
          <p className="mt-2 text-xs text-stone-500 leading-6">
            A user can register only if the PDM ID exists in the imported registrar table.
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Applicant detection
          </div>
          <p className="mt-2 text-xs text-stone-500 leading-6">
            The system marks a valid student as an applicant only after at least one application exists.
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-4" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            Scholar detection
          </div>
          <p className="mt-2 text-xs text-stone-500 leading-6">
            Existing scholars are resolved from the active scholars table and override applicant status.
          </p>
        </div>
      </div>
    </div>
  );
}
