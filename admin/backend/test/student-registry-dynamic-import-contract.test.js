'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('Student Registry preview uses the uploaded file column set instead of a fixed display schema', () => {
  const panel = read('frontend/src/pages/maintenance/StudentRegistryPanel.jsx');
  assert.match(panel, /buildDisplayColumns/);
  assert.match(panel, /setExcelHeaders\(headers\)/);
  assert.match(panel, /useState\(\[\]\).*lastImportedHeaders/s);
  assert.match(panel, /buildImportedHeaders\(registry, lastImportedHeaders\)/);
  assert.match(panel, /raw_snapshot/);
});

test('Imported registry rows preserve source-specific blanks across different Excel schemas', () => {
  const panel = read('frontend/src/pages/maintenance/StudentRegistryPanel.jsx');
  assert.match(panel, /REGISTRY_HEADER_ORDER_KEY/);
  assert.match(panel, /hasOwnProperty\.call\(snapshot, header\)/);
  assert.match(panel, /Object\.fromEntries/);
});

test('Student Registry keeps Supabase canonical columns fixed while storing arbitrary source columns in raw_snapshot', () => {
  const service = read('backend/services/studentRegistryService.js');
  assert.match(service, /MASTER_TABLE = 'student_master_records'/);
  assert.match(service, /raw_snapshot: mergeRegistrySnapshot\(/);
  assert.match(service, /HEADER_ORDER_META_KEY/);
  assert.match(service, /source_headers: sourceHeaders/);
});

test('Missing optional boolean columns stay blank instead of becoming false', () => {
  const service = read('backend/services/studentRegistryService.js');
  assert.match(service, /parseNullableBoolean/);
  assert.match(service, /financial_support_parents:[\s\S]*?\? parseNullableBoolean[\s\S]*?: null/);
  assert.match(service, /has_been_scholar:[\s\S]*?\? parseNullableBoolean[\s\S]*?: null/);
});

test('CSV imports support quoted commas and quoted fields', () => {
  const service = read('backend/services/studentRegistryService.js');
  assert.match(service, /function parseCsvLine/);
  assert.match(service, /function parseCsvRows/);
  assert.match(service, /return parseCsvRows\(file\.buffer\.toString\('utf8'\)\)/);
});

test('Student Registry UI shows import counts and failed-row review details', () => {
  const panel = read('frontend/src/pages/maintenance/StudentRegistryPanel.jsx');
  assert.match(panel, /Import completed with issues/);
  assert.match(panel, /View failed rows/);
  assert.match(panel, /Identity conflict details/);
  assert.match(panel, /Existing Registry Record/);
  assert.match(panel, /Uploaded Row/);
});

test('registry import and display normalize dates, phone numbers, and Excel email objects', () => {
  const service = read('backend/services/studentRegistryService.js');
  const panel = read('frontend/src/pages/maintenance/StudentRegistryPanel.jsx');
  assert.match(service, /function unwrapWorkbookCellValue/);
  assert.match(service, /function normalizePhilippinePhone/);
  assert.match(service, /function normalizeEmailAddress/);
  assert.match(service, /replace\(\/\^mailto:\/i, ''\)/);
  assert.match(panel, /function formatRegistryDate/);
  assert.match(panel, /`\$\{match\[2\]\}\/\$\{match\[3\]\}\/\$\{match\[1\]\}`/);
  assert.match(panel, /function formatRegistryPhone/);
  assert.match(panel, /formatRegistryCellValue\(column\.label, row\[column\.index\]\)/);
  assert.match(panel, /text\.toLowerCase\(\) === '\[object object\]' \? '' : text/);
});
