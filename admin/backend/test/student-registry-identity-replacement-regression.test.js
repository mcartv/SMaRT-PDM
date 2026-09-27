const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'services', 'studentRegistryService.js');
const service = fs.readFileSync(file, 'utf8');

test('protects account-bound Student Number from identity replacement', () => {
  assert.match(service, /classifyProtectedRegistryRows/);
  assert.match(service, /has_linked_student/);
  assert.match(service, /different student account\/history/i);
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
});
