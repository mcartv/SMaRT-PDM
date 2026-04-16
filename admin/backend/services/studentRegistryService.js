const ExcelJS = require('exceljs');
const supabase = require('../config/supabase');

const TABLE_NAME = 'student_registry';
const REQUIRED_FIELDS = ['student_number', 'given_name', 'last_name'];

const REGISTRY_TEMPLATE_HEADERS = [
  'sequence_number',
  'student_number',
  'learners_reference_number',
  'last_name',
  'given_name',
  'middle_name',
  'degree_program',
  'year_level',
  'sex_at_birth',
  'email_address',
  'phone_number',
];

const HEADER_MAP = new Map([
  ['sequence number', 'sequence_number'],
  ['sequence_number', 'sequence_number'],
  ['seq no', 'sequence_number'],
  ['seq', 'sequence_number'],

  ['student number', 'student_number'],
  ['student_number', 'student_number'],
  ['student no', 'student_number'],
  ['student no.', 'student_number'],
  ['student #', 'student_number'],
  ['pdm id', 'student_number'],
  ['pdm_id', 'student_number'],

  ['learners reference number', 'learners_reference_number'],
  ['learners_reference_number', 'learners_reference_number'],
  ["learner's reference number", 'learners_reference_number'],
  ['learner s reference number', 'learners_reference_number'],
  ['learner reference number', 'learners_reference_number'],
  ['lrn', 'learners_reference_number'],

  ['last name', 'last_name'],
  ['lastname', 'last_name'],
  ['surname', 'last_name'],

  ['given name', 'given_name'],
  ['given_name', 'given_name'],
  ['first name', 'given_name'],
  ['firstname', 'given_name'],
  ['first_name', 'given_name'],
  ['name', 'given_name'],

  ['middle name', 'middle_name'],
  ['middle_name', 'middle_name'],
  ['middle initial', 'middle_name'],
  ['middle initial/s', 'middle_name'],
  ['middle initial.', 'middle_name'],

  ['degree program', 'degree_program'],
  ['degree_program', 'degree_program'],
  ['degree programme', 'degree_program'],
  ['program', 'degree_program'],
  ['course', 'degree_program'],
  ['course code', 'degree_program'],
  ['course name', 'degree_program'],

  ['year level', 'year_level'],
  ['year_level', 'year_level'],
  ['year', 'year_level'],

  ['sex at birth', 'sex_at_birth'],
  ['sex_at_birth', 'sex_at_birth'],
  ['sex', 'sex_at_birth'],

  ['email', 'email_address'],
  ['email address', 'email_address'],
  ['email_address', 'email_address'],
  ['e-mail address', 'email_address'],

  ['phone number', 'phone_number'],
  ['phone_number', 'phone_number'],
  ['mobile number', 'phone_number'],
  ['contact number', 'phone_number'],
]);

function normalizeHeader(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/[_]+/g, ' ')
    .replace(/['\u2019]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[().]/g, '')
    .trim();
}

function normalizeText(value) {
  return String(value || '').replace(/^\uFEFF/, '').trim();
}

function normalizeTextWithLimit(value, maxLength) {
  const text = normalizeText(value);
  if (!text) return null;
  if (!maxLength || text.length <= maxLength) return text;
  return text.slice(0, maxLength);
}

function normalizeLookupValue(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeEmail(value) {
  const text = normalizeText(value).toLowerCase();
  return text || null;
}

function normalizeInteger(value) {
  const text = normalizeText(value);
  if (!text) return null;

  const parsed = Number.parseInt(text, 10);
  if (Number.isNaN(parsed)) return null;

  return parsed;
}

function normalizeYearLevel(value) {
  const text = normalizeText(value);
  if (!text) return null;

  const match = text.match(/\d+/);
  if (!match) return null;

  const parsed = Number.parseInt(match[0], 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 6) return null;

  return parsed;
}

async function loadCourseLookupMap() {
  const { data, error } = await supabase
    .from('academic_course')
    .select('course_id, course_code, course_name, is_archived')
    .eq('is_archived', false);

  if (error) throw error;

  const lookup = new Map();

  (data || []).forEach((course) => {
    if (!course || course.is_archived) return;

    const keys = [course.course_id, course.course_code, course.course_name];
    keys.forEach((key) => {
      const normalized = normalizeLookupValue(key);
      if (normalized && !lookup.has(normalized)) {
        lookup.set(normalized, course.course_id);
      }
    });
  });

  return lookup;
}

function getCanonicalField(header) {
  return HEADER_MAP.get(normalizeHeader(header)) || null;
}

function parseCsvText(text) {
  const rows = [];
  let current = '';
  let row = [];
  let inQuotes = false;

  const pushCell = () => {
    row.push(current);
    current = '';
  };

  const pushRow = () => {
    if (row.length > 0 || current.length > 0) {
      row.push(current);
      rows.push(row);
    }
    row = [];
    current = '';
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

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
      pushCell();
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') {
        i += 1;
      }
      pushRow();
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

function isHeaderRow(row) {
  const mapped = row.map((cell) => getCanonicalField(cell)).filter(Boolean);
  return (
    mapped.includes('student_number') &&
    mapped.includes('given_name') &&
    mapped.includes('last_name')
  );
}

function findHeaderRowIndex(rows) {
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i].map((value) => String(value || '').trim());
    if (isHeaderRow(row)) {
      return i;
    }
  }
  return -1;
}

async function readWorkbookRows(file) {
  const fileName = String(file.originalname || '').toLowerCase();

  if (fileName.endsWith('.csv')) {
    const text = file.buffer.toString('utf8');
    return parseCsvText(text);
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

function rowsToRecords(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { records: [], skipped: [], duplicateCount: 0 };
  }

  const headerRowIndex = findHeaderRowIndex(rows);

  if (headerRowIndex === -1) {
    const error = new Error(
      'Could not find a valid student registry header row in the uploaded file.'
    );
    error.statusCode = 400;
    throw error;
  }

  const headers = rows[headerRowIndex].map((value) => String(value || '').trim());
  const fieldMap = new Map();

  headers.forEach((header, index) => {
    const canonical = getCanonicalField(header);
    if (canonical) {
      fieldMap.set(index, canonical);
    }
  });

  const missingFields = REQUIRED_FIELDS.filter((field) => {
    for (const canonical of fieldMap.values()) {
      if (canonical === field) return false;
    }
    return true;
  });

  if (missingFields.length > 0) {
    const error = new Error(
      `Missing required registrar columns: ${missingFields.join(', ')}`
    );
    error.statusCode = 400;
    throw error;
  }

  const uniqueRows = new Map();
  const skipped = [];
  let duplicateCount = 0;

  rows.slice(headerRowIndex + 1).forEach((row, rowIndex) => {
    const rawRecord = {};

    row.forEach((value, index) => {
      const field = fieldMap.get(index);
      if (field) {
        rawRecord[field] = value;
      }
    });

    const record = {
      sequence_number: normalizeInteger(rawRecord.sequence_number),
      student_number:
        normalizeTextWithLimit(rawRecord.student_number, 20)?.toUpperCase() || '',
      learners_reference_number: normalizeTextWithLimit(
        rawRecord.learners_reference_number,
        50
      ),
      last_name: normalizeTextWithLimit(rawRecord.last_name, 50),
      given_name: normalizeTextWithLimit(rawRecord.given_name, 50),
      middle_name: normalizeTextWithLimit(rawRecord.middle_name, 50),
      degree_program: normalizeText(rawRecord.degree_program),
      year_level: normalizeYearLevel(rawRecord.year_level),
      sex_at_birth: normalizeText(rawRecord.sex_at_birth),
      email_address: normalizeTextWithLimit(normalizeEmail(rawRecord.email_address), 255),
      phone_number: normalizeTextWithLimit(rawRecord.phone_number, 50),
    };

    const isCompletelyEmpty = Object.values(record).every(
      (value) => value === null || value === ''
    );

    if (isCompletelyEmpty) {
      return;
    }

    if (!record.student_number || !record.last_name || !record.given_name) {
      skipped.push({
        row_number: headerRowIndex + rowIndex + 2,
        reason: 'Missing one or more required fields after normalization.',
      });
      return;
    }

    if (uniqueRows.has(record.student_number)) {
      duplicateCount += 1;
    }

    uniqueRows.set(record.student_number, record);
  });

  return {
    records: Array.from(uniqueRows.values()),
    skipped,
    duplicateCount,
  };
}

async function importStudentRegistryFile(file) {
  if (!file || !file.buffer) {
    const error = new Error('No file uploaded.');
    error.statusCode = 400;
    throw error;
  }

  const rows = await readWorkbookRows(file);
  const { records, skipped, duplicateCount } = rowsToRecords(rows);

  if (records.length === 0) {
    return {
      inserted: 0,
      updated: 0,
      skipped,
      duplicate_count: duplicateCount,
      total: 0,
    };
  }

  const courseLookupMap = await loadCourseLookupMap();

  const hydratedRecords = records.map((record) => {
    let courseId = null;

    if (record.degree_program) {
      const normalizedReference = normalizeLookupValue(record.degree_program);
      courseId = courseLookupMap.get(normalizedReference) || null;
    }

    return {
      ...record,
      course_id: courseId,
    };
  });

  const { data: existingRows, error: existingError } = await supabase
    .from(TABLE_NAME)
    .select('registry_id');

  if (existingError) throw existingError;

  const existingCount = Array.isArray(existingRows) ? existingRows.length : 0;

  if (existingCount > 0) {
    const { error: deleteError } = await supabase
      .from(TABLE_NAME)
      .delete()
      .not('registry_id', 'is', null);

    if (deleteError) throw deleteError;
  }

  const nowIso = new Date().toISOString();

  const payload = hydratedRecords.map((record) => ({
    student_number: record.student_number,
    learners_reference_number: record.learners_reference_number || null,
    given_name: record.given_name,
    middle_name: record.middle_name || null,
    last_name: record.last_name,
    course_id: record.course_id || null,
    year_level: record.year_level || null,
    sex_at_birth: record.sex_at_birth || null,
    email_address: record.email_address || null,
    phone_number: record.phone_number || null,
    sequence_number: record.sequence_number || null,
    imported_at: nowIso,
    is_archived: false,
  }));

  const BATCH_SIZE = 500;

  for (let index = 0; index < payload.length; index += BATCH_SIZE) {
    const batch = payload.slice(index, index + BATCH_SIZE);
    const { error: insertError } = await supabase
      .from(TABLE_NAME)
      .insert(batch);

    if (insertError) throw insertError;
  }

  return {
    inserted: hydratedRecords.length,
    updated: existingCount,
    skipped,
    duplicate_count: duplicateCount,
    total: hydratedRecords.length,
    replaced_count: existingCount,
  };
}

async function listStudentRegistry({ limit = 50, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);

  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabase
      .from(TABLE_NAME)
      .select(
        `
        registry_id,
        student_number,
        learners_reference_number,
        given_name,
        middle_name,
        last_name,
        course_id,
        year_level,
        sex_at_birth,
        email_address,
        phone_number,
        sequence_number,
        imported_at,
        is_archived,
        academic_course:course_id (
          course_id,
          course_code,
          course_name
        )
        `,
        { count: 'exact' }
      )
      .order('sequence_number', { ascending: true, nullsFirst: false })
      .order('student_number', { ascending: true })
      .range(safeOffset, safeOffset + safeLimit - 1),
    supabase.from(TABLE_NAME).select('registry_id', { count: 'exact', head: true }),
  ]);

  if (error) throw error;
  if (countError) throw countError;

  return {
    total: count || 0,
    items: data || [],
  };
}

module.exports = {
  REGISTRY_TEMPLATE_HEADERS,
  importStudentRegistryFile,
  listStudentRegistry,
};