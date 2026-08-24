'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'applicationService.js'),
  'utf8'
);

test('submitted form backfills persisted values without draft contamination', () => {
  assert.match(
    source,
    /async function getMyFormData\(userId,\s*options\s*=\s*\{\}\)/
  );
  assert.match(
    source,
    /const includeDraft\s*=\s*options\?\.includeDraft\s*!==\s*false/
  );
  assert.match(
    source,
    /getMyFormData\(\s*userId,\s*\{\s*includeDraft:\s*false\s*\}\s*\)/
  );
  assert.match(
    source,
    /mergeMissingSubmissionValues\(\s*formData,\s*normalizedFormData/
  );
  assert.match(
    source,
    /submission_date:\s*application\.submission_date\s*\|\|\s*null/
  );
});
