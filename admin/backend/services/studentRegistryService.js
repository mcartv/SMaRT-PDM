const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const supabase = require('../config/supabase');

const IMPORT_BATCH_TABLE = 'student_import_batches';
const IMPORT_ROW_TABLE = 'student_import_rows';
const MASTER_TABLE = 'student_master_records';
const REGISTRY_VIEW = 'student_registry';
const COURSE_TABLE = 'academic_course';

function buildError(message, statusCode = 500, details = null) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (details) err.details = details;
  return err;
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeLookupValue(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeYearLevel(value) {
  const text = normalizeText(value);
  if (!text) return null;
  const match = text.match(/\d+/);
  if (!match) return null;
  const n = Number.parseInt(match[0], 10);
  if (Number.isNaN(n) || n < 1 || n > 6) return null;
  return n;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const text = normalizeLookupValue(value);
  if (!text) return false;
  return ['yes', 'y', 'true', '1', 'checked', 'x'].includes(text);
}

function parseInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  const match = normalizeText(value).match(/\d+/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseExcelDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const parsed = new Date(excelEpoch + value * 24 * 60 * 60 * 1000);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
  }

  const text = normalizeText(value);
  if (!text) return null;

  const slashMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, '0');
    const day = slashMatch[2].padStart(2, '0');
    const rawYear = slashMatch[3];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function decodeXml(value = '') {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function columnIndexFromRef(ref = '') {
  const letters = String(ref).match(/[A-Z]+/)?.[0] || '';
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return Math.max(index - 1, 0);
}

async function readXlsxRowsWithZipFallback(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const sheetFile = zip.file('xl/worksheets/sheet1.xml');
  if (!sheetFile) return [];

  const sheetXml = await sheetFile.async('string');
  const rows = [];
  const rowMatches = sheetXml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g);

  for (const rowMatch of rowMatches) {
    const values = [];
    const cellMatches = rowMatch[2].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g);

    for (const cellMatch of cellMatches) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([^"]+)"/)?.[1] || '';
      const index = columnIndexFromRef(ref);
      const inline = body.match(/<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>[\s\S]*?<\/is>/);
      const rawValue = inline
        ? decodeXml(inline[1])
        : decodeXml(body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1] || '');

      values[index] = rawValue;
    }

    if (values.some((value) => normalizeText(value))) {
      rows.push(values);
    }
  }

  return rows;
}

async function readWorkbookRows(file) {
  const fileName = String(file.originalname || '').toLowerCase();

  if (fileName.endsWith('.csv')) {
    const text = file.buffer.toString('utf8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    return lines.map((line) => line.split(','));
  }

  if (fileName.endsWith('.xls')) {
    throw buildError(
      'Old .xls files are not supported here. Please save as .xlsx or .csv.',
      400
    );
  }

  if (!fileName.endsWith('.xlsx')) {
    throw buildError('Unsupported file type.', 400);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return readXlsxRowsWithZipFallback(file.buffer);
  }

  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    rows.push(row.values.slice(1));
  });

  return rows.length ? rows : readXlsxRowsWithZipFallback(file.buffer);
}

function mapHeaders(headerRow) {
  const map = new Map();

  headerRow.forEach((rawHeader, index) => {
    const header = normalizeLookupValue(rawHeader);

    if (
      ['student number', 'student_number', 'student no', 'pdm id', 'pdm_id'].includes(header)
    ) {
      map.set(index, 'student_number');
    } else if (
      ['surname', 'last name', 'lastname', 'last_name'].includes(header)
    ) {
      map.set(index, 'last_name');
    } else if (
      ['first name', 'firstname', 'first_name', 'given name', 'given_name'].includes(header)
    ) {
      map.set(index, 'given_name');
    } else if (
      ['middle name', 'middlename', 'middle_name'].includes(header)
    ) {
      map.set(index, 'middle_name');
    } else if (
      ['course', 'course code', 'degree program', 'program'].includes(header)
    ) {
      map.set(index, 'degree_program');
    } else if (
      ['year level', 'year_level', 'year'].includes(header)
    ) {
      map.set(index, 'year_level');
    } else if (
      ['sex', 'sex at birth', 'sex_at_birth'].includes(header)
    ) {
      map.set(index, 'sex_at_birth');
    } else if (
      ['email', 'email address', 'email_address'].includes(header)
    ) {
      map.set(index, 'email_address');
    } else if (
      ['phone number', 'contact number', 'mobile number', 'phone_number'].includes(header)
    ) {
      map.set(index, 'phone_number');
    } else if (
      ['lrn', 'learners reference number', 'learners_reference_number'].includes(header)
    ) {
      map.set(index, 'learners_reference_number');
    } else if (
      ['sequence', 'sequence no', 'sequence number', 'sequence_number'].includes(header)
    ) {
      map.set(index, 'sequence_number');
    } else if (
      ['personal number', 'contact number', 'mobile number', 'phone number'].includes(header)
    ) {
      map.set(index, 'phone_number');
    } else if (
      ['religion'].includes(header)
    ) {
      map.set(index, 'religion');
    } else if (
      ['date of birth', 'birthday', 'birthdate'].includes(header)
    ) {
      map.set(index, 'date_of_birth');
    } else if (
      ['age'].includes(header)
    ) {
      map.set(index, 'age');
    } else if (
      ['place of birth', 'birthplace'].includes(header)
    ) {
      map.set(index, 'place_of_birth');
    } else if (
      ['civil status'].includes(header)
    ) {
      map.set(index, 'civil_status');
    } else if (
      ['sibling last name'].includes(header)
    ) {
      map.set(index, 'sibling_last_name');
    } else if (
      ['sibling first name'].includes(header)
    ) {
      map.set(index, 'sibling_first_name');
    } else if (
      ['sibling middle name'].includes(header)
    ) {
      map.set(index, 'sibling_middle_name');
    } else if (
      ['sibling mobile no', 'sibling mobile number', 'sibling contact'].includes(header)
    ) {
      map.set(index, 'sibling_mobile_no');
    } else if (
      ['financial support parents', 'financial support parent'].includes(header)
    ) {
      map.set(index, 'financial_support_parents');
    } else if (
      ['financial support scholarship'].includes(header)
    ) {
      map.set(index, 'financial_support_scholarship');
    } else if (
      ['financial support loan'].includes(header)
    ) {
      map.set(index, 'financial_support_loan');
    } else if (
      ['financial support other'].includes(header)
    ) {
      map.set(index, 'financial_support_other');
    } else if (
      ['have you been a scholar', 'has been scholar'].includes(header)
    ) {
      map.set(index, 'has_been_scholar');
    } else if (
      [
        'have you ever been subject to disciplinary action from any school or institution attended',
        'has disciplinary action',
        'disciplinary action',
      ].includes(header)
    ) {
      map.set(index, 'has_disciplinary_action');
    }
  });

  return map;
}

function parseRows(rows) {
  if (!rows.length) {
    return [];
  }

  const headerRow = rows[0];
  const headerMap = mapHeaders(headerRow);

  const records = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i];
    const obj = {
      row_number: i + 1,
      raw_payload: {},
    };

    row.forEach((value, index) => {
      const key = headerMap.get(index);
      if (key) obj[key] = value;
      obj.raw_payload[String(headerRow[index] || `col_${index + 1}`)] = value;
    });

    const studentNumber = normalizeText(obj.student_number).toUpperCase();
    const givenName = normalizeText(obj.given_name);
    const lastName = normalizeText(obj.last_name);

    if (!studentNumber && !givenName && !lastName) {
      continue;
    }

    if (!studentNumber || !givenName || !lastName) {
      continue;
    }

    records.push({
      row_number: obj.row_number,
      student_number: studentNumber,
      pdm_id: studentNumber,
      learners_reference_number: normalizeText(obj.learners_reference_number) || null,
      given_name: givenName,
      middle_name: normalizeText(obj.middle_name) || null,
      last_name: lastName,
      course_code: normalizeText(obj.degree_program) || null,
      year_level: normalizeYearLevel(obj.year_level),
      sex_at_birth: normalizeText(obj.sex_at_birth) || null,
      religion: normalizeText(obj.religion) || null,
      date_of_birth: parseExcelDate(obj.date_of_birth),
      age: parseInteger(obj.age),
      place_of_birth: normalizeText(obj.place_of_birth) || null,
      civil_status: normalizeText(obj.civil_status) || null,
      email_address: normalizeText(obj.email_address).toLowerCase() || null,
      phone_number: normalizeText(obj.phone_number) || null,
      sequence_number: obj.sequence_number ? Number(obj.sequence_number) || null : null,
      sibling_last_name: normalizeText(obj.sibling_last_name) || null,
      sibling_first_name: normalizeText(obj.sibling_first_name) || null,
      sibling_middle_name: normalizeText(obj.sibling_middle_name) || null,
      sibling_mobile_no: normalizeText(obj.sibling_mobile_no) || null,
      financial_support_parents: parseBoolean(obj.financial_support_parents),
      financial_support_scholarship: parseBoolean(obj.financial_support_scholarship),
      financial_support_loan: parseBoolean(obj.financial_support_loan),
      financial_support_other: parseBoolean(obj.financial_support_other),
      has_been_scholar: parseBoolean(obj.has_been_scholar),
      has_disciplinary_action: parseBoolean(obj.has_disciplinary_action),
      raw_payload: obj.raw_payload,
    });
  }

  return records;
}

async function loadCourseMap() {
  const { data, error } = await supabase
    .from(COURSE_TABLE)
    .select('course_id, course_code, course_name')
    .eq('is_archived', false);

  if (error) throw error;

  const map = new Map();

  (data || []).forEach((row) => {
    [row.course_code, row.course_name].forEach((value) => {
      const key = normalizeLookupValue(value);
      if (key) map.set(key, row.course_id);
    });
  });

  return map;
}

async function createBatch(file, adminId = null) {
  const { data, error } = await supabase
    .from(IMPORT_BATCH_TABLE)
    .insert({
      file_name: file.originalname || 'uploaded-file',
      file_type: (file.originalname || '').split('.').pop()?.toLowerCase() || '',
      uploaded_by: adminId,
      total_rows: 0,
      success_rows: 0,
      failed_rows: 0,
      remarks: null,
    })
    .select('import_batch_id')
    .single();

  if (error) throw error;
  return data.import_batch_id;
}

async function insertImportRows(importBatchId, parsedRows) {
  if (!parsedRows.length) return [];

  const payload = parsedRows.map((row) => ({
    import_batch_id: importBatchId,
    row_number: row.row_number,
    raw_payload: row.raw_payload,
    student_number: row.student_number,
    pdm_id: row.pdm_id,
    learners_reference_number: row.learners_reference_number,
    given_name: row.given_name,
    middle_name: row.middle_name,
    last_name: row.last_name,
    sex_at_birth: row.sex_at_birth,
    email_address: row.email_address,
    phone_number: row.phone_number,
    course_code: row.course_code,
    course_name: null,
    department_code: null,
    department_name: null,
    year_level: row.year_level,
    sequence_number: row.sequence_number,
    sibling_last_name: row.sibling_last_name,
    sibling_first_name: row.sibling_first_name,
    sibling_middle_name: row.sibling_middle_name,
    sibling_mobile_no: row.sibling_mobile_no,
    financial_support_parents: row.financial_support_parents,
    financial_support_scholarship: row.financial_support_scholarship,
    financial_support_loan: row.financial_support_loan,
    financial_support_other: row.financial_support_other,
    has_been_scholar: row.has_been_scholar,
    has_disciplinary_action: row.has_disciplinary_action,
    date_of_birth: row.date_of_birth,
    place_of_birth: row.place_of_birth,
    civil_status: row.civil_status,
    religion: row.religion,
    age: row.age,
    status: 'validated',
    error_message: null,
  }));

  const { data, error } = await supabase
    .from(IMPORT_ROW_TABLE)
    .insert(payload)
    .select('*');

  if (error) throw error;
  return data || [];
}

async function upsertMasterRows(importBatchId, importRows, courseMap) {
  if (!importRows.length) return [];

  const payload = importRows.map((row) => ({
    student_number: row.student_number,
    pdm_id: row.pdm_id || row.student_number,
    learners_reference_number: row.learners_reference_number || null,
    first_name: row.given_name,
    middle_name: row.middle_name || null,
    last_name: row.last_name,
    sex_at_birth: row.sex_at_birth || null,
    email_address: row.email_address || null,
    phone_number: row.phone_number || null,
    course_id: courseMap.get(normalizeLookupValue(row.course_code)) || null,
    year_level: row.year_level || null,
    sequence_number: row.sequence_number || null,
    religion: row.religion || null,
    sibling_last_name: row.sibling_last_name || null,
    sibling_first_name: row.sibling_first_name || null,
    sibling_middle_name: row.sibling_middle_name || null,
    sibling_mobile_no: row.sibling_mobile_no || null,
    financial_support_parents: row.financial_support_parents,
    financial_support_scholarship: row.financial_support_scholarship,
    financial_support_loan: row.financial_support_loan,
    financial_support_other: row.financial_support_other,
    has_been_scholar: row.has_been_scholar,
    has_disciplinary_action: row.has_disciplinary_action,
    date_of_birth: row.date_of_birth || null,
    place_of_birth: row.place_of_birth || null,
    civil_status: row.civil_status || null,
    age: row.age,
    latest_import_batch_id: importBatchId,
    source_registry: true,
    raw_snapshot: row.raw_payload || {},
    is_active: true,
    is_archived: false,
  }));

  const { data, error } = await supabase
    .from(MASTER_TABLE)
    .upsert(payload, {
      onConflict: 'student_number',
      ignoreDuplicates: false,
    })
    .select('master_student_id, student_number');

  if (error) throw error;
  return data || [];
}

async function markImportRowsCompleted(importRows, masterRows) {
  const masterMap = new Map(
    masterRows.map((row) => [row.student_number, row.master_student_id])
  );

  for (const row of importRows) {
    const matchedMasterId = masterMap.get(row.student_number) || null;

    const { error } = await supabase
      .from(IMPORT_ROW_TABLE)
      .update({
        matched_master_student_id: matchedMasterId,
        status: matchedMasterId ? 'imported' : 'failed',
        error_message: matchedMasterId ? null : 'Master upsert failed',
      })
      .eq('import_row_id', row.import_row_id);

    if (error) throw error;
  }
}

async function finalizeBatch(importBatchId, totalRows, successRows, failedRows) {
  const { error } = await supabase
    .from(IMPORT_BATCH_TABLE)
    .update({
      total_rows: totalRows,
      success_rows: successRows,
      failed_rows: failedRows,
      remarks: null,
    })
    .eq('import_batch_id', importBatchId);

  if (error) throw error;
}

async function importStudentRegistryFile({ file, adminId }) {
  if (!file || !file.buffer) {
    throw buildError('No file uploaded.', 400);
  }

  const rawRows = await readWorkbookRows(file);
  const parsedRows = parseRows(rawRows);

  const importBatchId = await createBatch(file, adminId);
  const courseMap = await loadCourseMap();
  const importRows = await insertImportRows(importBatchId, parsedRows);
  const masterRows = await upsertMasterRows(importBatchId, importRows, courseMap);

  await markImportRowsCompleted(importRows, masterRows);
  await finalizeBatch(
    importBatchId,
    parsedRows.length,
    masterRows.length,
    Math.max(parsedRows.length - masterRows.length, 0)
  );

  return {
    import_batch_id: importBatchId,
    imported: masterRows.length,
    total: parsedRows.length,
    failed_rows: Math.max(parsedRows.length - masterRows.length, 0),
  };
}

async function listStudentRegistry({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 5000);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const { data, error, count } = await supabase
    .from(REGISTRY_VIEW)
    .select('*', { count: 'exact' })
    .eq('is_archived', false)
    .order('sequence_number', { ascending: true, nullsFirst: false })
    .order('student_number', { ascending: true })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (error) throw error;

  return {
    total: count || 0,
    limit: safeLimit,
    offset: safeOffset,
    items: data || [],
  };
}

module.exports = {
  importStudentRegistryFile,
  listStudentRegistry,
};
