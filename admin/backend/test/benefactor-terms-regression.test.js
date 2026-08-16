const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const panelSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/maintenance/BenefactorsPanel.jsx'),
  'utf8'
);
const serviceSource = fs.readFileSync(
  path.resolve(__dirname, '../services/benefactorService.js'),
  'utf8'
);
const reportSource = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/ReportGeneration.jsx'),
  'utf8'
);

test('maintenance UI consistently uses Benefactor Name terminology', () => {
  assert.match(panelSource, /Benefactor Name/);
  assert.doesNotMatch(panelSource, /Organization Name/i);
});

test('add and edit benefactor use the same benefactor_name field', () => {
  assert.match(panelSource, /Add Benefactor/);
  assert.match(panelSource, /Edit Benefactor/);
  assert.match(panelSource, /form\.benefactor_name/);
  assert.match(panelSource, /benefactor_name:\s*form\.benefactor_name\.trim\(\)/);
});

test('benefactor list and search use benefactor terminology', () => {
  assert.match(panelSource, /filteredBenefactors/);
  assert.match(panelSource, /b\.benefactor_name/);
  assert.match(panelSource, /Search/);
});

test('benefactor validation messages use Benefactor name', () => {
  assert.match(panelSource, /Benefactor name is required/i);
  assert.match(serviceSource, /'Benefactor name'/);
  assert.match(serviceSource, /'Benefactor type'/);
});

test('backend intentionally retains existing database field names', () => {
  assert.match(serviceSource, /\bbenefactor_name\b/);
  assert.match(serviceSource, /\bbenefactor_type\b/);
  assert.doesNotMatch(serviceSource, /\borganization_name\b/);
});

test('reports continue to use Benefactor terminology', () => {
  assert.match(reportSource, /Benefactor/i);
  assert.doesNotMatch(reportSource, /Organization Name/i);
});
