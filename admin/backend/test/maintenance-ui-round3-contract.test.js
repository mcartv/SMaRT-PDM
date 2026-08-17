const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const srcRoot = path.resolve(__dirname, '../../frontend/src/pages/maintenance');
const read = (name) => fs.readFileSync(path.join(srcRoot, name), 'utf8');

test('general maintenance removes the redundant helper sentence and keeps System under General', () => {
  const source = read('GeneralPanel.jsx');
  assert.equal(source.includes('Switch between office details, landing content, application settings, and system tools.'), false);
  assert.match(source, /key: 'system', label: 'System'/);
  assert.match(source, /title="System"/);
  assert.equal(source.includes('System & OCR'), false);
});

test('maintenance top navigation stays compact on smaller desktops', () => {
  const source = read('Maintenance.jsx');
  assert.match(source, /text-xs font-medium transition 2xl:px-3 2xl:text-sm/);
  assert.match(source, /bg-white text-stone-900 shadow-sm/);
  assert.equal(source.includes("key: 'system', label: 'System'"), false);
});

test('maintenance primary color follows portal theme instead of hardcoded admin brown', () => {
  const maintenanceFiles = fs.readdirSync(srcRoot)
    .filter((name) => name.endsWith('.jsx'))
    .map((name) => read(name))
    .join('\n');
  assert.equal(/#7c4a2e|#6b3f27|#5c2d0e/i.test(maintenanceFiles), false);
  assert.match(read('components/MaintenanceShared.jsx'), /brownMid: 'var\(--portal-base\)'/);
});

test('accounts toolbar uses compact controls and theme-aware create buttons', () => {
  const source = read('AccountsPanel.jsx');
  assert.match(source, /Create Admin Account/);
  assert.match(source, /h-8 rounded-lg px-2\.5 text-xs font-semibold/);
  assert.match(source, /background: 'var\(--portal-accent-soft\)'/);
  assert.match(source, /Create Account/);
});

test('RO rows are responsive and use readable controls', () => {
  const source = read('ROSettingsPanel.jsx');
  assert.match(source, /md:flex-row md:items-center md:justify-between/);
  assert.match(source, /md:w-\[230px\]/);
  assert.match(source, /h-9 rounded-lg border-stone-200 px-3 text-sm/);
});

test('maintenance segmented filters use admin theme while the backup action stays neutral', () => {
  const registry = read('StudentRegistryPanel.jsx');
  const system = read('SystemPanel.jsx');
  assert.match(registry, /background: 'var\(--portal-base\)'/);
  assert.match(registry, /bg-\[var\(--portal-base\)\]/);
  assert.match(system, /border-stone-200 bg-white/);
});
