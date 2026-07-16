const test = require('node:test');
const assert = require('node:assert/strict');

for (const dependency of [
  '../config/supabase',
  '../config/db',
  '../services/iotOcrRequestService',
]) {
  const dependencyPath = require.resolve(dependency);
  require.cache[dependencyPath] = {
    id: dependencyPath,
    filename: dependencyPath,
    loaded: true,
    exports: {},
  };
}

const {
  buildOcrOnlyDocument,
  buildOcrProjection,
  buildStructuredOcrPersistence,
  normalizeOcrPayload,
  sanitizeStructuredOcrFields,
} = require('../services/applicationService');

const birthFields = {
  document_type: 'birth_certificate',
  review_required: true,
  ocr_attempts: 3,
  preprocessing_variant: 'registered_whole_row_ocr',
  fields: {
    child_name: {
      raw_text: 'CHILD OCR',
      review_required: true,
      success: true,
    },
    mother_maiden_name: {
      raw_text: 'MOTHER OCR',
      review_required: true,
      success: true,
    },
    father_name: {
      raw_text: 'FATHER OCR',
      review_required: true,
      success: true,
    },
    unrelated_field: {
      raw_text: 'SHOULD NOT SURVIVE',
      review_required: false,
    },
  },
};

const sourcePayload = {
  worker_status: 'review_required',
  registration_status: 'success',
  cropper_status: 'success',
  ocr_status: 'review_required',
  registration_issue_codes: [],
  cropper_issue_codes: [],
  ocr_issue_codes: ['OCR_MANUAL_REVIEW_REQUIRED'],
  structured_field_keys: [
    'father_name',
    'child_name',
    'mother_maiden_name',
    'unrelated_field',
  ],
  manual_review_required: true,
  ocr_attempts: 3,
  preprocessing_variant: 'registered_whole_row_ocr',
  student_name: 'PROFILE NAME MUST NOT BE STORED',
  application_id: 'application-id-must-not-be-stored',
};

test('birth structured fields retain exactly the three semantic OCR rows', () => {
  const structured = sanitizeStructuredOcrFields(
    'birth_certificate',
    birthFields
  );

  assert.deepEqual(Object.keys(structured.fields).sort(), [
    'child_name',
    'father_name',
    'mother_maiden_name',
  ]);
  assert.equal(structured.fields.child_name.raw_text, 'CHILD OCR');
  assert.equal(structured.ocr_attempts, 3);
  assert.equal(
    structured.preprocessing_variant,
    'registered_whole_row_ocr'
  );
  assert.equal(structured.extracted_name, undefined);
});

test('persistence keeps safe processing metadata and review state', () => {
  const persistence = buildStructuredOcrPersistence({
    documentKey: 'birth_certificate',
    extractedFields: birthFields,
    sourcePayload,
  });

  assert.equal(persistence.ocr_review_required, true);
  assert.deepEqual(persistence.ocr_processing_metadata, {
    worker_status: 'review_required',
    registration_status: 'success',
    cropper_status: 'success',
    ocr_status: 'review_required',
    registration_issue_codes: [],
    cropper_issue_codes: [],
    ocr_issue_codes: ['OCR_MANUAL_REVIEW_REQUIRED'],
    structured_field_keys: [
      'child_name',
      'father_name',
      'mother_maiden_name',
    ],
    ocr_attempts: 3,
    preprocessing_variant: 'registered_whole_row_ocr',
  });
  assert.equal(persistence.ocr_processing_metadata.student_name, undefined);
  assert.equal(persistence.ocr_processing_metadata.application_id, undefined);
});

test('normalized transport exposes the worker source payload directly', () => {
  const normalized = normalizeOcrPayload({
    raw_text: '',
    extracted_fields: birthFields,
    source_payload: sourcePayload,
  });

  assert.equal(normalized.source_payload, sourcePayload);
  assert.equal(normalized.source_payload.worker_status, 'review_required');
});

test('documents projection exposes nested structured OCR with empty legacy values', () => {
  const persistence = buildStructuredOcrPersistence({
    documentKey: 'birth_certificate',
    extractedFields: birthFields,
    sourcePayload,
  });
  const ocr = buildOcrProjection({
    document_id: 'ocr-document-id',
    document_key: 'birth_certificate',
    document_type: 'Birth Certificate / PSA',
    scanned_via_iot: true,
    ocr_extracted_name: null,
    ocr_extracted_gwa: null,
    ocr_confidence: null,
    ocr_raw_text: '',
    ...persistence,
  });

  assert.equal(ocr.extracted_name, null);
  assert.equal(ocr.raw_text, '');
  assert.equal(ocr.review_required, true);
  assert.deepEqual(
    Object.keys(ocr.structured_fields.fields).sort(),
    ['child_name', 'father_name', 'mother_maiden_name']
  );

  const document = buildOcrOnlyDocument({
    documentKey: 'birth_certificate',
    ocr,
  });

  assert.equal(document.status, 'pending');
  assert.equal(document.url, null);
  assert.equal(document.ocr, ocr);
});

test('legacy OCR projection remains unchanged and defaults JSON fields to objects', () => {
  const ocr = buildOcrProjection({
    document_key: 'certificate_of_registration',
    ocr_extracted_name: 'LEGACY OCR NAME',
    ocr_extracted_gwa: 1.25,
    ocr_confidence: 0.91,
    ocr_raw_text: 'LEGACY RAW OCR',
    ocr_structured_fields: null,
    ocr_processing_metadata: null,
  });

  assert.equal(ocr.extracted_name, 'LEGACY OCR NAME');
  assert.equal(ocr.extracted_gwa, 1.25);
  assert.equal(ocr.confidence, 0.91);
  assert.equal(ocr.raw_text, 'LEGACY RAW OCR');
  assert.deepEqual(ocr.structured_fields, {});
  assert.deepEqual(ocr.processing_metadata, {});
  assert.equal(ocr.review_required, false);
});

test('a re-scan replaces the current structured snapshot', () => {
  const persistence = buildStructuredOcrPersistence({
    documentKey: 'birth_certificate',
    extractedFields: {
      ...birthFields,
      fields: {
        ...birthFields.fields,
        child_name: {
          raw_text: 'NEW CHILD OCR',
          review_required: true,
        },
      },
    },
    sourcePayload,
    existingStructuredFields: {
      document_type: 'birth_certificate',
      fields: {
        child_name: { raw_text: 'OLD CHILD OCR' },
      },
    },
  });

  assert.equal(
    persistence.ocr_structured_fields.fields.child_name.raw_text,
    'NEW CHILD OCR'
  );
  assert.notEqual(
    persistence.ocr_structured_fields.fields.child_name.raw_text,
    'OLD CHILD OCR'
  );
});

test('manual raw-text saves preserve an existing structured snapshot', () => {
  const existingStructuredFields = sanitizeStructuredOcrFields(
    'birth_certificate',
    birthFields
  );
  const persistence = buildStructuredOcrPersistence({
    documentKey: 'birth_certificate',
    extractedFields: null,
    sourcePayload: null,
    existingStructuredFields,
    existingReviewRequired: true,
    existingProcessingMetadata: {
      worker_status: 'review_required',
    },
  });

  assert.deepEqual(
    persistence.ocr_structured_fields,
    existingStructuredFields
  );
  assert.equal(persistence.ocr_review_required, true);
  assert.deepEqual(persistence.ocr_processing_metadata, {
    worker_status: 'review_required',
  });
});

test('indigency review-only contract persists without fabricated fields', () => {
  const extractedFields = {
    document_type: 'certificate_of_indigency',
    review_required: true,
    contract_status: 'pending_approval',
    source_regions: ['Applicant name', 'Address', 'Issue date'],
    fields: {},
  };
  const persistence = buildStructuredOcrPersistence({
    documentKey: 'certificate_of_indigency',
    extractedFields,
    sourcePayload: {
      mode: 'interactive_camera',
      document_contract_status: 'pending_approval',
    },
  });

  assert.deepEqual(persistence.ocr_structured_fields, extractedFields);
  assert.equal(persistence.ocr_review_required, true);
  assert.deepEqual(persistence.ocr_structured_fields.fields, {});

  const ocr = buildOcrProjection({
    document_id: 'indigency-ocr-id',
    document_key: 'certificate_of_indigency',
    document_type: 'Certificate of Indigency',
    scanned_via_iot: true,
    ocr_extracted_name: null,
    ocr_confidence: 0.99,
    ocr_raw_text: 'INDIGENCY RAW OCR',
    ...persistence,
  });
  const document = buildOcrOnlyDocument({
    documentKey: 'certificate_of_indigency',
    ocr,
  });

  assert.equal(ocr.raw_text, 'INDIGENCY RAW OCR');
  assert.equal(ocr.extracted_name, null);
  assert.equal(ocr.review_required, true);
  assert.equal(document.status, 'pending');
  assert.equal(document.url, null);
  assert.equal(document.file_url, null);
});
