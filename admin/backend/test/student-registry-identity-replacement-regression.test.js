const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'services', 'studentRegistryService.js');
const service = fs.readFileSync(file, 'utf8');

test('protects every existing Student Number from identity replacement', () => {
  assert.match(service, /classifyProtectedRegistryRows/);
  assert.match(service, /evaluateRegistryIdentity/);
  assert.doesNotMatch(service, /existing\?\.has_linked_student/);
  assert.match(service, /error_message: identity\.reason/);
});

test('safe registry corrections sync to linked students without blank-value loss', () => {
  assert.match(service, /syncLinkedStudentsFromRegistryMaster/);
  assert.match(service, /student\.master_student_id = master\.master_student_id/);
  assert.match(service, /SMART_PDM_LINKED_STUDENT_SAFE_SYNC_V1/);

  assert.match(
    service,
    /first_name\s*=\s*COALESCE\([\s\S]*?master\.first_name[\s\S]*?student\.first_name/
  );
  assert.match(
    service,
    /last_name\s*=\s*COALESCE\([\s\S]*?master\.last_name[\s\S]*?student\.last_name/
  );
  assert.match(
    service,
    /course_id\s*=\s*COALESCE\([\s\S]*?master\.course_id[\s\S]*?student\.course_id/
  );
  assert.match(
    service,
    /year_level\s*=\s*COALESCE\([\s\S]*?master\.year_level[\s\S]*?student\.year_level/
  );

  const syncStart = service.indexOf('async function syncLinkedStudentsFromRegistryMaster');
  const syncEnd = service.indexOf('async function upsertMasterRows', syncStart);
  const syncBlock = service.slice(syncStart, syncEnd);

  assert.doesNotMatch(syncBlock, /\bpdm_id\s*=/);
});

test('identity conflict rows remain failed', () => {
  assert.match(service, /SMART_PDM_REGISTRY_FAILED_ROW_PRESERVATION_V3/);
  assert.match(service, /import_row\.status <> 'failed'/);
  assert.match(service, /matched_master_student_id = matches\.master_student_id/);
  assert.match(service, /matched_master_student_id = NULL/);
  assert.match(service, /AND import_row\.status = 'failed'/);
});

test('import keeps row-level quality checks and does not replace omitted records', () => {
  assert.match(service, /Duplicate Student Number appears more than once/);
  assert.match(service, /was not found in Maintenance > Courses/);
  assert.match(service, /preserveExistingRegistryValue/);
  assert.match(service, /onConflict: 'student_number'/);
  assert.doesNotMatch(service, /DELETE FROM student_master_records/i);
  assert.doesNotMatch(service, /TRUNCATE/i);
});

test('import response exposes added, updated, and reviewable failed rows', () => {
  assert.match(service, /added: upsertSummary\.added/);
  assert.match(service, /updated: upsertSummary\.updated/);
  assert.match(service, /failed_results: failedResults/);
  assert.match(service, /existing_record/);
  assert.match(service, /uploaded_record/);
});
