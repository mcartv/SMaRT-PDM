import test from 'node:test';
import assert from 'node:assert/strict';
import { currentOcrCandidate } from '../src/lib/currentOcrCandidate.js';

test('a failed new V2 scan cannot display or confirm an older V1 candidate', () => {
  const old = { request_id: 'old', document_key: 'student_grade_forms', status: 'review_required', ocr_version: 'v1' };
  assert.equal(currentOcrCandidate(old, { request_id: 'new', status: 'failed' }, old.document_key), null);
  assert.equal(currentOcrCandidate(old, { request_id: 'old', status: 'failed' }, old.document_key), null);
  assert.equal(currentOcrCandidate(old, { request_id: 'old', status: 'review_required' }, old.document_key), old);
  assert.equal(currentOcrCandidate(old, null, 'certificate_of_indigency'), null);
});
