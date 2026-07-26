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

test('structured grade form renders a normalized GWA provisionally', () => {
  const activeDoc = {
    id: 'student_grade_forms',
    document_key: 'student_grade_forms',
    status: 'uploaded',
    ocr: {
      raw_text: 'PRIVATE FULL PAGE OCR',
      review_required: true,
      structured_fields: {
        document_type: 'student_grade_forms',
        review_required: true,
        contract_status: 'approved',
        fields: {
          general_weighted_average: {
            raw_text: '168',
            normalized_value: '1.68',
            success: true,
            value_source: 'crop_ocr_decimal_recovery',
          },
        },
      },
    },
  };

  const mapped = buildExtractedData(activeDoc, {
    student: { name: 'Application Profile Name' },
  });

  assert.equal(mapped.reviewOnly, true);
  assert.equal(mapped.manualReviewRequired, true);
  assert.deepEqual(mapped.extractedFields, [
    {
      label: 'General Weighted Average',
      value: '1.68',
      badge: 'Provisional OCR',
    },
  ]);
  assert.equal(buildRawOcrSnapshot(activeDoc), 'PRIVATE FULL PAGE OCR');
});

test('structured grade form renders an unnormalized OCR candidate', () => {
  const activeDoc = {
    id: 'student_grade_forms',
    document_key: 'student_grade_forms',
    status: 'uploaded',
    ocr: {
      raw_text: 'PRIVATE FULL PAGE OCR',
      review_required: true,
      structured_fields: {
        document_type: 'student_grade_forms',
        review_required: true,
        contract_status: 'approved',
        fields: {
          general_weighted_average: {
            raw_text: '168',
            normalized_value: '',
            success: false,
            issue_codes: ['gwa_decimal_not_confirmed'],
            value_source: 'crop_ocr_candidate',
          },
        },
      },
    },
  };

  const mapped = buildExtractedData(activeDoc, {
    student: { name: 'Application Profile Name' },
  });

  assert.equal(mapped.reviewOnly, true);
  assert.equal(mapped.manualReviewRequired, true);
  assert.deepEqual(mapped.extractedFields, [
    {
      label: 'GWA OCR Candidate',
      value: '168',
      badge: 'Unnormalized OCR',
      note: 'Decimal placement requires administrator verification.',
    },
  ]);
  assert.equal(buildRawOcrSnapshot(activeDoc), 'PRIVATE FULL PAGE OCR');
});

test('structured grade form without a candidate shows manual review state', () => {
  const mapped = buildExtractedData(
    {
      id: 'student_grade_forms',
      document_key: 'student_grade_forms',
      ocr: {
        review_required: true,
        structured_fields: {
          document_type: 'student_grade_forms',
          review_required: true,
          contract_status: 'approved',
          fields: {
            general_weighted_average: {
              raw_text: '',
              normalized_value: '',
              success: false,
              issue_codes: ['gwa_value_not_found'],
              value_source: 'none',
            },
          },
        },
      },
    },
    { student: { name: 'Application Profile Name' } }
  );

  assert.deepEqual(mapped.extractedFields, [
    {
      label: 'General Weighted Average',
      value: 'Not extracted',
      badge: 'Manual Review',
      note: 'The GWA value was not detected. Review the document manually.',
    },
  ]);
});

test('structured indigency fields render provisionally without identity matching', () => {
  const activeDoc = {
    id: 'certificate_of_indigency',
    document_key: 'certificate_of_indigency',
    status: 'pending',
    ocr: {
      raw_text: 'RAW DOCUMENT OCR',
      extracted_name: null,
      confidence: null,
      review_required: true,
      structured_fields: {
        document_type: 'certificate_of_indigency',
        review_required: true,
        contract_status: 'approved',
        fields: {
          certificate_subject_name: {
            raw_text: 'SUBJECT OCR',
            success: true,
          },
          issue_date: {
            raw_text: '',
            success: false,
          },
          issuing_barangay: {
            raw_text: 'SAMPLE BARANGAY',
            success: true,
          },
        },
      },
    },
  };

  const mapped = buildExtractedData(activeDoc, {
    student: { name: 'APPLICATION PROFILE NAME' },
  });

  assert.equal(mapped.manualReviewRequired, true);
  assert.equal(mapped.identityReview, null);
  assert.equal(mapped.reviewOnly, true);
  assert.deepEqual(mapped.extractedFields, [
    {
      label: 'Certificate Subject Name',
      value: 'SUBJECT OCR',
      badge: 'Provisional OCR',
    },
    {
      label: 'Issue Date',
      value: 'Not extracted',
      badge: 'Provisional OCR',
    },
    {
      label: 'Issuing Barangay',
      value: 'SAMPLE BARANGAY',
      badge: 'Provisional OCR',
    },
  ]);
  assert.equal(mapped.applicationMetadata[0].value, 'APPLICATION PROFILE NAME');
  assert.ok(
    mapped.extractedFields.every(
      (field) => field.value !== 'APPLICATION PROFILE NAME'
    )
  );
  assert.equal(activeDoc.status, 'pending');
});
