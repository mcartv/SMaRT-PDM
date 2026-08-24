'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

const source = read('backend/services/applicationService.js');

test('Applicant Registry excludes archived/tombstoned application and student records', () => {
  assert.match(
    source,
    /COALESCE\(a\.is_archived, FALSE\) = FALSE/i
  );
  assert.match(
    source,
    /COALESCE\(st\.is_archived, FALSE\) = FALSE/i
  );
  assert.match(
    source,
    /username[\s\S]*NOT LIKE 'deleted-%'/i
  );
  assert.match(
    source,
    /email[\s\S]*NOT LIKE 'deleted-%'/i
  );
});

test('Applicant Registry deduplicates stale applications by student and opening', () => {
  assert.match(
    source,
    /function dedupeOperationalApplicationRows\(rows = \[\]\)/i
  );
  assert.match(
    source,
    /row\.student_id[\s\S]*row\.opening_id/i
  );
  assert.match(
    source,
    /current_application_id/i
  );
  assert.match(
    source,
    /const operationalRows = dedupeOperationalApplicationRows\(rows\)/i
  );
});

test('canonical current_application_id is preferred before timestamp fallback', () => {
  const currentCheck = source.indexOf('const rowIsCurrent');
  const timestampCheck = source.indexOf('const rowSubmittedAt');

  assert.notEqual(currentCheck, -1);
  assert.notEqual(timestampCheck, -1);
  assert.ok(
    currentCheck < timestampCheck,
    'current_application_id should be preferred before timestamp fallback'
  );
});
