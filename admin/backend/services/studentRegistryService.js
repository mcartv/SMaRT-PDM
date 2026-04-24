const ExcelJS = require('exceljs');
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
  if (!worksheet) return [];

  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    rows.push(row.values.slice(1));
  });

  return rows;
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
      email_address: normalizeText(obj.email_address).toLowerCase() || null,
      phone_number: normalizeText(obj.phone_number) || null,
      sequence_number: obj.sequence_number ? Number(obj.sequence_number) || null : null,
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