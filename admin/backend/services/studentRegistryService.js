const ExcelJS = require('exceljs');
const supabase = require('../config/supabase');

const TABLE_NAME = 'student_registry';
const REQUIRED_FIELDS = ['pdm_id', 'first_name', 'last_name'];

const REGISTRY_TEMPLATE_HEADERS = [
  'pdm_id',
  'first_name',
  'middle_name',
  'last_name',
  'course_id',
  'year_level',
  'gwa',
  'profile_photo_url',
  'is_active_scholar',
  'account_status',
  'sdo_status',
  'is_archived',
  'is_profile_complete',
  'learners_reference_number',
  'sex_at_birth',
  'email_address',
  'phone_number',
];

const HEADER_MAP = new Map([
  ['pdm id', 'pdm_id'],
  ['pdm id number', 'pdm_id'],
  ['student number', 'pdm_id'],
  ['student no', 'pdm_id'],
  ['student no.', 'pdm_id'],
  ['student_number', 'pdm_id'],
  ['pdm_id', 'pdm_id'],
  ['learner s reference number', 'learners_reference_number'],
  ['learners reference number', 'learners_reference_number'],
  ['learner reference number', 'learners_reference_number'],
  ['lrn', 'learners_reference_number'],
  ['last name', 'last_name'],
  ['surname', 'last_name'],
  ['first name', 'first_name'],
  ['name', 'first_name'],
  ['given name', 'first_name'],
  ['middle name', 'middle_name'],
  ['middle initial', 'middle_name'],
  ['middle initial/s', 'middle_name'],
  ['course id', 'course_id'],
  ['course_id', 'course_id'],
  ['course code', 'course_id'],
  ['course', 'course_id'],
  ['degree program', 'course_id'],
  ['degree programme', 'course_id'],
  ['program', 'course_id'],
  ['year level', 'year_level'],
  ['year', 'year_level'],
  ['gwa', 'gwa'],
  ['profile photo url', 'profile_photo_url'],
  ['profile photo', 'profile_photo_url'],
  ['avatar url', 'profile_photo_url'],
  ['is active scholar', 'is_active_scholar'],
  ['active scholar', 'is_active_scholar'],
  ['account status', 'account_status'],
  ['sdo status', 'sdo_status'],
  ['is archived', 'is_archived'],
  ['is profile complete', 'is_profile_complete'],
  ['sex at birth', 'sex_at_birth'],
  ['sex', 'sex_at_birth'],
  ['e-mail address', 'email_address'],
  ['email address', 'email_address'],
  ['email', 'email_address'],
  ['phone number', 'phone_number'],
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
  if (!text) {
    return null;
  }

  if (!maxLength || text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength);
}

function normalizeStudentNumber(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeEmail(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeLookupValue(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeBoolean(value) {
  if (value === true || value === false) {
    return value;
  }

  const normalized = normalizeLookupValue(value);
  if (!normalized) {
    return null;
  }

  if (['true', 'yes', '1', 'y'].includes(normalized)) {
    return true;
  }

  if (['false', 'no', '0', 'n'].includes(normalized)) {
    return false;
  }

  return null;
}

function normalizeYearLevel(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const match = text.match(/\d+/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[0], 10);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 6) {
    return null;
  }

  return parsed;
}

function normalizeGwa(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const parsed = Number.parseFloat(text);
  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed;
}

function normalizeAccountStatus(value) {
  const normalized = normalizeLookupValue(value);
  if (!normalized) {
    return 'Pending';
  }

  const allowed = {
    pending: 'Pending',
    verified: 'Verified',
    disabled: 'Disabled',
  };
  return allowed[normalized] || 'Pending';
}

function normalizeSdoStatus(value) {
  const normalized = normalizeLookupValue(value);
  if (!normalized) {
    return 'Clear';
  }

  const allowed = {
    clear: 'Clear',
    'minor offense': 'Minor Offense',
    'major offense': 'Major Offense',
  };
  return allowed[normalized] || 'Clear';
}

async function loadCourseLookupMap() {
  const { data, error } = await supabase
    .from('academic_course')
    .select('course_id, course_code, course_name, is_archived')
    .eq('is_archived', false);

  if (error) {
    throw error;
  }

  const lookup = new Map();
  (data || []).forEach((course) => {
    if (!course || course.is_archived) {
      return;
    }

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

async function readWorkbookRows(file) {
  const fileName = String(file.originalname || '').toLowerCase();
  if (fileName.endsWith('.csv')) {
    const text = file.buffer.toString('utf8');
    return parseCsvText(text);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    return [];
  }

  const rows = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    rows.push(row.values.slice(1));
  });
  return rows;
}

function rowsToRecords(rows, sourceFilename) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { records: [], skipped: [], duplicateCount: 0 };
  }

  const headers = rows[0].map((value) => String(value || '').trim());
  const fieldMap = new Map();
  headers.forEach((header, index) => {
    const canonical = getCanonicalField(header);
    if (canonical) {
      fieldMap.set(index, canonical);
    }
  });

  const missingFields = REQUIRED_FIELDS.filter((field) => {
    for (const canonical of fieldMap.values()) {
      if (canonical === field) {
        return false;
      }
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

  rows.slice(1).forEach((row, rowIndex) => {
    const rawRecord = {};

    row.forEach((value, index) => {
      const field = fieldMap.get(index);
      if (field) {
        rawRecord[field] = value;
      }
    });

    const record = {
      pdm_id: normalizeTextWithLimit(rawRecord.pdm_id, 20)?.toUpperCase() || '',
      learners_reference_number: normalizeTextWithLimit(
        rawRecord.learners_reference_number,
        50
      ),
      last_name: normalizeTextWithLimit(rawRecord.last_name, 50),
      first_name: normalizeTextWithLimit(rawRecord.first_name, 50),
      middle_name: normalizeTextWithLimit(rawRecord.middle_name, 50),
      course_id: normalizeText(rawRecord.course_id),
      year_level: normalizeYearLevel(rawRecord.year_level),
      gwa: normalizeGwa(rawRecord.gwa),
      profile_photo_url: normalizeTextWithLimit(rawRecord.profile_photo_url, 255),
      is_active_scholar: normalizeBoolean(rawRecord.is_active_scholar) ?? false,
      account_status: normalizeAccountStatus(rawRecord.account_status),
      sdo_status: normalizeSdoStatus(rawRecord.sdo_status),
      is_archived: normalizeBoolean(rawRecord.is_archived) ?? false,
      is_profile_complete: normalizeBoolean(rawRecord.is_profile_complete) ?? false,
      sex_at_birth: normalizeText(rawRecord.sex_at_birth),
      email_address: normalizeTextWithLimit(normalizeEmail(rawRecord.email_address), 255),
      phone_number: normalizeTextWithLimit(rawRecord.phone_number, 50),
      source_filename: sourceFilename,
      source_row_number: rowIndex + 2,
    };

    if (
      !record.pdm_id ||
      !record.last_name ||
      !record.first_name
    ) {
      skipped.push({
        row_number: rowIndex + 2,
        reason: 'Missing one or more required fields after normalization.',
      });
      return;
    }

    if (uniqueRows.has(record.pdm_id)) {
      duplicateCount += 1;
    }

    uniqueRows.set(record.pdm_id, record);
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
  const { records, skipped, duplicateCount } = rowsToRecords(
    rows,
    file.originalname || null
  );

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
  const hydratedRecords = [];
  for (const record of records) {
    let courseId = null;

    if (record.course_id) {
      const normalizedReference = normalizeLookupValue(record.course_id);
      courseId = courseLookupMap.get(normalizedReference) || null;
    }

    hydratedRecords.push({
      ...record,
      course_id: courseId,
    });
  }

  const { data: existingRows, error: existingError } = await supabase
    .from(TABLE_NAME)
    .select('registry_id', { count: 'exact' });

  if (existingError) {
    throw existingError;
  }

  const existingCount = Array.isArray(existingRows) ? existingRows.length : 0;

  if (existingCount > 0) {
    const { error: deleteError } = await supabase
      .from(TABLE_NAME)
      .delete()
      .not('registry_id', 'is', null);

    if (deleteError) {
      throw deleteError;
    }
  }

  const payload = hydratedRecords.map((record) => ({
    pdm_id: record.pdm_id,
    first_name: record.first_name,
    middle_name: record.middle_name || null,
    last_name: record.last_name,
    course_id: record.course_id || null,
    year_level: record.year_level || null,
    gwa: record.gwa || null,
    profile_photo_url: record.profile_photo_url || null,
    is_active_scholar: record.is_active_scholar ?? false,
    account_status: record.account_status,
    sdo_status: record.sdo_status,
    is_archived: record.is_archived ?? false,
    is_profile_complete: record.is_profile_complete ?? false,
    learners_reference_number: record.learners_reference_number || null,
    sex_at_birth: record.sex_at_birth || null,
    email_address: record.email_address || null,
    phone_number: record.phone_number || null,
    source_filename: record.source_filename || null,
    source_row_number: record.source_row_number ?? null,
  }));

  const BATCH_SIZE = 500;
  for (let index = 0; index < payload.length; index += BATCH_SIZE) {
    const batch = payload.slice(index, index + BATCH_SIZE);
    const { error: insertError } = await supabase
      .from(TABLE_NAME)
      .insert(batch);

    if (insertError) {
      throw insertError;
    }
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
        'registry_id, pdm_id, learners_reference_number, last_name, first_name, middle_name, course_id, year_level, gwa, profile_photo_url, is_active_scholar, account_status, sdo_status, is_archived, is_profile_complete, sex_at_birth, email_address, phone_number, source_filename, source_row_number, imported_at, updated_at',
        { count: 'exact' }
      )
      .order('pdm_id', { ascending: true })
      .range(safeOffset, safeOffset + safeLimit - 1),
    supabase.from(TABLE_NAME).select('registry_id', { count: 'exact', head: true }),
  ]);

  if (error) {
    throw error;
  }

  if (countError) {
    throw countError;
  }

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
