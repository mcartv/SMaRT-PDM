import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(
  new URL('../src/pages/DocumentVerification.jsx', import.meta.url),
  'utf8'
);

test('OCR mode remains visible after a candidate is confirmed', () => {
  assert.match(source, />Mode<\/span>/);
  assert.doesNotMatch(source, /!runningIotOcr\s*&&\s*!reviewCandidate\s*\?/);
  assert.match(source, /disabled=\{runningIotOcr\}/);
  assert.match(source, /Applied to the next OCR request/);
});
