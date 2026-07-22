import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Download, FileSpreadsheet, Loader2, RefreshCcw, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { buildApiUrl } from '@/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useSocketEvent } from '@/hooks/useSocket';

const API_URL = buildApiUrl('/api/student-registry');

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

  const headers = useCallback(() => {
    const token = sessionStorage.getItem('sdoToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadRegistry = useCallback(async ({ soft = false } = {}) => {
    if (!soft) setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}?limit=100&offset=0`, { headers: headers() });
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
        description: `${data.imported || 0} of ${data.total || 0} records were imported.`,
      });
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-stone-900">SDO Student List</h2>
          <p className="mt-1 text-sm text-stone-500">
            Import the minimum student information needed for disciplinary checking.
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
              Required: PDM ID, given name, and last name. Include offense type and incident date when the student has a disciplinary record.
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
              Import List
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      <Card className="overflow-hidden border-stone-200 shadow-none">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-stone-900">Current student records</p>
            <p className="text-xs text-stone-500">{total} active registry records</p>
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
                <th className="px-4 py-3 font-medium">Disciplinary Record</th>
                <th className="px-4 py-3 font-medium">Offense Type</th>
                <th className="px-4 py-3 font-medium">Incident Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={row.master_student_id || row.student_number} className="text-stone-700">
                  <td className="px-4 py-3 font-medium text-stone-900">{row.student_number || '-'}</td>
                  <td className="px-4 py-3">{studentName(row) || '-'}</td>
                  <td className="px-4 py-3">{row.course_code || row.degree_program || '-'}</td>
                  <td className="px-4 py-3">{row.year_level || '-'}</td>
                  <td className="px-4 py-3">{row.has_disciplinary_action ? 'Has record' : 'No record'}</td>
                  <td className="px-4 py-3">{row.offense_type || '-'}</td>
                  <td className="px-4 py-3">{row.offense_incident_date || '-'}</td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan="7" className="px-4 py-10 text-center text-sm text-stone-500">No student records found.</td></tr>
              )}
              {loading && (
                <tr><td colSpan="7" className="px-4 py-10 text-center text-sm text-stone-500">Loading student records...</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
