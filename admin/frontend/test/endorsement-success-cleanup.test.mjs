import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const queueSource = fs.readFileSync(
  path.join(testDirectory, '..', 'src', 'pages', 'EndorsementQueue.jsx'),
  'utf8',
);

test('all successful office endorsements close the review previews and keep toast feedback', () => {
  const successSection = queueSource.slice(
    queueSource.indexOf("if (!response.ok) throw new Error(data.message || 'Failed to save endorsement')"),
    queueSource.indexOf('await loadQueue({ soft: true });'),
  );

  assert.match(successSection, /setSelectedRow\(null\)/);
  assert.match(successSection, /setGradePreview\(null\)/);
  assert.match(successSection, /setProfilePreview\(null\)/);
  assert.match(successSection, /toast\.success\('Endorsement saved'/);
  assert.doesNotMatch(successSection, /queueKey\s*===\s*['"]sdo['"]/);
});

test('PD endorsement remains locked until the applicant Grade Report is previewed', () => {
  assert.match(queueSource, /previewedGradeSlipIds/);
  assert.match(queueSource, /new Set\(current\)\.add\(preview\.slipId\)/);
  assert.match(queueSource, /disabled=\{!gradeDocumentReady \|\| !gradePreviewed \|\| saving\}/);
  assert.match(queueSource, /Preview the applicant's Grade Report before Program Director endorsement\./);
  assert.match(queueSource, /confirmBlockedByUnviewedGrade/);
});

test('PD review presents the uploaded Grade Report without admin OCR metadata', () => {
  assert.doesNotMatch(queueSource, /OCR GWA/);
  assert.doesNotMatch(queueSource, /Grade OCR Evidence/);
  assert.match(queueSource, /hasUploadedGrade\(row\) \? 'Uploaded' : 'Not uploaded'/);
  assert.doesNotMatch(queueSource, /Submitted GWA/);
  assert.doesNotMatch(queueSource, /applicant_gwa/);
});
