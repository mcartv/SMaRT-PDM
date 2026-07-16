import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

globalThis.window = { location: { origin: 'http://localhost' } };
globalThis.sessionStorage = { getItem: () => null };

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

const {
  REVIEW_ONLY_DOCUMENT_KEYS,
  REVIEW_ONLY_MESSAGES,
  buildExtractedData,
  buildRawOcrSnapshot,
  formatOcrConfidence,
} = await vite.ssrLoadModule('/src/pages/DocumentVerification.jsx');

after(async () => {
  await vite.close();
});

test('review-only contract keys and messages are exact', () => {
  assert.deepEqual(
    [...REVIEW_ONLY_DOCUMENT_KEYS],
    ['certificate_of_indigency', 'student_grade_forms']
  );
  assert.deepEqual(
    [...REVIEW_ONLY_MESSAGES],
    ['Structured extraction not implemented', 'Manual review required']
  );
});

test('mismatched indigency scan keeps profile data separate from OCR text', () => {
  const activeDoc = {
    id: 'certificate_of_indigency',
    document_key: 'certificate_of_indigency',
    status: 'pending',
    ocr: {
      extracted_name: 'Pedro Jose Fernandez Torres',
      confidence: 0.99,
      raw_text: 'MS. VENICE EVE PELIMA',
      scanned_via_iot: true,
    },
  };
  const application = {
    student: {
      name: 'Pedro Jose Fernandez Torres',
      pdm_id: 'PDM-001',
      program: 'Scholarship',
      course: 'BSIT',
    },
  };

  const mapped = buildExtractedData(activeDoc, application);

  assert.equal(mapped.reviewOnly, true);
  assert.equal(mapped.confidence, 'Unavailable');
  assert.equal(mapped.extractedFields.length, 0);
  assert.equal(mapped.applicationMetadata[0].value, 'Pedro Jose Fernandez Torres');
  assert.ok(mapped.applicationMetadata.every((item) => item.badge === 'Application'));
  assert.equal(buildRawOcrSnapshot(activeDoc), 'MS. VENICE EVE PELIMA');
  assert.equal(activeDoc.status, 'pending');
  assert.deepEqual(
    [...REVIEW_ONLY_MESSAGES],
    ['Structured extraction not implemented', 'Manual review required']
  );
  assert.ok(mapped.applicationMetadata.every((item) => item.badge === 'Application'));
  assert.ok(mapped.extractedFields.every((item) => item.label !== 'Extracted Name'));
});

test('real extracted name appears only for an implemented contract', () => {
  const mapped = buildExtractedData(
    {
      id: 'certificate_of_registration',
      document_key: 'certificate_of_registration',
      ocr: { extracted_name: 'OCR Name', raw_text: 'OCR Name' },
    },
    { student: { name: 'Application Name' } }
  );

  assert.deepEqual(mapped.extractedFields, [
    { label: 'Extracted Name', value: 'OCR Name', badge: 'Extracted' },
  ]);
  assert.equal(mapped.applicationMetadata[0].value, 'Application Name');
});

test('confidence formatting distinguishes ratios, percentages, and IoT placeholder', () => {
  assert.equal(formatOcrConfidence(0.99, true), 'Unavailable');
  assert.equal(formatOcrConfidence(0.99, false), '99%');
  assert.equal(formatOcrConfidence(0.85, true), '85%');
  assert.equal(formatOcrConfidence(85, true), '85%');
  assert.equal(formatOcrConfidence(null, true), 'Unavailable');
});

test('grade-form review-only behavior remains unchanged', () => {
  const activeDoc = {
    id: 'student_grade_forms',
    document_key: 'student_grade_forms',
    status: 'pending',
    ocr: {
      raw_text: 'GRADE FORM RAW OCR',
      confidence: 0.99,
      scanned_via_iot: true,
      structured_fields: {
        document_type: 'student_grade_forms',
        review_required: true,
        contract_status: 'pending_approval',
        fields: {},
      },
      review_required: true,
    },
  };

  const mapped = buildExtractedData(activeDoc, {
    student: { name: 'Application Profile Name' },
  });

  assert.equal(mapped.reviewOnly, true);
  assert.equal(mapped.confidence, 'Unavailable');
  assert.equal(mapped.extractedFields.length, 0);
  assert.equal(buildRawOcrSnapshot(activeDoc), 'GRADE FORM RAW OCR');
  assert.equal(activeDoc.status, 'pending');
});
