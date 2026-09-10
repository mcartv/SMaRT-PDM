const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Exercise the service's pure validation/mapping functions without connecting
// to a database or modifying an applicant record.
const source = fs.readFileSync(path.join(__dirname, '../src/services/applicationService.js'), 'utf8');
const context = vm.createContext({
  safeText: (value) => String(value ?? '').trim(),
  firstNonEmpty: (...values) => values.find((value) => String(value ?? '').trim()) ?? '',
  createHttpError: (statusCode, message) => Object.assign(new Error(message), { statusCode }),
  ...require('../src/validation/applicationSection'),
  ...require('../src/validation/applicationFieldLimits'),
});
vm.runInContext(source.slice(source.indexOf('const CIVIL_STATUS_TYPES'), source.indexOf('async function getMySubmittedFormData(')), context);

function completeForm() {
  const family = { parent_guardian_address: 'N/A', parent_native_status: 'No',
    parent_previous_town_municipality: 'N/A', parent_previous_province: 'N/A' };
  for (const relation of ['father', 'mother', 'sibling', 'guardian']) {
    family[relation] = Object.fromEntries(['first_name', 'last_name', 'middle_name', 'mobile', 'educational_attainment', 'occupation', 'company_name_and_address'].map((key) => [key, 'N/A']));
  }
  const academic = { current_course: 'BSIT', current_year_level: '1', current_section: 'A', lrn: 'N/A' };
  for (const level of ['college', 'high_school', 'senior_high', 'elementary']) {
    for (const field of ['school', 'address', 'year_graduated']) academic[`${level}_${field}`] = 'N/A';
  }
  return { personal: { first_name: 'Example', last_name: 'Applicant', date_of_birth: '2006-01-01', place_of_birth: 'Marilao', sex: 'Female', civil_status: 'Single', religion: 'N/A' },
    address: { street: 'N/A', subdivision: 'N/A', barangay: 'N/A', city: 'Marilao', province: 'Bulacan', zip_code: '3019' },
    contact: { mobile_number: '09123456789' }, academic, family,
    support: { financial_support: 'Parents', scholarship_history: false },
    discipline: { disciplinary_action: false }, essays: { self_description: 'Student', aims_and_ambitions: 'Graduate' } };
}

test('server accepts explicit N/A and rejects empty required family/address values', () => {
  const payload = completeForm();
  assert.doesNotThrow(() => context.validateApplicationSubmissionPayload(payload));
  payload.family.guardian.first_name = '  ';
  assert.throws(() => context.validateApplicationSubmissionPayload(payload), /guardian first name/);
  payload.family.guardian.first_name = 'N/A';
  payload.address.subdivision = '';
  assert.throws(() => context.validateApplicationSubmissionPayload(payload), /Subdivision/);
});

test('application civil statuses match the student profile database constraint', () => {
  const payload = completeForm();
  payload.personal.civil_status = 'Divorced';
  assert.doesNotThrow(() => context.validateApplicationSubmissionPayload(payload));

  payload.personal.civil_status = 'Partnered';
  assert.throws(
    () => context.validateApplicationSubmissionPayload(payload),
    /Civil status must be one of/
  );

  const migration = fs.readFileSync(
    path.join(
      __dirname,
      '../../../supabase/migrations/20260910021441_allow_divorced_civil_status.sql'
    ),
    'utf8'
  );
  assert.match(migration, /student_profiles_civil_status_check/);
  assert.match(migration, /'Divorced'/);
  assert.match(migration, /VALIDATE CONSTRAINT student_profiles_civil_status_check/);
});

test('snapshot answers including false, blank and N/A are preserved during export', () => {
  const merged = context.mergeMissingSubmissionValues(
    { family: { parent_native_status: 'Yes, father only' }, support: { scholarship_history: false }, address: { street: '', subdivision: 'N/A' } },
    { family: { parent_native_status: 'Yes, both parents' }, support: { scholarship_history: true }, address: { street: 'Old street', subdivision: 'Old subdivision', phase: '2' } }, true);
  assert.equal(merged.family.parent_native_status, 'Yes, father only');
  assert.equal(merged.support.scholarship_history, false);
  assert.equal(merged.address.street, '');
  assert.equal(merged.address.subdivision, 'N/A');
  assert.equal(merged.address.phase, '2');
});
