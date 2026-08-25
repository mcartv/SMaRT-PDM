import assert from 'node:assert/strict';
import test from 'node:test';
import { canPdEndorse } from '../src/utils/endorsementEligibility.js';

test('PD eligibility depends only on Grade Report presence', () => {
  for (const ocrStatus of ['ocr_missing', 'pending', 'processing', 'failed', 'review_required', 'completed', 'gwa_missing']) {
    assert.equal(canPdEndorse({ gradeUploaded: true, ocrStatus }), true, ocrStatus);
  }
  assert.equal(canPdEndorse({ gradeUploaded: false }), false);
});
