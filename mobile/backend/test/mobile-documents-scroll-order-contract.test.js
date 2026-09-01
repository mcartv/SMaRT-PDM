'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
  path.resolve(
    __dirname,
    '..',
    '..',
    'frontend',
    'lib',
    'features',
    'applicant',
    'presentation',
    'screens',
    'applicant_documents_screen.dart'
  ),
  'utf8'
);

test('not-yet-uploaded document cards sort before submitted files', () => {
  assert.match(
    source,
    /if \(a\.isSubmitted != b\.isSubmitted\) return a\.isSubmitted \? 1 : -1;/
  );
});

test('background refresh does not insert content above the scrolling list', () => {
  assert.doesNotMatch(
    source,
    /if \(_isRefreshing && !_isLoading\)[\s\S]*?LinearProgressIndicator/
  );
  assert.match(source, /Duration\(seconds: 30\)/);
});

test('documents list preserves its scroll position and bottom clearance', () => {
  assert.match(source, /PageStorageKey<String>\('applicant-required-documents'\)/);
  assert.match(source, /controller: _scrollController/);
  assert.match(source, /AlwaysScrollableScrollPhysics/);
  assert.match(source, /EdgeInsets\.fromLTRB\(16, 16, 16, 32\)/);
  assert.match(source, /_scrollController\.dispose\(\)/);
});
