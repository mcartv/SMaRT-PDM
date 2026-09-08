import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(
  path.join(testDirectory, '..', 'src', 'pages', 'ScholarshipOpenings.jsx'),
  'utf8',
);

test('every scholarship opening lifecycle action is routed through the confirmation modal', () => {
  for (const action of ['open', 'close', 'draft', 'reopen', 'archive', 'restore']) {
    assert.match(source, new RegExp(`requestStatusAction\\('${action}'`));
  }

  assert.match(source, /<OpeningActionConfirmModal/);
  assert.match(source, /Action warning/);
  assert.match(source, /onConfirm=\{confirmStatusAction\}/);
  assert.match(source, /const \{ theme \} = usePortalTheme\('admin'\)/);
  assert.match(source, /buttonColor=\{theme\.base\}/);
  assert.match(source, /backgroundColor: buttonColor/);
  assert.doesNotMatch(source, /var\(--portal-base, #6f4b33\)/);
});

test('scholarship openings uses in-app notice modals instead of browser alerts', () => {
  assert.match(source, /<OpeningNoticeModal/);
  assert.doesNotMatch(source, /\b(?:window\.)?alert\s*\(/);
  assert.doesNotMatch(source, /\bwindow\.confirm\s*\(/);
});
