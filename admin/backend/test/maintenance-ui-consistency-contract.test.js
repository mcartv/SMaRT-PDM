const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const page = (name) => fs.readFileSync(
  path.resolve(__dirname, `../../frontend/src/pages/maintenance/${name}`),
  'utf8'
);

const maintenance = page('Maintenance.jsx');
const general = page('GeneralPanel.jsx');
const system = page('SystemPanel.jsx');
const filterPanels = [
  page('AccountsPanel.jsx'),
  page('BenefactorsPanel.jsx'),
  page('CoursesPanel.jsx'),
  page('ProgramsPanel.jsx'),
  page('ROSettingsPanel.jsx'),
];

test('Maintenance uses neutral, consistently sized segmented navigation', () => {
  assert.match(maintenance, /inline-flex min-w-max items-center gap-1 rounded-xl bg-stone-100 p-1/);
  assert.match(maintenance, /h-9 shrink-0 items-center/);
  assert.match(maintenance, /bg-white text-stone-900 shadow-sm/);
  assert.doesNotMatch(maintenance, /key: 'system'/);
  assert.doesNotMatch(maintenance, /case 'system'/);
});

test('System and OCR controls live under General maintenance', () => {
  assert.match(general, /key: 'system', label: 'System & OCR'/);
  assert.match(general, /<SystemPanel embedded \/>/);
  assert.match(general, /application settings, and system tools/);
});

test('System cards use the normal Maintenance typography scale', () => {
  assert.match(system, /text-lg font-semibold/);
  assert.match(system, /text-xs font-medium uppercase/);
  assert.match(system, /Run Manual DB Backup/);
  assert.doesNotMatch(system, /text-2xl/);
  assert.doesNotMatch(system, /text-\[10px\]/);
});

test('Maintenance record filters use neutral segmented controls instead of colored active pills', () => {
  for (const source of filterPanels) {
    assert.match(source, /inline-flex items-center gap-1 rounded-xl bg-stone-100 p-1/);
    assert.match(source, /bg-white text-stone-900 shadow-sm/);
    assert.doesNotMatch(source, /pageTab === '[^']+'[\s\S]{0,180}bg-\[#7c4a2e\] text-white/);
  }
});
