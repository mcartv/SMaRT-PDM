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
  Table2,
  Eye,
} from 'lucide-react';
import * as XLSX from 'xlsx';

import { buildApiUrl } from '@/api';

const API_BASE = buildApiUrl('/api');
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

const EXCEL_HEADERS_FALLBACK = [
  'Student Number',
  'Course',
  'Year Level',
  'Surname',
  'First Name',
  'Middle Name',
  'Suffix',
  'Sex',
  'Height (m)',
  'Weight (kg)',
  'Nationality',
  'Religion',
  'Date of Birth',
  'Age',
  'Place of Birth',
  'Civil Status',
  'Personal Number',
  'Email Address',
  'Present Address',
  'Present ZIP Code',
  'Permanent Address',
  'Permanent ZIP Code',
  'Emergency Contact Person',
  'Relationship',
  'Emergency Address',
  'Emergency Contact No.',
  'Father Name',
  'Father Address',
  'Father Birthday',
  'Father Age',
  'Father Contact',
  'Father Educational Attainment',
  'Father Occupation',
  'Father Living/Vital Status',
  'Mother Name',
  'Mother Address',
  'Mother Birthday',
  'Mother Age',
  'Mother Contact',
  'Mother Educational Attainment',
  'Mother Occupation',
  'Mother Living/Vital Status',
  'Elem School',
  'Elem Inclusive Year',
  'Elem Address',
  'Elem LRN',
  'HS Old Curriculum School',
  'HS Old Curriculum Year',
  'HS Old Curriculum Address',
  'HS Old Curriculum LRN',
  'Grade 7-10 School',
  'Grade 7-10 Year',
  'Grade 7-10 Address',
  'Grade 7-10 LRN',
  'Grade 11-12 School',
  'Grade 11-12 Year',
  'Grade 11-12 Address',
  'Grade 11-12 LRN',
  'ALS Graduate',
  'Previous College',
  'Previous Course',
  'Previous Inclusive Year',
  'Previous Address',
];

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

function normalizeHeaderKey(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
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

function parseExcelDate(value) {
  if (value == null || value === '') return '';
  return String(value);
}

function buildBackendRowForExcelShape(row) {
  return {
    'Student Number': row.student_number || '',
    'Course': row.academic_course?.course_code || '',
    'Year Level': row.year_level || '',
    'Surname': row.last_name || '',
    'First Name': row.given_name || '',
    'Middle Name': row.middle_name || '',
    'Suffix': row.suffix || '',
    'Sex': row.sex || '',
    'Height (m)': row.height_m || '',
    'Weight (kg)': row.weight_kg || '',
    'Nationality': row.nationality || '',
    'Religion': row.religion || '',
    'Date of Birth': parseExcelDate(row.date_of_birth),
    'Age': row.age || '',
    'Place of Birth': row.place_of_birth || '',
    'Civil Status': row.civil_status || '',
    'Personal Number': row.personal_number || row.contact_number || '',
    'Email Address': row.email || '',
    'Present Address': row.present_address || row.address || '',
    'Present ZIP Code': row.present_zip_code || '',
    'Permanent Address': row.permanent_address || '',
    'Permanent ZIP Code': row.permanent_zip_code || '',
    'Emergency Contact Person': row.emergency_contact_person || '',
    'Relationship': row.relationship || '',
    'Emergency Address': row.emergency_address || '',
    'Emergency Contact No.': row.emergency_contact_no || '',
    'Father Name': row.father_name || '',
    'Father Address': row.father_address || '',
    'Father Birthday': parseExcelDate(row.father_birthday),
    'Father Age': row.father_age || '',
    'Father Contact': row.father_contact || '',
    'Father Educational Attainment': row.father_educational_attainment || '',
    'Father Occupation': row.father_occupation || '',
    'Father Living/Vital Status': row.father_living_vital_status || '',
    'Mother Name': row.mother_name || '',
    'Mother Address': row.mother_address || '',
    'Mother Birthday': parseExcelDate(row.mother_birthday),
    'Mother Age': row.mother_age || '',
    'Mother Contact': row.mother_contact || '',
    'Mother Educational Attainment': row.mother_educational_attainment || '',
    'Mother Occupation': row.mother_occupation || '',
    'Mother Living/Vital Status': row.mother_living_vital_status || '',
    'Elem School': row.elem_school || '',
    'Elem Inclusive Year': row.elem_inclusive_year || '',
    'Elem Address': row.elem_address || '',
    'Elem LRN': row.elem_lrn || '',
    'HS Old Curriculum School': row.hs_old_curriculum_school || '',
    'HS Old Curriculum Year': row.hs_old_curriculum_year || '',
    'HS Old Curriculum Address': row.hs_old_curriculum_address || '',
    'HS Old Curriculum LRN': row.hs_old_curriculum_lrn || '',
    'Grade 7-10 School': row.grade_7_10_school || '',
    'Grade 7-10 Year': row.grade_7_10_year || '',
    'Grade 7-10 Address': row.grade_7_10_address || '',
    'Grade 7-10 LRN': row.grade_7_10_lrn || '',
    'Grade 11-12 School': row.grade_11_12_school || '',
    'Grade 11-12 Year': row.grade_11_12_year || '',
    'Grade 11-12 Address': row.grade_11_12_address || '',
    'Grade 11-12 LRN': row.grade_11_12_lrn || '',
    'ALS Graduate': row.als_graduate || '',
    'Previous College': row.previous_college || '',
    'Previous Course': row.previous_course || '',
    'Previous Inclusive Year': row.previous_inclusive_year || '',
    'Previous Address': row.previous_address || '',
  };
}

export default function StudentRegistryPanel() {
  const inputRef = useRef(null);

  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [registry, setRegistry] = useState([]);
  const [total, setTotal] = useState(0);

  const [excelHeaders, setExcelHeaders] = useState(EXCEL_HEADERS_FALLBACK);
  const [excelRows, setExcelRows] = useState([]);
  const [excelSheetName, setExcelSheetName] = useState('Student Records');
  const [tableMode, setTableMode] = useState('excel'); // excel | imported

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
      const res = await fetch(`${API_BASE}/student-registry?limit=500`, {
        headers: getAuthHeaders(),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || 'Failed to load registry');

      const items = Array.isArray(data.items) ? data.items : [];
      setRegistry(items);
      setTotal(Number(data.total || items.length || 0));
    } catch (err) {
      setError(err.message || 'Failed to load registry');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRegistry();
  }, []);

  const parseWorkbookPreview = async (selectedFile) => {
    const buffer = await selectedFile.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];

    if (!sheet) {
      throw new Error('No worksheet found in the uploaded file.');
    }

    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: false,
    });

    if (!rows.length) {
      throw new Error('The uploaded sheet is empty.');
    }

    const headers = rows[0]
      .map((value) => String(value || '').trim())
      .filter((value) => value !== '');

    const body = rows
      .slice(1)
      .filter((row) => Array.isArray(row) && row.some((cell) => String(cell || '').trim() !== ''))
      .map((row) => {
        const obj = {};
        headers.forEach((header, idx) => {
          obj[header] = row[idx] ?? '';
        });
        return obj;
      });

    setExcelSheetName(firstSheetName);
    setExcelHeaders(headers.length ? headers : EXCEL_HEADERS_FALLBACK);
    setExcelRows(body);
    setTableMode('excel');
  };

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;

    const valid = ACCEPTED_EXTENSIONS.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!valid) {
      setError('Only .xlsx, .xls, and .csv files are allowed.');
      return;
    }

    try {
      setError('');
      setFile(selectedFile);
      await parseWorkbookPreview(selectedFile);
    } catch (err) {
      setError(err.message || 'Failed to read the uploaded workbook.');
    }
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

      await loadRegistry();

      if (excelRows.length > 0) {
        setTableMode('excel');
      } else {
        setTableMode('imported');
      }
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

  const importedRowsAsExcelShape = useMemo(() => {
    return registry.map(buildBackendRowForExcelShape);
  }, [registry]);

  const currentHeaders = useMemo(() => {
    if (tableMode === 'excel' && excelHeaders.length) return excelHeaders;
    return EXCEL_HEADERS_FALLBACK;
  }, [tableMode, excelHeaders]);

  const currentRows = useMemo(() => {
    return tableMode === 'excel' ? excelRows : importedRowsAsExcelShape;
  }, [tableMode, excelRows, importedRowsAsExcelShape]);

  const courseOptions = useMemo(() => {
    const courseHeader = currentHeaders.find(
      (h) => normalizeHeaderKey(h) === 'course'
    );

    if (!courseHeader) return [];

    const unique = Array.from(
      new Set(
        currentRows
          .map((row) => row[courseHeader])
          .filter((value) => String(value || '').trim() !== '')
          .map((value) => String(value).trim())
      )
    );

    return unique.sort((a, b) => a.localeCompare(b));
  }, [currentHeaders, currentRows]);

  const yearOptions = useMemo(() => {
    const yearHeader = currentHeaders.find(
      (h) => normalizeHeaderKey(h) === 'year level'
    );

    if (!yearHeader) return [];

    const unique = Array.from(
      new Set(
        currentRows
          .map((row) => row[yearHeader])
          .filter((value) => String(value || '').trim() !== '')
          .map((value) => String(value).trim())
      )
    );

    return unique.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [currentHeaders, currentRows]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);

    const studentNumberHeader = currentHeaders.find(
      (h) => normalizeHeaderKey(h) === 'student number'
    );
    const surnameHeader = currentHeaders.find(
      (h) => normalizeHeaderKey(h) === 'surname'
    );
    const firstNameHeader = currentHeaders.find(
      (h) => normalizeHeaderKey(h) === 'first name'
    );
    const middleNameHeader = currentHeaders.find(
      (h) => normalizeHeaderKey(h) === 'middle name'
    );
    const courseHeader = currentHeaders.find(
      (h) => normalizeHeaderKey(h) === 'course'
    );
    const yearHeader = currentHeaders.find(
      (h) => normalizeHeaderKey(h) === 'year level'
    );

    return currentRows.filter((row) => {
      const fullName = normalizeText(
        [
          row[surnameHeader] || '',
          row[firstNameHeader] || '',
          row[middleNameHeader] || '',
        ].join(' ')
      );

      const studentNumber = normalizeText(row[studentNumberHeader] || '');
      const courseCode = String(row[courseHeader] || '').trim();
      const yearLevel = String(row[yearHeader] || '').trim();

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
  }, [currentRows, currentHeaders, search, courseFilter, yearFilter]);

  const visibleRows = useMemo(() => filteredRows.slice(0, 200), [filteredRows]);

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
                  setExcelRows([]);
                  setExcelHeaders(EXCEL_HEADERS_FALLBACK);
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
              <a href="/templates/student-registry-import-template.xlsx" download>
                <Download className="mr-1.5 h-4 w-4" />
                Template
              </a>
            </Button>
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <FileUp className="mt-0.5 h-4 w-4 text-stone-400" />
              <p className="text-xs leading-6 text-stone-500">
                The table preview follows the actual Excel sheet columns. After import, the same full table remains visible in this session.
              </p>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden border-stone-200 shadow-none xl:col-span-8">
          <div className="flex flex-col gap-3 border-b bg-white px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
              <span>
                {tableMode === 'excel'
                  ? `${excelSheetName} • ${currentRows.length} rows`
                  : `${total} imported records`}
              </span>

              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="h-4 w-4" />
                  {currentHeaders.length} columns
                </span>

                <div className="inline-flex rounded-lg border border-stone-200 p-1">
                  <button
                    type="button"
                    onClick={() => setTableMode('excel')}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium ${tableMode === 'excel'
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-500 hover:text-stone-700'
                      }`}
                    disabled={excelRows.length === 0}
                  >
                    <Table2 className="h-3.5 w-3.5" />
                    Excel
                  </button>

                  <button
                    type="button"
                    onClick={() => setTableMode('imported')}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium ${tableMode === 'imported'
                        ? 'bg-stone-900 text-white'
                        : 'text-stone-500 hover:text-stone-700'
                      }`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    Imported
                  </button>
                </div>
              </div>
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

          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-max text-xs">
              <thead className="sticky top-0 z-10 bg-stone-50 text-stone-500">
                <tr>
                  <th className="whitespace-nowrap border-b px-3 py-2 text-left font-semibold">
                    #
                  </th>
                  {currentHeaders.map((header) => (
                    <th
                      key={header}
                      className="whitespace-nowrap border-b px-3 py-2 text-left font-semibold"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={currentHeaders.length + 1}
                      className="py-12 text-center text-stone-400"
                    >
                      {isLoading ? 'Loading...' : 'No data found'}
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row, idx) => (
                    <tr key={`${tableMode}-${idx}`} className="border-t">
                      <td className="whitespace-nowrap px-3 py-2 text-stone-500">
                        {idx + 1}
                      </td>
                      {currentHeaders.map((header) => (
                        <td
                          key={`${idx}-${header}`}
                          className="whitespace-nowrap px-3 py-2 text-stone-700"
                        >
                          {String(row[header] ?? '') || '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="border-t bg-stone-50 px-4 py-2 text-[11px] text-stone-500">
            Showing {visibleRows.length} of {filteredRows.length} filtered rows
            {filteredRows.length < currentRows.length
              ? ` • ${currentRows.length} total rows in current source`
              : ''}
          </div>
        </Card>
      </div>
    </div>
  );
}