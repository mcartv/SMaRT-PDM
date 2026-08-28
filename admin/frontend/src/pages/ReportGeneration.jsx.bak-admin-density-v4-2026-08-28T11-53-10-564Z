import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import PageLoadingSkeleton from '@/components/system/PageLoadingSkeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  Loader2,
  Eye,
  RotateCcw,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';
import usePortalTheme from '@/hooks/usePortalTheme';

const API_BASE = buildApiUrl('/api');

const OFFICE_REPORT_FILTERS = {
  endorsements: [
    { value: 'all', label: 'All Endorsements' },
    { value: 'pending', label: 'Pending' },
    { value: 'completed', label: 'Completed' },
    { value: 'major_offense', label: 'Stopped — Major Offense' },
  ],
  sdo: [
    { value: 'all', label: 'All SDO Results' },
    { value: 'pending', label: 'Pending' },
    { value: 'no_offense', label: 'No Disciplinary Offense' },
    { value: 'minor_offense', label: 'With Minor Offense/s' },
    { value: 'major_offense', label: 'With Major Offense/s' },
  ],
  guidance: [
    { value: 'all', label: 'All Guidance Results' },
    { value: 'pending', label: 'Pending' },
    { value: 'good_moral_standing', label: 'Good Moral Standing' },
  ],
  pd: [
    { value: 'all', label: 'All PD Results' },
    { value: 'pending', label: 'Pending' },
    { value: 'good_scholastic_standing', label: 'Good Scholastic Standing' },
    { value: 'average_scholastic_standing', label: 'Average Scholastic Standing' },
    { value: 'completed', label: 'Completed Slip' },
  ],
  ro: [
    { value: 'all', label: 'All RO Records' },
    { value: 'pending_validation', label: 'Pending Validation' },
    { value: 'assigned', label: 'Assigned Scholars' },
    { value: 'completed', label: 'Cleared RO' },
  ],
};

function getAuthHeaders(tokenStorageKey = 'adminToken') {
  const token = sessionStorage.getItem(tokenStorageKey);
  return {
    Authorization: `Bearer ${token}`,
  };
}

function TemplateCard({ report, active, onClick, theme }) {
  return (
    <button
      type="button"
      onClick={() => onClick(report.id)}
      className={`report-template-card w-full rounded-2xl border p-4 text-left transition-all ${active
        ? ''
        : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
        }`}
      style={active ? { borderColor: theme.base, background: theme.accentSoft } : undefined}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${active
            ? 'text-white'
            : 'border-stone-200 bg-stone-50 text-stone-500'
            }`}
          style={active ? { borderColor: theme.base, background: theme.base } : undefined}
        >
          <FileText className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="report-template-title truncate text-sm font-semibold" style={{ color: active ? theme.base : '#1c1917' }}>
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
  const customLabels = {
    pdm_id: 'Student Number',
    student_name: 'Student Name',
    course_code: 'Course',
    year_level: 'Year Level',
    program_name: 'Program',
    academic_year: 'Academic Year',
    scholarship_status: 'Scholarship Status',
    date_awarded: 'Date Awarded',
    ro_status: 'RO Status',
    benefactor_name: 'Benefactor',
  };

  if (customLabels[key]) return customLabels[key];

  return String(key || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function ReportGeneration({
  tokenStorageKey = 'adminToken',
  allowedReportTypes = null,
  defaultReportType = '',
}) {
  const portalKey = tokenStorageKey === 'sdoToken'
    ? 'sdo'
    : tokenStorageKey === 'guidanceToken'
      ? 'guidance'
      : tokenStorageKey === 'pdToken'
        ? 'pd'
        : tokenStorageKey === 'roCoordinatorToken'
          ? 'ro_coordinator'
          : 'admin';
  const { theme } = usePortalTheme(portalKey);
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
  const [reviewResult, setReviewResult] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [previewRows, setPreviewRows] = useState([]);
  const [previewTotal, setPreviewTotal] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [hasPreviewed, setHasPreviewed] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const visibleReportTypes = useMemo(() => {
    if (!Array.isArray(allowedReportTypes) || allowedReportTypes.length === 0) {
      return reportTypes;
    }

    return reportTypes.filter((report) => allowedReportTypes.includes(report.id));
  }, [allowedReportTypes, reportTypes]);

  useEffect(() => {
    setPreviewRows([]);
    setPreviewTotal(0);
    setHasPreviewed(false);
  }, [selected, academicYearId, semester, programId, benefactorId, reviewResult, dateFrom, dateTo]);

  useEffect(() => {
    if (!feedback) return undefined;

    const timer = window.setTimeout(() => {
      setFeedback(null);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [feedback]);

  const selectedReport = useMemo(
    () => visibleReportTypes.find((r) => r.id === selected) || visibleReportTypes[0],
    [visibleReportTypes, selected]
  );

  const officeFilterOptions = useMemo(
    () => OFFICE_REPORT_FILTERS[selected] || [],
    [selected]
  );

  const isOfficeEndorsementReport = useMemo(
    () => ['endorsements', 'sdo', 'guidance', 'pd', 'ro'].includes(selected),
    [selected]
  );
  const isScholarCountReport = useMemo(
    () => selected === 'scholars_by_benefactor',
    [selected]
  );
  const supportsPeriodFilters = true;
  const supportsProgramFilter = true;
  const supportsBenefactorFilter = selected !== 'payouts';

  const previewColumns = useMemo(() => {
    if (!previewRows.length) return [];
    return Object.keys(previewRows[0] || {});
  }, [previewRows]);

  const scholarCountXAxisKey = useMemo(() => {
    if (!isScholarCountReport) return 'label';
    return benefactorId === 'all' ? 'benefactor_name' : 'program_name';
  }, [benefactorId, isScholarCountReport]);

  const scholarCountChartData = useMemo(() => {
    if (!isScholarCountReport || previewRows.length === 0) return [];

    return previewRows
      .map((row) => ({
        name:
          row[scholarCountXAxisKey] ||
          (benefactorId === 'all' ? 'Unassigned Benefactor' : 'Unassigned Program'),
        count: Number(row.scholar_count || 0),
      }))
      .filter((row) => Number.isFinite(row.count));
  }, [benefactorId, isScholarCountReport, previewRows, scholarCountXAxisKey]);

  const scholarCountChartHeight = useMemo(
    () => Math.max(300, scholarCountChartData.length * 54),
    [scholarCountChartData.length]
  );

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

    const result =
      officeFilterOptions.find((item) => item.value === reviewResult)?.label || 'All Results';

    return { year, term, program, benefactor, result };
  }, [academicYears, semesters, programs, benefactors, academicYearId, semester, programId, benefactorId, officeFilterOptions, reviewResult]);

  const loadMetadata = useCallback(async () => {
    try {
      setLoading(true);

      const res = await fetch(`${API_BASE}/reports/metadata`, {
        headers: getAuthHeaders(tokenStorageKey),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load report metadata.');
      }

      const allReports = data.reportTypes || [];
      setReportTypes(allReports);
      setPrograms(data.programs || []);
      setAcademicYears(data.academicYears || []);
      setSemesters(data.semesters || []);
      setBenefactors(data.benefactors || []);

      const allowed =
        Array.isArray(allowedReportTypes) && allowedReportTypes.length > 0
          ? allReports.filter((report) => allowedReportTypes.includes(report.id))
          : allReports;

      const preferred =
        allowed.find((report) => report.id === defaultReportType)?.id ||
        allowed[0]?.id ||
        'applications';

      if (preferred) {
        setSelected(preferred);
      }
    } catch (error) {
      console.error('REPORT METADATA LOAD ERROR:', error);
      setFeedback({
        tone: 'error',
        title: 'Failed to load reports',
        message: error.message || 'Failed to load reports.',
      });
    } finally {
      setLoading(false);
    }
  }, [allowedReportTypes, defaultReportType, tokenStorageKey]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  const buildParams = useCallback(() => {
    return new URLSearchParams({
      reportType: selected,
      academicYearId,
      semester,
      programId,
      benefactorId,
      reviewResult,
      dateFrom,
      dateTo,
    });
  }, [academicYearId, benefactorId, dateFrom, dateTo, programId, reviewResult, selected, semester]);

  function resetFilters() {
    setAcademicYearId('all');
    setSemester('all');
    setProgramId('all');
    setBenefactorId('all');
    setReviewResult('all');
    setDateFrom('');
    setDateTo('');
    setPreviewRows([]);
    setPreviewTotal(0);
    setHasPreviewed(false);
  }

  const handlePreviewReport = useCallback(async () => {
    try {
      setPreviewLoading(true);

      const res = await fetch(`${API_BASE}/reports/preview?${buildParams()}`, {
        headers: getAuthHeaders(tokenStorageKey),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || 'Failed to preview report.');
      }

      setPreviewRows(Array.isArray(data.rows) ? data.rows : []);
      setPreviewTotal(Number(data.total || data.rows?.length || 0));
      setHasPreviewed(true);
      setFeedback(null);
    } catch (error) {
      console.error('REPORT PREVIEW ERROR:', error);
      setFeedback({
        tone: 'error',
        title: 'Preview failed',
        message: error.message || 'Failed to preview report.',
      });
    } finally {
      setPreviewLoading(false);
    }
  }, [
    buildParams,
    tokenStorageKey,
  ]);

  const refreshReportData = useCallback(async () => {
    await loadMetadata();

    if (hasPreviewed) {
      await handlePreviewReport();
    }
  }, [handlePreviewReport, hasPreviewed, loadMetadata]);

  useSocketEvent('maintenance:updated', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('report:updated', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('application:created', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('application:updated', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('application:approved', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('application:rejected', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('application:disqualified', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('application-document:reviewed', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('scholar:created', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('scholar:updated', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('endorsement:updated', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('ro:updated', () => {
    refreshReportData();
  }, [refreshReportData]);




  useSocketEvent('announcement:created', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('announcement:updated', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('announcement:archived', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('announcement:restored', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('opening:archived', () => {
    refreshReportData();
  }, [refreshReportData]);

  useSocketEvent('opening:restored', () => {
    refreshReportData();
  }, [refreshReportData]);



  async function handleGenerateReport() {
    await handleDownloadByFormat('xlsx');
  }

  async function handleDownloadByFormat(format = 'xlsx') {
    try {
      setGenerating(true);

      const params = buildParams();
      params.set('format', format);

      const res = await fetch(`${API_BASE}/reports/export?${params.toString()}`, {
        headers: getAuthHeaders(tokenStorageKey),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to generate report.');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] || `${selected}_report.${format === 'csv' ? 'csv' : 'xlsx'}`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
      toast.success(`${format === 'csv' ? 'CSV' : 'Excel'} download started`, {
        description: `${filename} is being downloaded.`,
      });
    } catch (error) {
      console.error('REPORT GENERATE ERROR:', error);
      setFeedback({
        tone: 'error',
        title: 'Report export failed',
        message: error.message || 'Failed to generate report.',
      });
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return <PageLoadingSkeleton label="Loading reports" variant="cards" />;
  }

  return (
    <div className="space-y-5 py-2">
      {feedback ? (
        <div className="rounded-2xl border border-red-200 bg-gradient-to-r from-red-50 to-rose-50 px-4 py-4 text-red-900 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-red-100 p-2 text-red-700">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">{feedback.title}</p>
                <p className="mt-1 text-sm opacity-90">{feedback.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-current/15 bg-white/70 transition hover:bg-white"
              title="Dismiss message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="overflow-hidden border-stone-200 bg-white shadow-none xl:col-span-4">
          <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-4">
            <h2 className="report-section-title text-sm font-semibold text-stone-800">
              Report Templates
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Reports are generated from live SMaRT-PDM records.
            </p>
          </div>

          <CardContent className="space-y-3 p-4">
            {visibleReportTypes.map((report) => (
              <TemplateCard
                key={report.id}
                report={report}
                active={selected === report.id}
                onClick={setSelected}
                theme={theme}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-stone-200 bg-white shadow-none xl:col-span-8">
          <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="report-section-title text-sm font-semibold text-stone-800">
                  Export Settings
                </h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  {selectedReport?.name || 'Report'}
                </p>
              </div>

            </div>
          </div>

          <CardContent className="space-y-6 p-5">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {supportsPeriodFilters ? <div className="space-y-2">
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
              </div> : null}

              {supportsBenefactorFilter ? <div className="space-y-2">
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
              </div> : null}

              {supportsProgramFilter ? <div className="space-y-2">
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
              </div> : null}

              {supportsPeriodFilters ? <div className="space-y-2">
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
              </div> : null}

              {isOfficeEndorsementReport ? (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    Office Result
                  </label>
                  <Select value={reviewResult} onValueChange={setReviewResult}>
                    <SelectTrigger className="h-11 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {officeFilterOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {isOfficeEndorsementReport ? (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    Date From
                  </label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(event) => setDateFrom(event.target.value)}
                    className="h-11 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium"
                  />
                </div>
              ) : null}

              {isOfficeEndorsementReport ? (
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
                    Date To
                  </label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(event) => setDateTo(event.target.value)}
                    className="h-11 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium"
                  />
                </div>
              ) : null}
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
                    {isOfficeEndorsementReport ? ` • ${selectedLabels.result}` : ''}
                    {dateFrom ? ` • from ${dateFrom}` : ''}
                    {dateTo ? ` • to ${dateTo}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 pt-4 sm:flex-row">
              <Button
                variant="outline"
                className="report-action-button h-11 rounded-xl text-sm font-semibold"
                style={{ borderColor: theme.border, color: theme.base }}
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

              <div className="flex flex-1 gap-3">
                <Button
                  className="report-action-button h-11 flex-1 rounded-xl border-none text-sm font-semibold text-white"
                  style={{ background: theme.base }}
                  disabled={generating}
                  onClick={handleGenerateReport}
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Download Excel
                </Button>
                <Button
                  variant="outline"
                  className="report-action-button h-11 rounded-xl text-sm font-semibold"
                  style={{ borderColor: theme.border, color: theme.base }}
                  disabled={generating}
                  onClick={() => handleDownloadByFormat('csv')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download CSV
                </Button>
              </div>

              <Button
                variant="outline"
                className="report-action-button h-11 rounded-xl text-sm font-semibold"
                style={{ borderColor: theme.border, color: theme.base }}
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
                    ? isScholarCountReport
                      ? `${previewTotal} active scholar(s) across ${previewRows.length} ${benefactorId === 'all' ? 'benefactor(s)' : 'program(s)'}.`
                      : `Showing ${previewRows.length} of ${previewTotal} matching records.`
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
            {isScholarCountReport && previewRows.length > 0 ? (
              <div className="border-b border-stone-100 p-4">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">Scholar Count Chart</p>
                    <p className="text-xs text-stone-500">
                      {benefactorId === 'all'
                        ? 'Counting active scholars for each benefactor.'
                        : 'Counting active scholars by program for the selected benefactor.'}
                    </p>
                  </div>
                </div>
                <div className="max-h-[520px] min-h-0 min-w-0 overflow-y-auto">
                  <div style={{ height: `${scholarCountChartHeight}px`, minWidth: 0 }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                      <BarChart
                        data={scholarCountChartData}
                        layout="vertical"
                        margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={180}
                          tick={{ fontSize: 12 }}
                          interval={0}
                        />
                        <Tooltip formatter={(value) => [Number(value || 0), 'Scholars']} />
                        <Bar dataKey="count" fill={theme.base} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            ) : null}
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
          payout batches, and endorsement records based on the filters above.
        </CardContent>
      </Card>
    </div>
  );
}
