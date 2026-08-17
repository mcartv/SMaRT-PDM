const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const frontendRoot = path.resolve(__dirname, '../../frontend/src/pages');
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), 'utf8');

test('maintenance filter tabs use the admin portal theme and omit tab counts', () => {
  const files = [
    'maintenance/AccountsPanel.jsx',
    'maintenance/BenefactorsPanel.jsx',
    'maintenance/ProgramsPanel.jsx',
    'maintenance/CoursesPanel.jsx',
    'maintenance/ROSettingsPanel.jsx',
    'maintenance/GeneralPanel.jsx',
    'maintenance/StudentRegistryPanel.jsx',
    'maintenance/AcademicYearPanel.jsx',
  ];
  const source = files.map(read).join('\n');
  assert.match(source, /background: 'var\(--portal-base\)'/);
  assert.equal(/Current \(\{currentCount\}\)|Archived \(\{archivedCount\}\)|Inactive \(\{inactiveCount\}\)/.test(source), false);
  assert.equal(source.includes('Preview ({excelRows.length})'), false);
  assert.equal(source.includes('Imported ({total})'), false);
});

test('payout segmented filters use admin theme and no longer show count badges', () => {
  const source = read('PayoutManagement.jsx');
  assert.match(source, /style=\{workspaceView === key \? \{ background: 'var\(--portal-base\)' \} : undefined\}/);
  assert.match(source, /style=\{activeSection === key \? \{ background: 'var\(--portal-base\)' \} : undefined\}/);
  assert.equal(source.includes('Number(count)'), false);
});

test('General maintenance names the section System without OCR in the tab/title', () => {
  const source = read('maintenance/GeneralPanel.jsx');
  assert.match(source, /key: 'system', label: 'System'/);
  assert.match(source, /title="System"/);
  assert.equal(source.includes('System & OCR'), false);
});

test('manual database backup remains a neutral secondary action', () => {
  const source = read('maintenance/SystemPanel.jsx');
  assert.match(source, /Run Manual DB Backup/);
  assert.match(source, /border-stone-200 bg-white/);
  const buttonIndex = source.indexOf('Run Manual DB Backup');
  const nearby = source.slice(Math.max(0, buttonIndex - 400), buttonIndex + 100);
  assert.equal(nearby.includes("var(--portal-base)"), false);
});
