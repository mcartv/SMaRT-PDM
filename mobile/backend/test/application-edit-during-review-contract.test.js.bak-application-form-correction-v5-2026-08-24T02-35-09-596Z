'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'services', 'applicationService.js'),
  'utf8'
);

test('Pending Review application remains editable while document review or OCR is active', () => {
  assert.match(
    source,
    /const canEdit\s*=\s*pendingReview\s*&&\s*!selectionStarted\s*&&\s*!activated\s*;/
  );

  assert.doesNotMatch(
    source,
    /pendingReview\s*&&\s*!reviewStarted\s*&&\s*!selectionStarted/
  );

  assert.doesNotMatch(
    source,
    /Editing is unavailable because OSFA has already started reviewing this application\./
  );
});
