import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const detailSource = fs.readFileSync(
  path.join(testDirectory, '..', 'src', 'pages', 'EndorsementSlipDetail.jsx'),
  'utf8',
);

test('PD endorsement detail omits the obsolete OCR warning and stored PDF action', () => {
  assert.doesNotMatch(detailSource, /grade_validation\?\.blocking_reason/);
  assert.doesNotMatch(detailSource, /Open Stored Final PDF/);
  assert.doesNotMatch(detailSource, /OCR GWA/);
  assert.doesNotMatch(detailSource, /Grade Validation/);
  assert.doesNotMatch(detailSource, /Submitted GWA/);
  assert.doesNotMatch(detailSource, /applicant_gwa/);
});
