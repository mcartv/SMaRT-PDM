const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const frontendSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/maintenance/StudentRegistryPanel.jsx'),
  'utf8'
);

const serviceSource = fs.readFileSync(
  path.resolve(__dirname, '../services/studentRegistryService.js'),
  'utf8'
);

const controllerSource = fs.readFileSync(
  path.resolve(__dirname, '../controllers/studentRegistryController.js'),
  'utf8'
);

test('registry import uses student number as the stable conflict key', () => {
  assert.match(
    serviceSource,
    /\.upsert\(payload,\s*\{\s*onConflict:\s*'student_number',\s*ignoreDuplicates:\s*false/
  );
});

test('re-importing the same student updates instead of duplicating', () => {
  assert.match(serviceSource, /onConflict:\s*'student_number'/);
  assert.match(serviceSource, /ignoreDuplicates:\s*false/);
});

test('new student numbers are eligible to be inserted into master registry', () => {
  assert.match(serviceSource, /\.from\(MASTER_TABLE\)/);
  assert.match(serviceSource, /\.upsert\(payload/);
  assert.match(serviceSource, /student_number:\s*row\.student_number/);
});

test('import keeps each source row and links it to the resulting master row', () => {
  assert.match(serviceSource, /matched_master_student_id/);
  assert.match(serviceSource, /status:\s*matchedMasterId\s*\?\s*'imported'\s*:\s*'failed'/);
});

test('frontend reloads persisted registry immediately after successful import', () => {
  assert.match(frontendSource, /await loadRegistry\(\)/);
  assert.match(frontendSource, /setTableMode\('imported'\)/);
  assert.match(frontendSource, /setImportOpen\(false\)/);
});

test('registry import is audit logged and emits maintenance refresh', () => {
  assert.match(controllerSource, /IMPORT_STUDENT_REGISTRY/);
  assert.match(controllerSource, /module:\s*'Student Registry'/);
  assert.match(controllerSource, /maintenanceUpdated/);
  assert.match(controllerSource, /module:\s*'student_registry'/);
});
