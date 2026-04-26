import React, { useEffect, useMemo, useState } from 'react';
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
  Calendar,
  Filter,
  Loader2,
  Eye,
  RotateCcw,
} from 'lucide-react';
import { buildApiUrl } from '@/api';

const API_BASE = buildApiUrl('/api');

const C = {
  brown: '#5c2d0e',
  brownMid: '#7c4a2e',
};

function getAuthHeaders() {
  const token = localStorage.getItem('adminToken');
  return {
    Authorization: `Bearer ${token}`,
  };
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
          <p
            className={`truncate text-sm font-semibold ${active ? 'text-[#5c2d0e]' : 'text-stone-900'
              }`}
          >
            {report.name}
          </p>
          <p className="mt-1 text-xs text-stone-500">{report.sub}</p>
        </div>
      </div>
    </button>
  );
}

function formatCellValue(value) {
  if (value === null || value === undefined || value === '') return '—';

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (typeof value === 'string' && value.includes('T')) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString();
    }
  }

  return String(value);
}

function formatHeader(key) {
  return String(key || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ReportGeneration() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [reportTypes, setReportTypes] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [benefactors, setBenefactors] = useState([]);

  const [selected, setSelected] = useState('applications');
  const [academicYearId, setAcademicYearId] = useState('all');
  const [semester, setSemester] = useState('all');
  const [programId, setProgramId] = useState('all');
  const [benefactorId, setBenefactorId] = useState('all');

  const [previewRows, setPreviewRows] = useState([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [hasPreviewed, setHasPreviewed] = useState(false);

  useEffect(() => {
    loadMetadata();
  }, []);

  useEffect(() => {
    setPreviewRows([]);
    setPreviewTotal(0);
    setHasPreviewed(false);
  }, [selected, academicYearId, semester, programId, benefactorId]);

  const selectedReport = useMemo(
    () => reportTypes.find((r) => r.id === selected) || reportTypes[0],
    [reportTypes, selected]
  );

  const previewColumns = useMemo(() => {
    if (!previewRows.length) return [];
    return Object.keys(previewRows[0] || {});
  }, [previewRows]);

  const selectedLabels = useMemo(() => {
    const year =
      academicYears.find((item) => item.academic_year_id === academicYearId)
        ?.label || 'All Academic Years';

    const term =
      semesters.find((item) => item.value === semester)?.label || 'All Semesters';

    const program =
      programs.find((item) => item.program_id === programId)?.program_name ||
      'All Programs';

    const benefactor =
      benefactors.find((item) => item.benefactor_id === benefactorId)
        ?.benefactor_name || 'All Benefactors';

    return { year, term, program, benefactor };
  }, [academicYears, semesters, programs, benefactors, academicYearId, semester, programId, benefactorId]);

  async function loadMetadata() {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/reports/metadata`, {
        headers: getAuthHeaders(),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load report metadata.');
      }

      setReportTypes(data.reportTypes || []);
      setPrograms(data.programs || []);
      setAcademicYears(data.academicYears || []);
      setSemesters(data.semesters || []);
      setBenefactors(data.benefactors || []);

      if (data.reportTypes?.[0]?.id) {
        setSelected(data.reportTypes[0].id);
      }
    } catch (error) {
      console.error('REPORT METADATA LOAD ERROR:', error);
      alert(error.message || 'Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }

  function buildParams() {
    return new URLSearchParams({
      reportType: selected,
      academicYearId,
      semester,
      programId,
      benefactorId,
    });
  }

  function resetFilters() {
    setAcademicYearId('all');
    setSemester('all');
    setProgramId('all');
    setBenefactorId('all');
    setPreviewRows([]);
    setPreviewTotal(0);
    setHasPreviewed(false);
  }

  async function handlePreviewReport() {
    try {
      setPreviewLoading(true);

      const res = await fetch(`${API_BASE}/reports/preview?${buildParams()}`, {
        headers: getAuthHeaders(),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to preview report.');
      }

      setPreviewRows(Array.isArray(data.rows) ? data.rows : []);
      setPreviewTotal(Number(data.total || data.rows?.length || 0));
      setHasPreviewed(true);
    } catch (error) {
      console.error('REPORT PREVIEW ERROR:', error);
      alert(error.message || 'Failed to preview report.');
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleGenerateReport() {
    try {
      setGenerating(true);

      const res = await fetch(`${API_BASE}/reports/export?${buildParams()}`, {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to generate report.');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] || `${selected}_report.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('REPORT GENERATE ERROR:', error);
      alert(error.message || 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="overflow-hidden border-stone-200 bg-white shadow-none xl:col-span-4">
          <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-4">
            <h2 className="text-sm font-semibold text-stone-800">
              Report Templates
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Reports are generated from live SMaRT-PDM records.
            </p>
          </div>

          <CardContent className="space-y-3 p-4">
            {reportTypes.map((report) => (
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
                <h2 className="text-sm font-semibold text-stone-800">
                  Export Settings
                </h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  {selectedReport?.name || 'Report'}
                </p>
              </div>

              <div className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] text-stone-500">
                <Filter className="h-3.5 w-3.5" />
                Live database export
              </div>
            </div>
          </div>

          <CardContent className="space-y-6 p-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Academic Year
                </label>
                <Select value={academicYearId} onValueChange={setAcademicYearId}>
                  <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {academicYears.map((year) => (
                      <SelectItem
                        key={year.academic_year_id}
                        value={year.academic_year_id}
                      >
                        {year.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Benefactor
                </label>
                <Select value={benefactorId} onValueChange={setBenefactorId}>
                  <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {benefactors.map((benefactor) => (
                      <SelectItem
                        key={benefactor.benefactor_id}
                        value={benefactor.benefactor_id}
                      >
                        {benefactor.benefactor_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Program
                </label>
                <Select value={programId} onValueChange={setProgramId}>
                  <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem
                        key={program.program_id}
                        value={program.program_id}
                      >
                        {program.program_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                  Semester
                </label>
                <Select value={semester} onValueChange={setSemester}>
                  <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {semesters.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white">
                  <Calendar className="h-4 w-4 text-stone-500" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-stone-800">
                    Selected configuration
                  </p>
                  <p className="mt-1 text-xs leading-6 text-stone-500">
                    {selectedReport?.name || 'Report'} • {selectedLabels.year} •{' '}
                    {selectedLabels.term} • {selectedLabels.benefactor} •{' '}
                    {selectedLabels.program}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-stone-100 pt-4 sm:flex-row">
              <Button
                variant="outline"
                className="h-11 rounded-xl border-stone-200 text-sm font-semibold text-stone-700"
                disabled={previewLoading || generating}
                onClick={handlePreviewReport}
              >
                {previewLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="mr-2 h-4 w-4" />
                )}
                Preview
              </Button>

              <Button
                className="h-11 flex-1 rounded-xl border-none text-sm font-semibold text-white"
                style={{ background: C.brown }}
                disabled={generating}
                onClick={handleGenerateReport}
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Download Excel Report
              </Button>

              <Button
                variant="outline"
                className="h-11 rounded-xl border-stone-200 text-sm font-semibold text-stone-700"
                disabled={previewLoading || generating}
                onClick={resetFilters}
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {hasPreviewed && (
        <Card className="overflow-hidden border-stone-200 bg-white shadow-none">
          <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-4">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-stone-800">
                  Report Preview
                </h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  {previewRows.length > 0
                    ? `Showing ${previewRows.length} of ${previewTotal} matching records.`
                    : 'No matching records found for the selected filters.'}
                </p>
              </div>

              {previewRows.length > 0 && (
                <span className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium text-stone-500">
                  Preview only
                </span>
              )}
            </div>
          </div>

          <CardContent className="p-0">
            {previewLoading ? (
              <div className="flex h-[180px] items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-stone-400" />
              </div>
            ) : previewRows.length === 0 ? (
              <div className="flex h-[180px] flex-col items-center justify-center px-4 text-center">
                <FileText className="mb-2 h-7 w-7 text-stone-300" />
                <p className="text-sm font-medium text-stone-700">
                  No records to preview
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Try changing the academic year, benefactor, program, or semester.
                </p>
              </div>
            ) : (
              <div className="max-h-[420px] overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-stone-50 text-stone-500">
                    <tr>
                      {previewColumns.map((key) => (
                        <th
                          key={key}
                          className="whitespace-nowrap border-b border-stone-100 px-4 py-3 font-semibold"
                        >
                          {formatHeader(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr
                        key={index}
                        className="border-t border-stone-100 hover:bg-stone-50/70"
                      >
                        {previewColumns.map((key) => (
                          <td
                            key={key}
                            className="whitespace-nowrap px-4 py-3 text-stone-600"
                          >
                            {formatCellValue(row[key])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-stone-200 bg-white shadow-none">
        <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-4">
          <h2 className="text-sm font-semibold text-stone-800">
            Report Notes
          </h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Recent report history can be added later by storing generated report logs.
          </p>
        </div>

        <CardContent className="p-5 text-sm text-stone-500">
          Reports are generated directly from applications, active scholars,
          payout batches, and support tickets based on the filters above.
        </CardContent>
      </Card>
    </div>
  );
}