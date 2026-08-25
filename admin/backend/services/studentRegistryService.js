const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const crypto = require('crypto');
const supabase = require('../config/supabase');

const IMPORT_BATCH_TABLE = 'student_import_batches';
const IMPORT_ROW_TABLE = 'student_import_rows';
const MASTER_TABLE = 'student_master_records';
const REGISTRY_VIEW = 'student_registry';
const COURSE_TABLE = 'academic_course';
const SDO_RECORD_TABLE = 'sdo_student_records';
const HEADER_ORDER_META_KEY = '__smart_pdm_header_order';

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

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
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

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '"') {
      current += char;
      if (inQuotes && next === '"') {
        current += next;
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === '\n' && !inQuotes) {
      if (current.trim() !== '') rows.push(parseCsvLine(current));
      current = '';
      continue;
    }

    current += char;
  }

  if (current.trim() !== '') rows.push(parseCsvLine(current));
  return rows;
}

function parseNullableBoolean(value) {
  if (value === null || value === undefined || normalizeText(value) === '') return null;
  return parseBoolean(value);
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
    return parseCsvRows(file.buffer.toString('utf8'));
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
      ['student number', 'student no', 'student id', 'student id no', 'student id number', 'pdm id', 'pdm no', 'pdm number'].includes(header)
    ) {
      map.set(index, 'student_number');
    } else if (
      ['surname', 'last name', 'lastname', 'family name'].includes(header)
    ) {
      map.set(index, 'last_name');
    } else if (
      ['first name', 'firstname', 'given name', 'given names'].includes(header)
    ) {
      map.set(index, 'given_name');
    } else if (
      ['middle name', 'middlename', 'middle initial'].includes(header)
    ) {
      map.set(index, 'middle_name');
    } else if (
      ['course', 'course code', 'degree program', 'program', 'program code', 'course/program'].includes(header)
    ) {
      map.set(index, 'degree_program');
    } else if (
      ['year level', 'year', 'level'].includes(header)
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
      ['phone number', 'contact number', 'mobile number', 'personal number'].includes(header)
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
    } else if (
      ['offense type', 'offence type', 'disciplinary offense type'].includes(header)
    ) {
      map.set(index, 'offense_type');
    } else if (
      ['incident date', 'date of incident', 'offense date', 'offence date'].includes(header)
    ) {
      map.set(index, 'offense_incident_date');
    }
  });

  return map;
}

function buildSourceColumns(headerRow = [], bodyRows = []) {
  const maxColumns = Math.max(
    headerRow.length,
    ...bodyRows.map((row) => (Array.isArray(row) ? row.length : 0)),
    0
  );
  const seen = new Map();
  const columns = [];

  for (let index = 0; index < maxColumns; index += 1) {
    const rawHeader = normalizeText(headerRow[index]);
    const columnHasData = bodyRows.some((row) => normalizeText(row?.[index]) !== '');
    if (!rawHeader && !columnHasData) continue;

    const baseLabel = rawHeader || `Column ${index + 1}`;
    const key = normalizeLookupValue(baseLabel);
    const occurrence = (seen.get(key) || 0) + 1;
    seen.set(key, occurrence);

    columns.push({
      index,
      label: occurrence === 1 ? baseLabel : `${baseLabel} (${occurrence})`,
    });
  }

  return columns;
}

function parseRows(rows) {
  if (!rows.length) return [];

  const headerRow = rows[0] || [];
  const bodyRows = rows.slice(1);
  const headerMap = mapHeaders(headerRow);
  const sourceColumns = buildSourceColumns(headerRow, bodyRows);
  const sourceHeaders = sourceColumns.map((column) => column.label);
  const records = [];

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const obj = {
      row_number: i + 1,
      raw_payload: { [HEADER_ORDER_META_KEY]: sourceHeaders },
    };

    sourceColumns.forEach(({ index, label }) => {
      const value = row[index] ?? '';
      const key = headerMap.get(index);
      if (key) obj[key] = value;
      obj.raw_payload[label] = value;
    });

    const studentNumber = normalizeText(obj.student_number).toUpperCase();
    const givenName = normalizeText(obj.given_name);
    const lastName = normalizeText(obj.last_name);

    if (!studentNumber && !givenName && !lastName) continue;
    if (!studentNumber || !givenName || !lastName) continue;

    const hasField = (field) => Object.prototype.hasOwnProperty.call(obj, field);
    const explicitDisciplinary = hasField('has_disciplinary_action')
      ? parseNullableBoolean(obj.has_disciplinary_action)
      : null;
    const hasOffenseDetails = Boolean(
      normalizeText(obj.offense_type) || parseExcelDate(obj.offense_incident_date)
    );

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
      financial_support_parents: hasField('financial_support_parents')
        ? parseNullableBoolean(obj.financial_support_parents)
        : null,
      financial_support_scholarship: hasField('financial_support_scholarship')
        ? parseNullableBoolean(obj.financial_support_scholarship)
        : null,
      financial_support_loan: hasField('financial_support_loan')
        ? parseNullableBoolean(obj.financial_support_loan)
        : null,
      financial_support_other: hasField('financial_support_other')
        ? parseNullableBoolean(obj.financial_support_other)
        : null,
      has_been_scholar: hasField('has_been_scholar')
        ? parseNullableBoolean(obj.has_been_scholar)
        : null,
      has_disciplinary_action: hasOffenseDetails ? true : explicitDisciplinary,
      offense_type: normalizeText(obj.offense_type) || null,
      offense_incident_date: parseExcelDate(obj.offense_incident_date),
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
    offense_type: row.offense_type,
    offense_incident_date: row.offense_incident_date,
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
  const sourceHeaders = buildSourceColumns(rawRows[0] || [], rawRows.slice(1))
    .map((column) => column.label);
  const parsedRows = parseRows(rawRows);

  if (!sourceHeaders.length) {
    throw buildError('No usable columns were found in the uploaded file.', 400);
  }

  if (!parsedRows.length) {
    throw buildError(
      'No importable student rows were found. The file must include PDM ID/Student Number, First Name/Given Name, and Surname/Last Name.',
      400
    );
  }

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
    source_headers: sourceHeaders,
  };
}


function getSnapshotValue(snapshot, headers = []) {
  if (!snapshot || typeof snapshot !== 'object') return null;
  for (const header of headers) {
    const value = snapshot[header];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  const entries = Object.entries(snapshot).map(([key, value]) => [normalizeLookupValue(key), value]);
  for (const header of headers) {
    const wanted = normalizeLookupValue(header);
    const found = entries.find(([key]) => key === wanted);
    if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== '') return found[1];
  }
  return null;
}

function hydrateRegistryRowFromSnapshot(row) {
  const snapshot = row?.raw_snapshot || {};
  return {
    ...row,
    given_name: row?.given_name || getSnapshotValue(snapshot, ['First Name']),
    middle_name: row?.middle_name || getSnapshotValue(snapshot, ['Middle Name']),
    last_name: row?.last_name || getSnapshotValue(snapshot, ['Surname', 'Last Name']),
    sex_at_birth: row?.sex_at_birth || getSnapshotValue(snapshot, ['Sex', 'Sex at Birth']),
    religion: row?.religion || getSnapshotValue(snapshot, ['Religion']),
    date_of_birth: row?.date_of_birth || getSnapshotValue(snapshot, ['Date of Birth','Birthday','Birthdate']),
    age: row?.age ?? getSnapshotValue(snapshot, ['Age']),
    place_of_birth: row?.place_of_birth || getSnapshotValue(snapshot, ['Place of Birth','Birthplace']),
    civil_status: row?.civil_status || getSnapshotValue(snapshot, ['Civil Status']),
    phone_number: row?.phone_number || getSnapshotValue(snapshot, ['Personal Number','Phone Number','Contact Number','Mobile Number']),
    email_address: row?.email_address || getSnapshotValue(snapshot, ['Email Address','Email']),
    suffix: getSnapshotValue(snapshot, ['Suffix']),
    height_m: getSnapshotValue(snapshot, ['Height (m)','Height']),
    weight_kg: getSnapshotValue(snapshot, ['Weight (kg)','Weight']),
    nationality: getSnapshotValue(snapshot, ['Nationality']),
    present_address: getSnapshotValue(snapshot, ['Present Address']),
    present_zip_code: getSnapshotValue(snapshot, ['Present ZIP Code','Present Zip Code','Present Postal Code']),
    permanent_address: getSnapshotValue(snapshot, ['Permanent Address']),
    permanent_zip_code: getSnapshotValue(snapshot, ['Permanent ZIP Code','Permanent Zip Code','Permanent Postal Code']),
    emergency_contact_person: getSnapshotValue(snapshot, ['Emergency Contact Person']),
    relationship: getSnapshotValue(snapshot, ['Relationship']),
    emergency_address: getSnapshotValue(snapshot, ['Emergency Address']),
    emergency_contact_no: getSnapshotValue(snapshot, ['Emergency Contact No.','Emergency Contact No','Emergency Contact Number']),
    father_name: getSnapshotValue(snapshot, ['Father Name']),
    father_address: getSnapshotValue(snapshot, ['Father Address']),
    father_birthday: getSnapshotValue(snapshot, ['Father Birthday']),
    father_age: getSnapshotValue(snapshot, ['Father Age']),
    father_contact: getSnapshotValue(snapshot, ['Father Contact']),
    father_educational_attainment: getSnapshotValue(snapshot, ['Father Educational Attainment']),
    father_occupation: getSnapshotValue(snapshot, ['Father Occupation']),
    father_living_vital_status: getSnapshotValue(snapshot, ['Father Living/Vital Status']),
    mother_name: getSnapshotValue(snapshot, ['Mother Name']),
    mother_address: getSnapshotValue(snapshot, ['Mother Address']),
    mother_birthday: getSnapshotValue(snapshot, ['Mother Birthday']),
    mother_age: getSnapshotValue(snapshot, ['Mother Age']),
    mother_contact: getSnapshotValue(snapshot, ['Mother Contact']),
    mother_educational_attainment: getSnapshotValue(snapshot, ['Mother Educational Attainment']),
    mother_occupation: getSnapshotValue(snapshot, ['Mother Occupation']),
    mother_living_vital_status: getSnapshotValue(snapshot, ['Mother Living/Vital Status']),
    elem_school: getSnapshotValue(snapshot, ['Elem School']),
    elem_inclusive_year: getSnapshotValue(snapshot, ['Elem Inclusive Year']),
    elem_address: getSnapshotValue(snapshot, ['Elem Address']),
    elem_lrn: getSnapshotValue(snapshot, ['Elem LRN']),
    hs_old_curriculum_school: getSnapshotValue(snapshot, ['HS Old Curriculum School']),
    hs_old_curriculum_year: getSnapshotValue(snapshot, ['HS Old Curriculum Year']),
    hs_old_curriculum_address: getSnapshotValue(snapshot, ['HS Old Curriculum Address']),
    hs_old_curriculum_lrn: getSnapshotValue(snapshot, ['HS Old Curriculum LRN']),
    grade_7_10_school: getSnapshotValue(snapshot, ['Grade 7-10 School']),
    grade_7_10_year: getSnapshotValue(snapshot, ['Grade 7-10 Year']),
    grade_7_10_address: getSnapshotValue(snapshot, ['Grade 7-10 Address']),
    grade_7_10_lrn: getSnapshotValue(snapshot, ['Grade 7-10 LRN']),
    grade_11_12_school: getSnapshotValue(snapshot, ['Grade 11-12 School']),
    grade_11_12_year: getSnapshotValue(snapshot, ['Grade 11-12 Year']),
    grade_11_12_address: getSnapshotValue(snapshot, ['Grade 11-12 Address']),
    grade_11_12_lrn: getSnapshotValue(snapshot, ['Grade 11-12 LRN']),
    als_graduate: getSnapshotValue(snapshot, ['ALS Graduate']),
    previous_college: getSnapshotValue(snapshot, ['Previous College']),
    previous_course: getSnapshotValue(snapshot, ['Previous Course']),
    previous_inclusive_year: getSnapshotValue(snapshot, ['Previous Inclusive Year']),
    previous_address: getSnapshotValue(snapshot, ['Previous Address']),
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
    items: (data || []).map(hydrateRegistryRowFromSnapshot),
  };
}

async function importSdoDisciplinaryRecordsFile({ file, actorId = null }) {
  if (!file || !file.buffer) {
    throw buildError('No file uploaded.', 400);
  }

  const rawRows = await readWorkbookRows(file);
  const parsedRows = parseSdoRecordRows(rawRows);
  if (!parsedRows.length) {
    throw buildError('No disciplinary records were found in the file.', 400);
  }

  const preview = await classifySdoRecordRows(parsedRows);
  const readyRows = preview.rows.filter((row) => row.status === 'ready');
  const payload = readyRows.map((row) => ({
    student_number: row.student_number,
    offense_type: row.offense_type,
    offense_incident_date: row.offense_incident_date,
    case_reference_number: row.case_reference_number,
    remarks: row.remarks,
    source_file_name: file.originalname || 'uploaded-file',
    recorded_by: actorId ? String(actorId) : null,
    record_fingerprint: buildSdoRecordFingerprint(row),
  }));

  let importedRows = [];
  if (payload.length) {
    const { data, error } = await supabase
      .from(SDO_RECORD_TABLE)
      .upsert(payload, { onConflict: 'record_fingerprint', ignoreDuplicates: true })
      .select('record_id, student_number, offense_type, offense_incident_date');

    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code)) {
        throw buildError('SDO records table is missing. Run the SDO disciplinary records migration first.', 503);
      }
      throw error;
    }
    importedRows = data || [];
  }

  const latestByStudent = new Map();
  readyRows.forEach((row) => {
    const current = latestByStudent.get(row.student_number);
    if (!current || String(row.offense_incident_date || '') >= String(current.offense_incident_date || '')) {
      latestByStudent.set(row.student_number, row);
    }
  });

  for (const [studentNumber, row] of latestByStudent.entries()) {
    const { error } = await supabase
      .from(MASTER_TABLE)
      .update({
        has_disciplinary_action: true,
        offense_type: row.offense_type,
        offense_incident_date: row.offense_incident_date,
      })
      .eq('student_number', studentNumber);
    if (error) throw error;
  }

  return {
    imported: importedRows.length,
    total: parsedRows.length,
    duplicate_rows: preview.counts.duplicate,
    invalid_rows: preview.rows
      .filter((row) => row.status === 'invalid')
      .map((row) => ({ row_number: row.row_number, reason: row.reason })),
    unmatched_rows: preview.rows
      .filter((row) => row.status === 'unmatched')
      .map((row) => ({
      row_number: row.row_number,
      student_number: row.student_number,
    })),
  };
}

async function previewSdoDisciplinaryRecordsFile({ file }) {
  if (!file || !file.buffer) {
    throw buildError('No file uploaded.', 400);
  }

  const rawRows = await readWorkbookRows(file);
  const parsedRows = parseSdoRecordRows(rawRows);
  if (!parsedRows.length) {
    throw buildError('No disciplinary records were found in the file.', 400);
  }

  return classifySdoRecordRows(parsedRows);
}

function parseSdoRecordRows(rows) {
  if (!rows.length) return [];

  const headerMap = new Map();
  rows[0].forEach((rawHeader, index) => {
    const header = normalizeLookupValue(rawHeader);
    if (['pdm id', 'pdm_id', 'student number', 'student_number'].includes(header)) {
      headerMap.set(index, 'student_number');
    } else if (['offense type', 'offence type', 'disciplinary offense type'].includes(header)) {
      headerMap.set(index, 'offense_type');
    } else if (['incident date', 'date of incident', 'offense date', 'offence date'].includes(header)) {
      headerMap.set(index, 'offense_incident_date');
    } else if (['case note/reference number', 'case reference number', 'reference number', 'case number'].includes(header)) {
      headerMap.set(index, 'case_reference_number');
    } else if (['remarks', 'notes', 'case note'].includes(header)) {
      headerMap.set(index, 'remarks');
    }
  });

  const records = [];
  for (let index = 1; index < rows.length; index += 1) {
    const values = rows[index];
    const record = { row_number: index + 1 };
    values.forEach((value, columnIndex) => {
      const key = headerMap.get(columnIndex);
      if (key) record[key] = value;
    });

    const studentNumber = normalizeText(record.student_number).toUpperCase();
    const offenseType = normalizeText(record.offense_type);
    if (!studentNumber && !offenseType) continue;

    records.push({
      row_number: record.row_number,
      student_number: studentNumber,
      offense_type: offenseType,
      offense_incident_date: parseExcelDate(record.offense_incident_date),
      raw_incident_date: normalizeText(record.offense_incident_date),
      case_reference_number: normalizeText(record.case_reference_number) || null,
      remarks: normalizeText(record.remarks) || null,
    });
  }

  return records;
}

function buildSdoRecordFingerprint(record) {
  return crypto
    .createHash('md5')
    .update([
      record.student_number,
      normalizeLookupValue(record.offense_type),
      record.offense_incident_date || '',
      normalizeLookupValue(record.case_reference_number),
    ].join('|'))
    .digest('hex');
}

function chunkValues(values, size = 200) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function classifySdoRecordRows(rows) {
  const candidateRows = rows.filter((row) => row.student_number && row.offense_type);
  const studentNumbers = [...new Set(candidateRows.map((row) => row.student_number))];
  const fingerprints = candidateRows.map((row) => buildSdoRecordFingerprint(row));
  const knownStudents = new Set();
  const existingFingerprints = new Set();

  for (const batch of chunkValues(studentNumbers)) {
    const { data, error } = await supabase
      .from(MASTER_TABLE)
      .select('student_number')
      .in('student_number', batch)
      .eq('is_archived', false);
    if (error) throw error;
    (data || []).forEach((student) => knownStudents.add(student.student_number));
  }

  for (const batch of chunkValues([...new Set(fingerprints)])) {
    const { data, error } = await supabase
      .from(SDO_RECORD_TABLE)
      .select('record_fingerprint')
      .in('record_fingerprint', batch);
    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code)) {
        throw buildError('SDO records table is missing. Run the SDO disciplinary records migration first.', 503);
      }
      throw error;
    }
    (data || []).forEach((record) => existingFingerprints.add(record.record_fingerprint));
  }

  const fingerprintsInFile = new Set();
  const classifiedRows = rows.map((row) => {
    let status = 'ready';
    let reason = 'Ready to import';
    const fingerprint =
      row.student_number && row.offense_type ? buildSdoRecordFingerprint(row) : '';

    if (!row.student_number) {
      status = 'invalid';
      reason = 'PDM ID is required';
    } else if (!row.offense_type) {
      status = 'invalid';
      reason = 'Offense type is required';
    } else if (row.raw_incident_date && !row.offense_incident_date) {
      status = 'invalid';
      reason = 'Incident date is invalid';
    } else if (!knownStudents.has(row.student_number)) {
      status = 'unmatched';
      reason = 'PDM ID was not found in the Admin Student Registry';
    } else if (existingFingerprints.has(fingerprint) || fingerprintsInFile.has(fingerprint)) {
      status = 'duplicate';
      reason = 'This disciplinary record already exists';
    }

    if (status === 'ready') {
      fingerprintsInFile.add(fingerprint);
    }

    return {
      ...row,
      record_fingerprint: fingerprint || null,
      status,
      reason,
    };
  });

  const counts = classifiedRows.reduce(
    (summary, row) => {
      summary.total += 1;
      summary[row.status] += 1;
      return summary;
    },
    { total: 0, ready: 0, duplicate: 0, unmatched: 0, invalid: 0 }
  );

  return { counts, rows: classifiedRows };
}

async function loadAllSdoRecords() {
  const records = [];
  const batchSize = 1000;

  for (let offset = 0; ; offset += batchSize) {
    const { data, error } = await supabase
      .from(SDO_RECORD_TABLE)
      .select(`
        record_id,
        student_number,
        offense_type,
        offense_incident_date,
        case_reference_number,
        remarks,
        source_file_name,
        recorded_by,
        created_at,
        updated_at
      `)
      .eq('is_archived', false)
      .order('offense_incident_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + batchSize - 1);

    if (error) {
      if (['42P01', 'PGRST205'].includes(error.code)) {
        throw buildError('SDO records table is missing. Run the SDO disciplinary records migration first.', 503);
      }
      throw error;
    }

    records.push(...(data || []));
    if (!data || data.length < batchSize) break;
  }

  return records;
}

async function loadSdoStudentDetails(studentNumbers) {
  const studentsByNumber = new Map();
  const coursesById = new Map();

  for (const batch of chunkValues(studentNumbers)) {
    const { data, error } = await supabase
      .from(MASTER_TABLE)
      .select('master_student_id, student_number, first_name, middle_name, last_name, course_id, year_level')
      .in('student_number', batch)
      .eq('is_archived', false);
    if (error) throw error;
    (data || []).forEach((student) => studentsByNumber.set(student.student_number, student));
  }

  const courseIds = [...new Set([...studentsByNumber.values()].map((row) => row.course_id).filter(Boolean))];
  for (const batch of chunkValues(courseIds)) {
    const { data, error } = await supabase
      .from(COURSE_TABLE)
      .select('course_id, course_code, course_name')
      .in('course_id', batch);
    if (error) throw error;
    (data || []).forEach((course) => coursesById.set(course.course_id, course));
  }

  return { studentsByNumber, coursesById };
}

function buildSdoStudentSummary(studentNumber, records, student, course) {
  const latest = records[0] || {};
  return {
    student_number: studentNumber,
    student_name: [student?.first_name, student?.middle_name, student?.last_name]
      .filter(Boolean)
      .join(' ') || 'Unknown Student',
    course_code: course?.course_code || null,
    course_name: course?.course_name || null,
    year_level: student?.year_level || null,
    record_count: records.length,
    latest_offense: latest.offense_type || null,
    latest_incident_date: latest.offense_incident_date || null,
    latest_recorded_at: latest.created_at || null,
  };
}

async function listSdoStudentsWithRecords({
  limit = 20,
  offset = 0,
  search = '',
  course = '',
  offense = '',
} = {}) {
  const records = await loadAllSdoRecords();
  const recordsByStudent = new Map();

  records.forEach((record) => {
    if (!recordsByStudent.has(record.student_number)) {
      recordsByStudent.set(record.student_number, []);
    }
    recordsByStudent.get(record.student_number).push(record);
  });

  const studentNumbers = [...recordsByStudent.keys()];
  const { studentsByNumber, coursesById } = await loadSdoStudentDetails(studentNumbers);
  const summaries = studentNumbers.map((studentNumber) => {
    const student = studentsByNumber.get(studentNumber) || {};
    const courseRow = coursesById.get(student.course_id) || {};
    return buildSdoStudentSummary(
      studentNumber,
      recordsByStudent.get(studentNumber),
      student,
      courseRow
    );
  });

  const normalizedSearch = normalizeLookupValue(search);
  const filtered = summaries.filter((student) => {
    const haystack = normalizeLookupValue([
      student.student_number,
      student.student_name,
      student.course_code,
      student.latest_offense,
    ].join(' '));
    return (!normalizedSearch || haystack.includes(normalizedSearch))
      && (!course || course === 'all' || student.course_code === course)
      && (!offense || offense === 'all' || student.latest_offense === offense);
  });

  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  return {
    total: filtered.length,
    total_students: summaries.length,
    total_records: records.length,
    courses: [...new Set(summaries.map((row) => row.course_code).filter(Boolean))].sort(),
    offenses: [...new Set(records.map((row) => row.offense_type).filter(Boolean))].sort(),
    limit: safeLimit,
    offset: safeOffset,
    items: filtered.slice(safeOffset, safeOffset + safeLimit),
  };
}

async function getSdoStudentRecordHistory(studentNumber) {
  const normalizedStudentNumber = normalizeText(studentNumber).toUpperCase();
  if (!normalizedStudentNumber) {
    throw buildError('PDM ID is required.', 400);
  }

  const records = (await loadAllSdoRecords()).filter(
    (record) => record.student_number === normalizedStudentNumber
  );
  if (!records.length) {
    throw buildError('No disciplinary records were found for this student.', 404);
  }

  const { studentsByNumber, coursesById } = await loadSdoStudentDetails([normalizedStudentNumber]);
  const student = studentsByNumber.get(normalizedStudentNumber) || {};
  const course = coursesById.get(student.course_id) || {};

  return {
    student: buildSdoStudentSummary(normalizedStudentNumber, records, student, course),
    records,
  };
}

async function getSdoRecordsSummary() {
  const records = await loadAllSdoRecords();
  const latest = records
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;

  return {
    total_students: new Set(records.map((row) => row.student_number).filter(Boolean)).size,
    total_records: records.length,
    latest_record: latest,
  };
}

async function listSdoStudentRegistry({ limit = 100, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const { data: records, error, count } = await supabase
    .from(SDO_RECORD_TABLE)
    .select(`
      record_id,
      student_number,
      offense_type,
      offense_incident_date,
      case_reference_number,
      remarks,
      created_at
    `, { count: 'exact' })
    .eq('is_archived', false)
    .order('offense_incident_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(safeOffset, safeOffset + safeLimit - 1);

  if (error) {
    if (['42P01', 'PGRST205'].includes(error.code)) {
      throw buildError('SDO records table is missing. Run the SDO disciplinary records migration first.', 503);
    }
    throw error;
  }

  const studentNumbers = [...new Set((records || []).map((row) => row.student_number).filter(Boolean))];
  let studentsByNumber = new Map();
  if (studentNumbers.length) {
    const { data: students, error: studentError } = await supabase
      .from(MASTER_TABLE)
      .select('master_student_id, student_number, first_name, middle_name, last_name, course_id, year_level')
      .in('student_number', studentNumbers);
    if (studentError) throw studentError;
    studentsByNumber = new Map((students || []).map((student) => [student.student_number, student]));
  }

  const courseIds = [...new Set([...studentsByNumber.values()].map((row) => row.course_id).filter(Boolean))];
  let courseById = new Map();

  if (courseIds.length) {
    const { data: courses, error: courseError } = await supabase
      .from(COURSE_TABLE)
      .select('course_id, course_code')
      .in('course_id', courseIds);

    if (courseError) throw courseError;
    courseById = new Map((courses || []).map((course) => [course.course_id, course.course_code]));
  }

  return {
    total: count || 0,
    limit: safeLimit,
    offset: safeOffset,
    items: (records || []).map((record) => {
      const student = studentsByNumber.get(record.student_number) || {};
      return {
        ...record,
        ...student,
        student_number: record.student_number,
        has_disciplinary_action: true,
        course_code: courseById.get(student.course_id) || null,
      };
    }),
  };
}

module.exports = {
  importStudentRegistryFile,
  listStudentRegistry,
};
