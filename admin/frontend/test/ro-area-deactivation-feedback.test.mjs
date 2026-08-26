import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(testDirectory, '..', 'src', 'pages', 'maintenance', 'ROSettingsPanel.jsx'),
  'utf8',
);

test('RO Area deactivation warns when an active coordinator is still assigned', () => {
  assert.match(source, /isDeactivating && department\.coordinator/);
  assert.match(source, /RO Area cannot be deactivated/);
  assert.match(source, /Remove or reassign the coordinator before deactivating this RO Area\./);
});

test('RO Area status failures also use top-right feedback', () => {
  const toggleSection = source.slice(
    source.indexOf('const toggleDepartment = async'),
    source.indexOf('const hasSearch ='),
  );

  assert.match(toggleSection, /showAppToast\('error', 'RO Area status not updated', message\)/);
  assert.doesNotMatch(toggleSection, /setError\(message\)/);
});
