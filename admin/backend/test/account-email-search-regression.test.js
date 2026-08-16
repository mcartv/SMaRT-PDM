const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.resolve(__dirname, '../../frontend/src/pages/maintenance/AccountsPanel.jsx'),
  'utf8'
);

test('account search includes email address', () => {
  assert.match(
    source,
    /String\(account\.email \|\| ''\)\.toLowerCase\(\)\.includes\(q\)/
  );
});

test('account email search supports partial and case-insensitive matching', () => {
  assert.match(source, /const q = search\.trim\(\)\.toLowerCase\(\)/);
  assert.match(source, /account\.email[\s\S]*?includes\(q\)/);
});

test('existing name search remains supported', () => {
  assert.match(source, /account\.name/);
  assert.match(source, /account\.first_name/);
  assert.match(source, /account\.last_name/);
});

test('role filtering is preserved before text search', () => {
  assert.match(source, /accountMatchesRoleGroup\(account,\s*roleFilter\)/);
  assert.match(source, /roleFilter/);
});

test('account search is local and does not issue a backend request per keystroke', () => {
  assert.match(source, /const filteredAccounts = useMemo/);
  assert.match(source, /return accounts\.filter/);

  const filteredBlock = source.match(
    /const filteredAccounts = useMemo\(\(\) => \{([\s\S]*?)\n\s*\}, \[accounts, search, pageTab, roleFilter, courseFilter\]\);/
  );

  assert.ok(filteredBlock, 'Expected local filteredAccounts useMemo block.');
  assert.doesNotMatch(filteredBlock[1], /\bfetch\s*\(/);
});

test('account panel retains a no-results/empty-state implementation', () => {
  assert.match(source, /EmptyState/);
});

test('search input remains live for character-by-character narrowing', () => {
  assert.match(source, /value=\{search\}/);
  assert.match(source, /setSearch\(event\.target\.value\)|setSearch\(e\.target\.value\)/);
});
