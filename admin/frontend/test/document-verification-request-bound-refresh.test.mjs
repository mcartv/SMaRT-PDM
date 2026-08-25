import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../src/pages/DocumentVerification.jsx', import.meta.url),
  'utf8'
);

test('fresh OCR polling requires the exact request and a fresh snapshot', () => {
  assert.match(source, /ocr-snapshot\?request_id=/);
  assert.match(source, /latestRequestId === requestId/);
  assert.match(source, /snapshot\?\.snapshot_fresh === true/);
  assert.match(
    source,
    /requestStatus === 'completed' && snapshotFresh/
  );
});

test('failed or timed-out fresh scans keep a blank override', () => {
  assert.match(source, /const setBlankIotOverride = \(/);
  assert.match(source, /No fresh OCR result was produced/);
  assert.doesNotMatch(source, /clearIotOverride/);
  assert.doesNotMatch(source, /delete next\[targetDocumentId\]/);
});

test('old persisted OCR cannot replace the waiting state during a fresh scan', () => {
  assert.match(
    source,
    /hasIotOverride\s*\?\s*iotOverride\?\.ocr\s*\|\|\s*\{\}\s*:\s*d\.ocr\s*\|\|\s*\{\}/
  );
  assert.match(source, /Waiting for fresh OCR result/);
});
