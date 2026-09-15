import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  ro_compliance: [
    { value: 'all', label: 'All Compliance Statuses' },
    { value: 'finished', label: 'Finished RO' },
    { value: 'not_fully_complied', label: 'Not Fully Complied' },
  ],
  renewals: [
    { value: 'all', label: 'All Renewal Outcomes' },
    { value: 'approved', label: 'Renewed' },
    { value: 'rejected', label: 'Did Not Renew' },
  ],
  slot_utilization: [
    { value: 'all', label: 'All Opening Statuses' },
    { value: 'draft', label: 'Draft' },
    { value: 'open', label: 'Open' },
    { value: 'closed', label: 'Closed' },
    { value: 'archived', label: 'Archived' },
  ],
};

const REPORT_TEMPLATE_GROUPS = [
  {
    label: 'Scholarship & Applications',
    ids: ['applications', 'endorsements', 'slot_utilization'],
  },
  {
    label: 'Scholar Management',
    ids: ['scholars', 'scholars_by_benefactor', 'renewals'],
  },
  {
    label: 'Scholar Operations',
    ids: ['payouts', 'ro_compliance'],
  },
  {
    label: 'Office Reports',
    ids: ['sdo', 'guidance', 'pd', 'ro'],
  },
];

const REPORT_FILTER_FIELDS = {
  slot_utilization: ['academicYear', 'semester', 'benefactor', 'program', 'result', 'date'],
  applications: [
    'academicYear', 'semester', 'benefactor', 'program', 'course', 'yearLevel', 'gender',
    'applicationStatus', 'documentStatus', 'verificationStatus', 'date',
  ],
  endorsements: ['academicYear', 'semester', 'benefactor', 'program', 'course', 'yearLevel', 'gender', 'result', 'date'],
  scholars: ['academicYear', 'semester', 'benefactor', 'program', 'course', 'yearLevel', 'gender', 'date'],
  scholars_by_benefactor: ['academicYear', 'semester', 'benefactor', 'program', 'course', 'yearLevel', 'gender', 'date'],
  renewals: ['academicYear', 'semester', 'benefactor', 'program', 'course', 'yearLevel', 'result', 'date'],
  payouts: [
    'academicYear', 'semester', 'benefactor', 'program', 'course', 'yearLevel', 'gender',
    'batchStatus', 'releaseStatus', 'paymentMode', 'date',
  ],
  ro_compliance: ['academicYear', 'semester', 'benefactor', 'program', 'roArea', 'course', 'yearLevel', 'gender', 'result', 'date'],
  sdo: ['academicYear', 'semester', 'benefactor', 'program', 'course', 'yearLevel', 'gender', 'result', 'date'],
  guidance: ['academicYear', 'semester', 'benefactor', 'program', 'course', 'yearLevel', 'gender', 'result', 'date'],
  pd: ['academicYear', 'semester', 'benefactor', 'program', 'course', 'yearLevel', 'gender', 'result', 'date'],
  ro: ['academicYear', 'semester', 'program', 'course', 'yearLevel', 'gender', 'roArea', 'result', 'date'],
};

const EXPORT_COOLDOWN_MS = 1500;
const EXPORT_TIMEOUT_MS = 90 * 1000;

function getAuthHeaders(tokenStorageKey = 'adminToken') {
  const token = sessionStorage.getItem(tokenStorageKey);
  return {
    Authorization: `Bearer ${token}`,
  };
}

function TemplateRow({ report, active, onClick, theme }) {
  return (
    <button
      type="button"
      onClick={() => onClick(report.id)}
      className={`report-template-card group flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${
        active
          ? ''
          : 'border-stone-200/60 bg-transparent hover:border-stone-300/90 hover:bg-stone-50'
      }`}
      style={active ? { borderColor: theme.base, background: theme.accentSoft } : undefined}
    >
      <div
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
          active
            ? 'text-white'
            : 'border-stone-200 bg-white text-stone-500 group-hover:border-stone-300'
        }`}
        style={active ? { borderColor: theme.base, background: theme.base } : undefined}
      >
        <FileText className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p
          className="report-template-title text-sm font-semibold leading-5"
          style={{ color: active ? theme.base : '#1c1917' }}
        >
          {report.name}
        </p>
        <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-stone-500">
          {report.sub}
        </p>
      </div>
    </button>
  );
}

function FilterField({ label, children }) {
  return (
    <div className="min-w-0 space-y-2">
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-400">
        {label}
      </label>
      {children}
    </div>
  );
}

function formatCellValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  if (typeof value === 'string' && value.includes('T')) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }

  const text = String(value);
  if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/i.test(text)) {
    return text
      .replaceAll('_', ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .replace(/\bSdo\b/g, 'SDO')
      .replace(/\bPd\b/g, 'PD')
      .replace(/\bRo\b/g, 'RO');
  }

  return text;
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
    assigned_areas: 'Assigned RO Area',
    personnel_in_charge: 'PIC Name',
    compliance_status: 'Compliance Status',
    completion_percentage: 'Completion %',
    clearance_status: 'Clearance Status',
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
  const [exportState, setExportState] = useState({});
  const [lockedReports, setLockedReports] = useState(() => new Set());
  const exportLocksRef = useRef(new Set());
  const exportCooldownTimersRef = useRef(new Map());
  const metadataInitializedRef = useRef(false);
  const [reportTypes, setReportTypes] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [benefactors, setBenefactors] = useState([]);
  const [courses, setCourses] = useState([]);
  const [roAreas, setRoAreas] = useState([]);
  const [yearLevels, setYearLevels] = useState([]);
  const [genders, setGenders] = useState([]);
  const [applicationStatuses, setApplicationStatuses] = useState([]);
  const [documentStatuses, setDocumentStatuses] = useState([]);
  const [verificationStatuses, setVerificationStatuses] = useState([]);
  const [payoutBatchStatuses, setPayoutBatchStatuses] = useState([]);
  const [payoutReleaseStatuses, setPayoutReleaseStatuses] = useState([]);
  const [payoutPaymentModes, setPayoutPaymentModes] = useState([]);

  const [selected, setSelected] = useState('applications');
  const [academicYearId, setAcademicYearId] = useState('all');
  const [semester, setSemester] = useState('all');
  const [programId, setProgramId] = useState('all');
  const [benefactorId, setBenefactorId] = useState('all');
  const [reviewResult, setReviewResult] = useState('all');
  const [courseId, setCourseId] = useState('all');
  const [roAreaId, setRoAreaId] = useState('all');
  const [yearLevel, setYearLevel] = useState('all');
  const [gender, setGender] = useState('all');
  const [applicationStatus, setApplicationStatus] = useState('all');
  const [documentStatus, setDocumentStatus] = useState('all');
  const [verificationStatus, setVerificationStatus] = useState('all');
  const [batchStatus, setBatchStatus] = useState('all');
  const [releaseStatus, setReleaseStatus] = useState('all');
  const [paymentMode, setPaymentMode] = useState('all');
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

  const groupedReportTypes = useMemo(() => {
    const reportMap = new Map(visibleReportTypes.map((report) => [report.id, report]));
    const assigned = new Set();
    const groups = REPORT_TEMPLATE_GROUPS.map((group) => {
      const reports = group.ids
        .map((id) => reportMap.get(id))
        .filter(Boolean);
      reports.forEach((report) => assigned.add(report.id));
      return { ...group, reports };
    }).filter((group) => group.reports.length > 0);

    const remaining = visibleReportTypes.filter((report) => !assigned.has(report.id));
    if (remaining.length > 0) {
      groups.push({ label: 'Other Reports', ids: [], reports: remaining });
    }

    return groups;
  }, [visibleReportTypes]);

  useEffect(() => {
    setPreviewRows([]);
    setPreviewTotal(0);
    setHasPreviewed(false);
  }, [
    selected, academicYearId, semester, programId, benefactorId, reviewResult, courseId,
    roAreaId, yearLevel, gender, applicationStatus, documentStatus, verificationStatus,
    batchStatus, releaseStatus, paymentMode, dateFrom, dateTo,
  ]);

  useEffect(() => () => {
    exportCooldownTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    exportCooldownTimersRef.current.clear();
  }, []);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(null), 5000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const selectedReport = useMemo(
    () => visibleReportTypes.find((report) => report.id === selected) || visibleReportTypes[0],
    [visibleReportTypes, selected]
  );

  const officeFilterOptions = useMemo(
    () => OFFICE_REPORT_FILTERS[selected] || [],
    [selected]
  );

  const activeFilterFields = useMemo(
    () => new Set(REPORT_FILTER_FIELDS[selected] || []),
    [selected]
  );
  const supportsAcademicYearFilter = activeFilterFields.has('academicYear');
  const supportsSemesterFilter = activeFilterFields.has('semester');
  const supportsProgramFilter = activeFilterFields.has('program');
  const supportsBenefactorFilter = activeFilterFields.has('benefactor');
  const supportsCourseFilter = activeFilterFields.has('course');
  const supportsYearLevelFilter = activeFilterFields.has('yearLevel');
  const supportsGenderFilter = activeFilterFields.has('gender');
  const supportsRoAreaFilter = activeFilterFields.has('roArea');
  const supportsResultFilter = activeFilterFields.has('result');
  const supportsApplicationStatusFilter = activeFilterFields.has('applicationStatus');
  const supportsDocumentStatusFilter = activeFilterFields.has('documentStatus');
  const supportsVerificationStatusFilter = activeFilterFields.has('verificationStatus');
  const supportsBatchStatusFilter = activeFilterFields.has('batchStatus');
  const supportsReleaseStatusFilter = activeFilterFields.has('releaseStatus');
  const supportsPaymentModeFilter = activeFilterFields.has('paymentMode');
  const supportsDateFilters = activeFilterFields.has('date');
  const isScholarCountReport = selected === 'scholars_by_benefactor';
  const isDateRangeInvalid = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const isSelectedReportExportLocked = lockedReports.has(selected);
  const selectedGeneratingFormat = exportState[selected] || null;

  const resultFilterLabel = selected === 'ro_compliance'
    ? 'Compliance Status'
    : selected === 'renewals'
      ? 'Renewal Status'
      : selected === 'slot_utilization'
        ? 'Opening Status'
        : selected === 'endorsements'
          ? 'Endorsement Result'
          : 'Office Result';

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

  const loadMetadata = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/reports/metadata`, {
        headers: getAuthHeaders(tokenStorageKey),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || 'Failed to load report metadata.');

      const allReports = data.reportTypes || [];
      setReportTypes(allReports);
      setPrograms(data.programs || []);
      setAcademicYears(data.academicYears || []);
      setSemesters(data.semesters || []);
      setBenefactors(data.benefactors || []);
      setCourses(data.courses || []);
      setRoAreas(data.roAreas || []);
      setYearLevels(data.yearLevels || []);
      setGenders(data.genders || []);
      setApplicationStatuses(data.applicationStatuses || []);
      setDocumentStatuses(data.documentStatuses || []);
      setVerificationStatuses(data.verificationStatuses || []);
      setPayoutBatchStatuses(data.payoutBatchStatuses || []);
      setPayoutReleaseStatuses(data.payoutReleaseStatuses || []);
      setPayoutPaymentModes(data.payoutPaymentModes || []);

      const allowed = Array.isArray(allowedReportTypes) && allowedReportTypes.length > 0
        ? allReports.filter((report) => allowedReportTypes.includes(report.id))
        : allReports;
      const preferred = allowed.find((report) => report.id === defaultReportType)?.id || allowed[0]?.id || 'applications';
      if (preferred) {
        setSelected((current) => {
          const shouldUsePreferred = !metadataInitializedRef.current || !allowed.some((report) => report.id === current);
          metadataInitializedRef.current = true;
          return shouldUsePreferred ? preferred : current;
        });
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
    const has = (field) => activeFilterFields.has(field);
    return new URLSearchParams({
      reportType: selected,
      academicYearId: has('academicYear') ? academicYearId : 'all',
      semester: has('semester') ? semester : 'all',
      programId: has('program') ? programId : 'all',
      benefactorId: has('benefactor') ? benefactorId : 'all',
      reviewResult: has('result') ? reviewResult : 'all',
      courseId: has('course') ? courseId : 'all',
      roAreaId: has('roArea') ? roAreaId : 'all',
      yearLevel: has('yearLevel') ? yearLevel : 'all',
      gender: has('gender') ? gender : 'all',
      applicationStatus: has('applicationStatus') ? applicationStatus : 'all',
      documentStatus: has('documentStatus') ? documentStatus : 'all',
      verificationStatus: has('verificationStatus') ? verificationStatus : 'all',
      batchStatus: has('batchStatus') ? batchStatus : 'all',
      releaseStatus: has('releaseStatus') ? releaseStatus : 'all',
      paymentMode: has('paymentMode') ? paymentMode : 'all',
      dateFrom: has('date') ? dateFrom : '',
      dateTo: has('date') ? dateTo : '',
    });
  }, [
    activeFilterFields, selected, academicYearId, semester, programId, benefactorId,
    reviewResult, courseId, roAreaId, yearLevel, gender, applicationStatus, documentStatus,
    verificationStatus, batchStatus, releaseStatus, paymentMode, dateFrom, dateTo,
  ]);

  function resetFilters() {
    setAcademicYearId('all');
    setSemester('all');
    setProgramId('all');
    setBenefactorId('all');
    setReviewResult('all');
    setCourseId('all');
    setRoAreaId('all');
    setYearLevel('all');
    setGender('all');
    setApplicationStatus('all');
    setDocumentStatus('all');
    setVerificationStatus('all');
    setBatchStatus('all');
    setReleaseStatus('all');
    setPaymentMode('all');
    setDateFrom('');
    setDateTo('');
    setPreviewRows([]);
    setPreviewTotal(0);
    setHasPreviewed(false);
  }

  const handlePreviewReport = useCallback(async () => {
    if (isDateRangeInvalid) {
      setFeedback({
        tone: 'error',
        title: 'Invalid date range',
        message: 'Date From cannot be later than Date To.',
      });
      return;
    }

    try {
      setPreviewLoading(true);
      const res = await fetch(`${API_BASE}/reports/preview?${buildParams()}`, {
        headers: getAuthHeaders(tokenStorageKey),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || 'Failed to preview report.');

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
  }, [buildParams, isDateRangeInvalid, tokenStorageKey]);

  const refreshReportData = useCallback(async () => {
    await loadMetadata();
    if (hasPreviewed) await handlePreviewReport();
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

  function acquireClientExportLock(reportId) {
    if (exportLocksRef.current.has(reportId)) return false;

    exportLocksRef.current.add(reportId);
    setLockedReports((previous) => {
      const next = new Set(previous);
      next.add(reportId);
      return next;
    });
    return true;
  }

  function releaseClientExportLockAfterCooldown(reportId) {
    const previousTimer = exportCooldownTimersRef.current.get(reportId);
    if (previousTimer) window.clearTimeout(previousTimer);

    const timer = window.setTimeout(() => {
      exportLocksRef.current.delete(reportId);
      exportCooldownTimersRef.current.delete(reportId);
      setLockedReports((previous) => {
        const next = new Set(previous);
        next.delete(reportId);
        return next;
      });
    }, EXPORT_COOLDOWN_MS);

    exportCooldownTimersRef.current.set(reportId, timer);
  }

  async function handleGenerateReport() {
    await handleDownloadByFormat(isScholarCountReport ? 'pdf' : 'xlsx');
  }

  async function handleDownloadByFormat(format = 'xlsx') {
    if (isDateRangeInvalid) {
      setFeedback({
        tone: 'error',
        title: 'Invalid date range',
        message: 'Date From cannot be later than Date To.',
      });
      return;
    }

    const reportId = selected;
    if (!acquireClientExportLock(reportId)) {
      setFeedback({
        tone: 'error',
        title: 'Report export in progress',
        message: 'This report is already being generated.',
      });
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), EXPORT_TIMEOUT_MS);

    try {
      setExportState((previous) => ({ ...previous, [reportId]: format }));
      const params = buildParams();
      params.set('format', format);

      const res = await fetch(`${API_BASE}/reports/export?${params.toString()}`, {
        headers: getAuthHeaders(tokenStorageKey),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || 'Failed to generate report.');
      }

      const blob = await res.blob();
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="(.+)"/);
      const extension = format === 'csv' ? 'csv' : format === 'pdf' ? 'pdf' : 'xlsx';
      const filename = match?.[1] || `${reportId}_report.${extension}`;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');

      try {
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
      } finally {
        link.remove();
        window.URL.revokeObjectURL(url);
      }

      const formatLabel = format === 'csv' ? 'CSV' : format === 'pdf' ? 'PDF' : 'Excel';
      toast.success(`${formatLabel} download started`, {
        description: `${filename} is being downloaded.`,
      });
      setFeedback(null);
    } catch (error) {
      console.error('REPORT GENERATE ERROR:', error);
      const timedOut = error?.name === 'AbortError';
      setFeedback({
        tone: 'error',
        title: timedOut ? 'Report export timed out' : 'Report export failed',
        message: timedOut
          ? 'The report took too long to generate. Please try again.'
          : error.message || 'Failed to generate report.',
      });
    } finally {
      window.clearTimeout(timeout);
      setExportState((previous) => {
        const next = { ...previous };
        delete next[reportId];
        return next;
      });
      releaseClientExportLockAfterCooldown(reportId);
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
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-2xl bg-red-100 p-2 text-red-700">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{feedback.title}</p>
                <p className="mt-1 break-words text-sm opacity-90">{feedback.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-current/15 bg-white/70 transition hover:bg-white"
              title="Dismiss message"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Card className="min-w-0 overflow-hidden border-stone-200 bg-white shadow-none xl:col-span-4">
          <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-4">
            <h2 className="report-section-title text-sm font-semibold text-stone-800">
              Report Templates
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Reports are generated from live SMaRT-PDM records.
            </p>
          </div>

          <CardContent className="p-3 sm:p-4">
            <div className="space-y-5">
              {groupedReportTypes.map((group) => (
                <section key={group.label} className="min-w-0">
                  <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                    {group.label}
                  </p>
                  <div className="space-y-1">
                    {group.reports.map((report) => (
                      <TemplateRow
                        key={report.id}
                        report={report}
                        active={selected === report.id}
                        onClick={(reportId) => {
                          setSelected(reportId);
                          setReviewResult('all');
                          setApplicationStatus('all');
                          setDocumentStatus('all');
                          setVerificationStatus('all');
                          setBatchStatus('all');
                          setReleaseStatus('all');
                          setPaymentMode('all');
                        }}
                        theme={theme}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden border-stone-200 bg-white shadow-none xl:col-span-8">
          <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-4 sm:px-5">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="report-section-title break-words text-base font-semibold text-stone-900">
                  {selectedReport?.name || 'Report'}
                </h2>
                <p className="mt-0.5 max-w-2xl text-xs leading-5 text-stone-500">
                  {selectedReport?.sub || 'Set the filters below to generate this report.'}
                </p>
              </div>
            </div>
          </div>

          <CardContent className="p-4 sm:p-5">
            <div className="mx-auto w-full max-w-4xl space-y-6">
              <section className="min-w-0">
                <div className="mb-4 flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                    <Filter className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-stone-800">Filters</h3>
                    <p className="mt-0.5 text-xs text-stone-500">Set the parameters for the report.</p>
                  </div>
                </div>

                <div className="grid min-w-0 grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
                  {supportsAcademicYearFilter ? (
                    <FilterField label="Academic Year">
                      <Select value={academicYearId} onValueChange={setAcademicYearId}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {academicYears.map((year) => (
                            <SelectItem key={year.academic_year_id} value={year.academic_year_id}>
                              {year.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsSemesterFilter ? (
                    <FilterField label="Semester">
                      <Select value={semester} onValueChange={setSemester}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {semesters.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsBenefactorFilter ? (
                    <FilterField label="Benefactor">
                      <Select value={benefactorId} onValueChange={setBenefactorId}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {benefactors.map((benefactor) => (
                            <SelectItem key={benefactor.benefactor_id} value={benefactor.benefactor_id}>
                              {benefactor.benefactor_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsProgramFilter ? (
                    <FilterField label="Program">
                      <Select value={programId} onValueChange={setProgramId}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {programs.map((program) => (
                            <SelectItem key={program.program_id} value={program.program_id}>
                              {program.program_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsCourseFilter ? (
                    <FilterField label="Course">
                      <Select value={courseId} onValueChange={setCourseId}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {courses.map((course) => (
                            <SelectItem key={course.course_id} value={course.course_id}>
                              {course.course_code}{course.course_name && course.course_name !== course.course_code ? ` — ${course.course_name}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsYearLevelFilter ? (
                    <FilterField label="Year Level">
                      <Select value={yearLevel} onValueChange={setYearLevel}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {yearLevels.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsGenderFilter ? (
                    <FilterField label="Gender">
                      <Select value={gender} onValueChange={setGender}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {genders.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsRoAreaFilter ? (
                    <FilterField label="Assigned RO Area">
                      <Select value={roAreaId} onValueChange={setRoAreaId}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {roAreas.map((area) => (
                            <SelectItem key={area.department_id} value={area.department_id}>
                              {area.department_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsResultFilter ? (
                    <FilterField label={resultFilterLabel}>
                      <Select value={reviewResult} onValueChange={setReviewResult}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {officeFilterOptions.map((item) => (
                            <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsApplicationStatusFilter ? (
                    <FilterField label="Application Status">
                      <Select value={applicationStatus} onValueChange={setApplicationStatus}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent>{applicationStatuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsDocumentStatusFilter ? (
                    <FilterField label="Document Status">
                      <Select value={documentStatus} onValueChange={setDocumentStatus}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent>{documentStatuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsVerificationStatusFilter ? (
                    <FilterField label="Verification Status">
                      <Select value={verificationStatus} onValueChange={setVerificationStatus}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent>{verificationStatuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsBatchStatusFilter ? (
                    <FilterField label="Batch Status">
                      <Select value={batchStatus} onValueChange={setBatchStatus}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent>{payoutBatchStatuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsReleaseStatusFilter ? (
                    <FilterField label="Release Status">
                      <Select value={releaseStatus} onValueChange={setReleaseStatus}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent>{payoutReleaseStatuses.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}

                  {supportsPaymentModeFilter ? (
                    <FilterField label="Payment Mode">
                      <Select value={paymentMode} onValueChange={setPaymentMode}>
                        <SelectTrigger className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium"><SelectValue /></SelectTrigger>
                        <SelectContent>{payoutPaymentModes.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </FilterField>
                  ) : null}
                </div>
              </section>

              {supportsDateFilters ? (
                <section className="border-t border-stone-100 pt-5">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-stone-800">Date Range</h3>
                      <p className="mt-0.5 text-xs text-stone-500">Limit the report to a specific date range.</p>
                    </div>
                  </div>

                  <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
                    <FilterField label="Date From">
                      <Input
                        type="date"
                        value={dateFrom}
                        onChange={(event) => setDateFrom(event.target.value)}
                        className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium"
                      />
                    </FilterField>
                    <FilterField label="Date To">
                      <Input
                        type="date"
                        value={dateTo}
                        onChange={(event) => setDateTo(event.target.value)}
                        className="h-11 w-full min-w-0 rounded-xl border-stone-200 bg-stone-50/50 text-sm font-medium"
                      />
                    </FilterField>
                  </div>
                  {isDateRangeInvalid ? (
                    <p className="mt-2 text-xs font-medium text-red-600">
                      Date From cannot be later than Date To.
                    </p>
                  ) : null}
                </section>
              ) : null}

              <div className="flex flex-col gap-2 border-t border-stone-100 pt-5 sm:flex-row sm:flex-wrap">
                <Button
                  variant="outline"
                  className="report-action-button h-11 w-full rounded-xl text-sm font-semibold sm:w-auto"
                  style={{ borderColor: theme.border, color: theme.base }}
                  disabled={previewLoading || isDateRangeInvalid}
                  onClick={handlePreviewReport}
                >
                  {previewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Eye className="mr-2 h-4 w-4" />}
                  Preview
                </Button>

                <Button
                  className="report-action-button h-11 w-full min-w-0 rounded-xl border-none text-sm font-semibold text-white sm:min-w-[190px] sm:flex-1"
                  style={{ background: theme.base }}
                  disabled={isSelectedReportExportLocked || isDateRangeInvalid}
                  onClick={handleGenerateReport}
                >
                  {selectedGeneratingFormat === (isScholarCountReport ? 'pdf' : 'xlsx') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {isScholarCountReport ? 'Download PDF' : 'Download Excel'}
                </Button>

                {!isScholarCountReport ? (
                  <Button
                    variant="outline"
                    className="report-action-button h-11 w-full rounded-xl text-sm font-semibold sm:w-auto"
                    style={{ borderColor: theme.border, color: theme.base }}
                    disabled={isSelectedReportExportLocked || isDateRangeInvalid}
                    onClick={() => handleDownloadByFormat('csv')}
                  >
                    {selectedGeneratingFormat === 'csv' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Download CSV
                  </Button>
                ) : null}

                <Button
                  variant="outline"
                  className="report-action-button h-11 w-full rounded-xl text-sm font-semibold sm:w-auto"
                  style={{ borderColor: theme.border, color: theme.base }}
                  disabled={previewLoading}
                  onClick={resetFilters}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {hasPreviewed ? (
        <Card className="min-w-0 overflow-hidden border-stone-200 bg-white shadow-none">
          <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-4">
            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-stone-800">Report Preview</h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  {previewRows.length > 0
                    ? isScholarCountReport
                      ? `${previewTotal} active scholar(s) across ${previewRows.length} ${benefactorId === 'all' ? 'benefactor(s)' : 'program(s)'}.`
                      : `Showing ${previewRows.length} of ${previewTotal} matching records.`
                    : 'No matching records found for the selected filters.'}
                </p>
              </div>
              {previewRows.length > 0 ? (
                <span className="w-fit rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium text-stone-500">
                  Preview only
                </span>
              ) : null}
            </div>
          </div>

          <CardContent className="p-0">
            {isScholarCountReport && previewRows.length > 0 ? (
              <div className="border-b border-stone-100 p-4">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-stone-900">Scholar Count Chart</p>
                  <p className="text-xs text-stone-500">
                    {benefactorId === 'all'
                      ? 'Counting active scholars for each benefactor.'
                      : 'Counting active scholars by program for the selected benefactor.'}
                  </p>
                </div>
                <div className="max-h-[520px] overflow-auto">
                  <div style={{ height: `${scholarCountChartHeight}px`, minWidth: '560px' }}>
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={1}>
                      <BarChart
                        data={scholarCountChartData}
                        layout="vertical"
                        margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 12 }} interval={0} />
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
                <p className="text-sm font-medium text-stone-700">No records to preview</p>
                <p className="mt-1 max-w-lg text-xs text-stone-500">
                  Try adjusting the selected report filters.
                </p>
              </div>
            ) : isScholarCountReport ? null : (
              <div className="max-h-[420px] overflow-auto">
                <table className="min-w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-stone-50 text-stone-500">
                    <tr>
                      {previewColumns.map((key) => (
                        <th key={key} className="whitespace-nowrap border-b border-stone-100 px-4 py-3 font-semibold">
                          {formatHeader(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, index) => (
                      <tr key={index} className="border-t border-stone-100 hover:bg-stone-50/70">
                        {previewColumns.map((key) => (
                          <td key={key} className="whitespace-nowrap px-4 py-3 text-stone-600">
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
      ) : null}

      <Card className="overflow-hidden border-stone-200 bg-white shadow-none">
        <div className="border-b border-stone-100 bg-stone-50/70 px-4 py-4">
          <h2 className="text-sm font-semibold text-stone-800">Report Notes</h2>
          <p className="mt-0.5 text-xs text-stone-500">
            Recent report history can be added later by storing generated report logs.
          </p>
        </div>
        <CardContent className="p-5 text-sm text-stone-500">
          Reports are generated directly from applications, active scholars,
          payout batches, endorsement records, and RO compliance data based on the filters above.
        </CardContent>
      </Card>
    </div>
  );
}
