const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../../frontend/src/pages/DocumentVerification.jsx'), 'utf8');

test('Phase 5 exposes plain-language OCR operational states and collapsed diagnostics', () => {
  for (const label of ['Processing OCR', 'Ready for review', 'OCR unavailable']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /OCR processing continues in the background/);
  assert.match(source, /ACTIVE_IOT_OCR_STATUSES/);
  assert.match(source, /IOT_OCR_STATUS_MESSAGES\[iotOcrStatus\]/);
  assert.match(source, /humanOcrError\(reviewCandidate\?\.error_code/);
  assert.match(source, /<details className=/);
  assert.match(source, /<summary[^>]*>Raw OCR<\/summary>/);
});

test('Phase 5 keeps preview and OCR status independent', () => {
  assert.match(source, /Preview is taking longer than expected/);
  assert.match(source, /OCR results remain available for review/);
  assert.match(source, /Retry Preview/);
  assert.match(source, /Structured OCR/);
  assert.match(source, /Full-page OCR transcription/);
  assert.match(source, /Version 1 - Local OCR/);
  assert.match(source, /Version 2 - Enhanced OCR/);
});
