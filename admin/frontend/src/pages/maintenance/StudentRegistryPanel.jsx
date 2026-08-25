import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Table2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileUp,
} from 'lucide-react';
import ExcelJS from 'exceljs';

import { buildApiUrl } from '@/api';
import { useSocketEvent } from '@/hooks/useSocket';

const API_BASE = buildApiUrl('/api');
const ACCEPTED_EXTENSIONS = ['.xlsx', '.csv'];
const PAGE_SIZE = 50;

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
  const token = sessionStorage.getItem('adminToken');
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

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells;
}

function parseCsvRows(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    const next = normalized[i + 1];

    if (char === '"') {
      current += char;

      if (inQuotes && next === '"') {
        current += next;
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (char === '\n' && !inQuotes) {
      if (current.trim() !== '') {
        rows.push(parseCsvLine(current));
      }

      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim() !== '') {
    rows.push(parseCsvLine(current));
  }

  return rows;
}

function parseExcelDate(value) {
  if (value == null || value === '') return '';
  return String(value);
}

function buildBackendRowForExcelShape(row) {
  return {
    'Student Number': row.student_number || '',
    Course: row.academic_course?.course_code || row.course_code || '',
    'Year Level': row.year_level || '',
    Surname: row.last_name || '',
    'First Name': row.given_name || '',
    'Middle Name': row.middle_name || '',
    Suffix: row.suffix || '',
    Sex: row.sex || row.sex_at_birth || '',
    'Height (m)': row.height_m || '',
    'Weight (kg)': row.weight_kg || '',
    Nationality: row.nationality || '',
    Religion: row.religion || '',
    'Date of Birth': parseExcelDate(row.date_of_birth),
    Age: row.age || '',
    'Place of Birth': row.place_of_birth || '',
    'Civil Status': row.civil_status || '',
    'Personal Number': row.personal_number || row.contact_number || row.phone_number || '',
    'Email Address': row.email || row.email_address || '',
    'Present Address': row.present_address || row.address || '',
    'Present ZIP Code': row.present_zip_code || '',
    'Permanent Address': row.permanent_address || '',
    'Permanent ZIP Code': row.permanent_zip_code || '',
    'Emergency Contact Person': row.emergency_contact_person || '',
    Relationship: row.relationship || '',
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
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
          <h3 className="text-sm font-semibold text-stone-800">
            Filter Registry
          </h3>

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

function ImportRegistryModal({
  open,
  onClose,
  file,
  setFile,
  isDragging,
  setIsDragging,
  isImporting,
  onFileSelect,
  onImport,
  onClearFile,
}) {
  const inputRef = useRef(null);

  if (!open) return null;

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const droppedFile = event.dataTransfer?.files?.[0];
    if (droppedFile) onFileSelect(droppedFile);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-xl overflow-hidden border-stone-200 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-5 py-4">
          <h3 className="text-sm font-semibold text-stone-800">
            Import Student Registry
          </h3>

          <button
            type="button"
            onClick={onClose}
            disabled={isImporting}
            className="rounded-md p-1.5 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition ${isDragging
                ? 'border-stone-500 bg-stone-50'
                : 'border-stone-300 bg-stone-50/70 hover:bg-stone-50'
              }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(event) => onFileSelect(event.target.files?.[0])}
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
              Accepted: {ACCEPTED_EXTENSIONS.join(', ')}
            </p>
          </div>

          {file && (
            <div className="flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2">
              <div className="min-w-0 text-xs">
                <p className="truncate font-medium text-stone-700">
                  {file.name}
                </p>
                <span className="block text-stone-400">
                  {formatFileSize(file.size)}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClearFile();
                  if (inputRef.current) inputRef.current.value = '';
                }}
                disabled={isImporting}
                className="rounded-md p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
            <div className="flex items-start gap-2">
              <FileUp className="mt-0.5 h-4 w-4 text-stone-400" />
              <p className="text-xs leading-6 text-stone-500">
                Upload a `.xlsx` or `.csv` registrar file. The selected file will be previewed before import.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-stone-100 bg-stone-50 px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isImporting}
            className="h-8 rounded-lg border-stone-200 text-xs"
          >
            Cancel
          </Button>

          <Button
            onClick={onImport}
            disabled={!file || isImporting}
            className="h-8 rounded-lg text-xs"
          >
            {isImporting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isImporting ? 'Importing' : 'Import'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function PaginationBar({ page, totalPages, totalRows, onPrev, onNext, onGoToPage }) {
  return (
    <div className="flex flex-col gap-3 border-t bg-stone-50 px-4 py-3 text-[11px] text-stone-500 md:flex-row md:items-center md:justify-between">
      <div>
        Page {page} of {totalPages} • {totalRows} rows
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-8 border-stone-200 px-2"
          onClick={onPrev}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <span className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700">
          {page}
        </span>

        <Button
          type="button"
          variant="outline"
          className="h-8 border-stone-200 px-2"
          onClick={onNext}
          disabled={page >= totalPages}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        <Select value={String(page)} onValueChange={(value) => onGoToPage(Number(value))}>
          <SelectTrigger className="h-8 w-[110px] border-stone-200 text-xs">
            <SelectValue placeholder="Go to page" />
          </SelectTrigger>

          <SelectContent>
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((p) => (
              <SelectItem key={p} value={String(p)}>
                Page {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export default function StudentRegistryPanel() {
  const [file, setFile] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState('');
  const [registry, setRegistry] = useState([]);
  const [total, setTotal] = useState(0);

  const [excelHeaders, setExcelHeaders] = useState(EXCEL_HEADERS_FALLBACK);
  const [excelRows, setExcelRows] = useState([]);
  const [excelSheetName, setExcelSheetName] = useState('Student Records');
  const [tableMode, setTableMode] = useState('imported');

  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  const [filterOpen, setFilterOpen] = useState(false);
  const [draftCourseFilter, setDraftCourseFilter] = useState('all');
  const [draftYearFilter, setDraftYearFilter] = useState('all');

  const [page, setPage] = useState(1);

  const loadRegistry = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_BASE}/student-registry?limit=5000&offset=0`, {
        headers: getAuthHeaders(),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to load registry');
      }

      const items = Array.isArray(data.items) ? data.items : [];

      setRegistry(items);
      setTotal(Number(data.total || items.length || 0));
    } catch (err) {
      setError(err.message || 'Failed to load registry');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  useSocketEvent(
    'maintenance:updated',
    (payload = {}) => {
      if (!payload?.module || payload.module === 'student_registry') {
        loadRegistry();
      }
    },
    [loadRegistry]
  );

  const parseWorkbookPreview = async (selectedFile) => {
    const lowerName = selectedFile.name.toLowerCase();
    let rows = [];

    if (lowerName.endsWith('.csv')) {
      const text = await selectedFile.text();
      rows = parseCsvRows(text);
    } else if (lowerName.endsWith('.xlsx')) {
      const buffer = await selectedFile.arrayBuffer();
      const workbook = new ExcelJS.Workbook();

      await workbook.xlsx.load(buffer);

      const worksheet = workbook.worksheets[0];

      if (!worksheet) {
        throw new Error('No worksheet found in the uploaded file.');
      }

      worksheet.eachRow({ includeEmpty: false }, (row) => {
        rows.push(row.values.slice(1).map((value) => (value == null ? '' : String(value))));
      });
    } else {
      throw new Error('Only .xlsx and .csv files are allowed.');
    }

    if (!rows.length) {
      throw new Error('The uploaded file is empty.');
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

    setExcelSheetName(selectedFile.name);
    setExcelHeaders(headers.length ? headers : EXCEL_HEADERS_FALLBACK);
    setExcelRows(body);
    setTableMode('excel');
    setPage(1);
  };

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;

    const valid = ACCEPTED_EXTENSIONS.some((ext) =>
      selectedFile.name.toLowerCase().endsWith(ext)
    );

    if (!valid) {
      setError('Only .xlsx and .csv files are allowed.');
      return;
    }

    try {
      setError('');
      setFile(selectedFile);
      await parseWorkbookPreview(selectedFile);
    } catch (err) {
      setError(err.message || 'Failed to read the uploaded file.');
    }
  };

  const clearSelectedFile = () => {
    setFile(null);
    setExcelRows([]);
    setExcelHeaders(EXCEL_HEADERS_FALLBACK);
    setExcelSheetName('Student Records');
    setTableMode('imported');
    setPage(1);
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

      if (!res.ok) {
        throw new Error(data.error || data.message || 'Import failed');
      }

      await loadRegistry();

      setTableMode('imported');
      setImportOpen(false);
      setPage(1);
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
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
      (header) => normalizeHeaderKey(header) === 'course'
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
      (header) => normalizeHeaderKey(header) === 'year level'
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
      (header) => normalizeHeaderKey(header) === 'student number'
    );
    const surnameHeader = currentHeaders.find(
      (header) => normalizeHeaderKey(header) === 'surname'
    );
    const firstNameHeader = currentHeaders.find(
      (header) => normalizeHeaderKey(header) === 'first name'
    );
    const middleNameHeader = currentHeaders.find(
      (header) => normalizeHeaderKey(header) === 'middle name'
    );
    const courseHeader = currentHeaders.find(
      (header) => normalizeHeaderKey(header) === 'course'
    );
    const yearHeader = currentHeaders.find(
      (header) => normalizeHeaderKey(header) === 'year level'
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

  useEffect(() => {
    setPage(1);
  }, [search, courseFilter, yearFilter, tableMode, excelRows.length, registry.length]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const visibleRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, page]);

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
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
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

      <ImportRegistryModal
        open={importOpen}
        onClose={() => {
          if (!isImporting) setImportOpen(false);
        }}
        file={file}
        setFile={setFile}
        isDragging={isDragging}
        setIsDragging={setIsDragging}
        isImporting={isImporting}
        onFileSelect={handleFileSelect}
        onImport={handleImport}
        onClearFile={clearSelectedFile}
      />

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="mb-4 rounded-xl border border-stone-200 bg-white px-4 py-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                Student Registry Records
              </p>
              <p className="mt-1 text-sm font-semibold text-stone-900">
                {total} imported records · {currentRows.length} current rows
              </p>
            </div>

            <div className="relative w-full md:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search student number or name..."
                className="h-9 rounded-lg border-stone-200 bg-white pl-9 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-stone-100 pt-3 md:flex-row md:items-center md:justify-between">
            <div className="inline-flex w-fit rounded-lg border border-stone-200 p-1">
              <button
                type="button"
                onClick={() => {
                  setTableMode('excel');
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium ${tableMode === 'excel'
                    ? 'bg-[#7c4a2e] text-white'
                    : 'text-stone-500 hover:text-stone-700'
                  }`}
                disabled={excelRows.length === 0}
              >
                <Table2 className="h-3.5 w-3.5" />
                Preview ({excelRows.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  setTableMode('imported');
                  setPage(1);
                }}
                className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium ${tableMode === 'imported'
                    ? 'bg-[#7c4a2e] text-white'
                    : 'text-stone-500 hover:text-stone-700'
                  }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Imported ({total})
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openFilterModal}
                className="h-8 rounded-lg border-stone-200 text-xs"
              >
                <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
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
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    clearFilters();
                  }}
                  className="h-8 rounded-lg border-stone-200 text-xs"
                >
                  Reset
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={loadRegistry}
                className="h-8 rounded-lg border-stone-200 text-xs"
              >
                {isLoading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="mr-1.5 h-3.5 w-3.5" />
                )}
                Refresh
              </Button>

              <Button
                size="sm"
                onClick={() => setImportOpen(true)}
                className="h-8 rounded-lg text-xs"
              >
                <Upload className="mr-1.5 h-3.5 w-3.5" />
                Import
              </Button>

              <Button asChild variant="outline" size="sm" className="h-8 rounded-lg border-stone-200 text-xs">
                <a href="/templates/student-registry-import-template.csv" download>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Template
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-stone-200 shadow-none">
        <div className="flex items-center justify-between gap-2 border-b bg-white px-4 py-3 text-xs text-stone-500">
          <span>
            {tableMode === 'excel'
              ? `${excelSheetName} • ${currentRows.length} rows`
              : `${total} imported records`}
          </span>

          <span className="flex items-center gap-1">
            <FileSpreadsheet className="h-4 w-4" />
            {currentHeaders.length} columns
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
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
              {isLoading ? (
                <tr>
                  <td
                    colSpan={currentHeaders.length + 1}
                    className="py-20 text-center text-stone-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading registry records...
                    </div>
                  </td>
                </tr>
              ) : visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={currentHeaders.length + 1}
                    className="py-20 text-center text-stone-400"
                  >
                    No data found
                  </td>
                </tr>
              ) : (
                visibleRows.map((row, idx) => {
                  const absoluteIndex = (page - 1) * PAGE_SIZE + idx + 1;

                  return (
                    <tr key={`${tableMode}-${absoluteIndex}`} className="border-t">
                      <td className="whitespace-nowrap px-3 py-2 text-stone-500">
                        {absoluteIndex}
                      </td>

                      {currentHeaders.map((header) => (
                        <td
                          key={`${absoluteIndex}-${header}`}
                          className="whitespace-nowrap px-3 py-2 text-stone-700"
                        >
                          {String(row[header] ?? '') || '-'}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <PaginationBar
          page={page}
          totalPages={totalPages}
          totalRows={filteredRows.length}
          onPrev={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
          onNext={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
          onGoToPage={(nextPage) => setPage(Math.min(Math.max(1, nextPage), totalPages))}
        />
      </Card>
    </div>
  );
}