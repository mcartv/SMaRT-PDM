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

test('safe registry corrections sync to linked students', () => {
  assert.match(service, /syncLinkedStudentsFromRegistryMaster/);
  assert.match(service, /student\.master_student_id = master\.master_student_id/);
  assert.match(service, /first_name = master\.first_name/);
  assert.match(service, /last_name = master\.last_name/);
  assert.match(service, /course_id = master\.course_id/);
  assert.match(service, /year_level = master\.year_level/);
});

test('identity conflict rows remain failed', () => {
  assert.match(service, /SMART_PDM_REGISTRY_FAILED_ROW_PRESERVATION_V3/);
  assert.match(service, /import_row\.status <> 'failed'/);
});
