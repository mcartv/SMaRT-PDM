'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'applicationService.js'),
  'utf8'
);

test('review/OCR locks submitted application editing', () => {
  assert.match(
    source,
    /pendingReview\s*&&\s*!reviewStarted\s*&&\s*!selectionStarted\s*&&\s*!activated/
  );

  assert.match(
    source,
    /Editing is unavailable because OSFA has already started reviewing this application\./
  );
});
