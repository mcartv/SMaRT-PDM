const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync(require.resolve('../../frontend/src/pages/DocumentVerification.jsx'), 'utf8');

test('Phase 5 exposes plain-language OCR operational states and collapsed diagnostics', () => {
  for (const label of ['Processing OCR', 'Retry scheduled', 'Retrying OCR', 'Ready for review', 'OCR unavailable', 'Technical details']) {
    assert.match(source, new RegExp(label));
  }
  assert.match(source, /OCR processing continues in the background/);
  assert.match(source, /The captured document is preserved and will be retried automatically/);
  assert.match(source, /Using the existing captured document/);
  assert.match(source, /<details className=/);
});

test('Phase 5 keeps preview and OCR status independent', () => {
  assert.match(source, /Preview is taking longer than expected/);
  assert.match(source, /OCR results remain available for review/);
  assert.match(source, /Retry Preview/);
  assert.match(source, /Structured OCR/);
  assert.match(source, /Full-page OCR/);
});
