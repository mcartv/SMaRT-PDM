const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const backendRoot = path.resolve(__dirname, '..');
const adminRoot = path.resolve(backendRoot, '..');
const repoRoot = path.resolve(adminRoot, '..');

const read = (file) => fs.readFileSync(file, 'utf8');
const backend = (relative) => read(path.join(backendRoot, relative));
const frontend = (relative) => read(path.join(adminRoot, 'frontend', relative));

const queue = frontend('src/pages/EndorsementQueue.jsx');
const detail = frontend('src/pages/EndorsementSlipDetail.jsx');
const eligibility = frontend('src/utils/endorsementEligibility.js');
const adminDocumentReview = frontend('src/pages/DocumentVerification.jsx');
const service = backend('services/endorsementSlipService.js');
const controller = backend('controllers/endorsementSlipController.js');
const migration = read(
  path.join(
    repoRoot,
    'supabase',
    'migrations',
    '20260825200000_remove_pd_grade_ocr_endorsement_gate.sql'
  )
);

const pdActionSection = service.slice(service.indexOf('async function applyStageAction'));
const pdPayloadMarkerIndex = service.indexOf('// SMART-PDM_PD_OCR_GRADE_VALIDATION_REMOVED_V1');
const pdBranchStart = service.indexOf(": actorRole === 'pd'", pdPayloadMarkerIndex);
const pdBranchEnd = service.indexOf(': {}),', pdBranchStart);
const pdQueuePayloadSection = service.slice(pdBranchStart, pdBranchEnd);

test('Remove OCR Grade Validation UI requirement from the PD workflow only', () => {
  assert.doesNotMatch(
    queue,
    /OCR Grade Validation|grade_validation|ocr_missing|ocr_failed|gwa_missing|gwa_invalid|extracted_gwa/i
  );
  assert.doesNotMatch(
    detail,
    /OCR Grade Validation|grade_validation|ocr_missing|ocr_failed|gwa_missing|gwa_invalid|extracted_gwa/i
  );
  assert.match(adminDocumentReview, /OCRPanel|gradeOcrVersion|Grade Report/);
});

test('Remove PD-only OCR/GWA validation blocking from the frontend', () => {
  assert.match(eligibility, /gradeUploaded === true/);
  assert.doesNotMatch(eligibility, /ocrStatus|gradeValidation|extractedGwa|gwa/i);
  assert.doesNotMatch(
    queue,
    /disabled=.*gradeValidation|disabled=.*ocr|disabled=.*gwa/i
  );
});

test('Do not remove Grade Report document visibility', () => {
  assert.match(queue, /Grade Report Preview/);
  assert.match(queue, /A Grade Report is required for Program Director review/);
  assert.match(detail, /document_type.*grade report/i);
  assert.match(controller, /document_type.*grade report/i);
});

test("Keep other roles' OCR/document-validation behavior unchanged", () => {
  assert.match(adminDocumentReview, /birthOcrVersion/);
  assert.match(adminDocumentReview, /gradeOcrVersion/);
  assert.match(adminDocumentReview, /indigencyOcrVersion/);
  assert.match(adminDocumentReview, /OCRPanel/);
});

test('PD backend/database validation does not block endorsement on Grade OCR/GWA', () => {
  assert.doesNotMatch(
    pdActionSection,
    /grade_validation|ocr_missing|ocr_failed|gwa_missing|gwa_invalid|OCR grade validation/i
  );
  assert.match(pdActionSection, /gradeDocumentResult/);
  assert.match(migration, /drop trigger if exists trg_enforce_pd_grade_validation/i);
  assert.doesNotMatch(migration, /delete\s+from|truncate\s+|drop\s+table/i);
});

test('PD can endorse using the intended Grade Report review requirements', () => {
  assert.match(queue, /Preview the applicant's Grade Report before recording a scholastic standing/);
  assert.match(queue, /good_scholastic_standing/);
  assert.match(queue, /average_scholastic_standing/);
  assert.match(service, /A Grade Report is required for Program Director review/);
});

test('Preserve PD Remarks and endorsement decision workflow', () => {
  assert.match(queue, /Optional remarks/);
  assert.match(queue, /Confirm Endorsement/);
  assert.match(queue, /scholastic_standing/);
  assert.match(service, /normalizePdAction/);
});

test('Verify realtime endorsement updates', () => {
  assert.match(queue, /useSocketEvent\('endorsement:updated'/);
  assert.match(controller, /socketEvents\.endorsementUpdated/);
});

test('Admin OCR validation remains available and PD payload excludes Admin OCR metadata', () => {
  assert.match(adminDocumentReview, /Grade Report/);
  assert.match(adminDocumentReview, /OCRPanel/);
  assert.match(service, /actorRole === 'admin'/);
  assert.match(pdQueuePayloadSection, /grade_document:/);
  assert.doesNotMatch(pdQueuePayloadSection, /grade_summary:/);
  assert.match(controller, /delete pdPayload\.grade_summary/);
});
