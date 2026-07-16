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
  buildExtractedData,
  buildRawOcrSnapshot,
} = await vite.ssrLoadModule('/src/pages/DocumentVerification.jsx');

after(async () => {
  await vite.close();
});

function buildBirthDocument(fields) {
  return {
    id: 'birth_certificate',
    document_key: 'birth_certificate',
    status: 'pending',
    ocr: {
      raw_text: '',
      extracted_name: null,
      confidence: null,
      review_required: true,
      structured_fields: {
        document_type: 'birth_certificate',
        review_required: true,
        fields,
      },
      processing_metadata: {
        worker_status: 'review_required',
        registration_status: 'success',
        cropper_status: 'success',
        ocr_status: 'review_required',
      },
    },
  };
}

test('structured birth OCR renders three provisional fields without raw text', () => {
  const activeDoc = buildBirthDocument({
    child_name: { raw_text: 'CHILD OCR', review_required: true },
    mother_maiden_name: { raw_text: 'MOTHER OCR', review_required: true },
    father_name: { raw_text: 'FATHER OCR', review_required: true },
  });
  const mapped = buildExtractedData(activeDoc, {
    student: { name: 'APPLICATION PROFILE NAME' },
  });

  assert.equal(mapped.manualReviewRequired, true);
  assert.deepEqual(mapped.extractedFields, [
    {
      label: 'Child Name',
      value: 'CHILD OCR',
      badge: 'Provisional OCR',
    },
    {
      label: 'Mother’s Maiden Name',
      value: 'MOTHER OCR',
      badge: 'Provisional OCR',
    },
    {
      label: 'Father Name',
      value: 'FATHER OCR',
      badge: 'Provisional OCR',
    },
  ]);
  assert.equal(
    buildRawOcrSnapshot(activeDoc),
    'Structured row OCR completed.\nNo combined raw OCR snapshot was supplied.'
  );
  assert.notEqual(buildRawOcrSnapshot(activeDoc), '(No OCR text yet)');
  assert.equal(
    mapped.applicationMetadata[0].value,
    'APPLICATION PROFILE NAME'
  );
  assert.ok(
    mapped.extractedFields.every(
      (field) => field.value !== 'APPLICATION PROFILE NAME'
    )
  );
});

test('missing individual birth text renders Not extracted', () => {
  const mapped = buildExtractedData(
    buildBirthDocument({
      child_name: { raw_text: '', review_required: true },
      mother_maiden_name: { raw_text: 'MOTHER OCR', review_required: true },
      father_name: { raw_text: 'FATHER OCR', review_required: true },
    }),
    { student: {} }
  );

  assert.equal(mapped.extractedFields[0].value, 'Not extracted');
  assert.equal(mapped.documentValidation.detectedLabel, 'Structured row OCR completed');
  assert.deepEqual(
    mapped.documentValidation.rows.map((row) => [row.label, row.value]),
    [
      ['Document processing', 'Completed'],
      ['Review state', 'Manual review required'],
      ['Extracted fields', '3'],
    ]
  );
});

test('legacy OCR rendering remains unchanged', () => {
  const mapped = buildExtractedData(
    {
      id: 'certificate_of_registration',
      document_key: 'certificate_of_registration',
      ocr: {
        extracted_name: 'LEGACY OCR NAME',
        raw_text: 'LEGACY RAW OCR',
      },
    },
    { student: { name: 'APPLICATION PROFILE NAME' } }
  );

  assert.deepEqual(mapped.extractedFields, [
    {
      label: 'Extracted Name',
      value: 'LEGACY OCR NAME',
      badge: 'Extracted',
    },
  ]);
  assert.equal(buildRawOcrSnapshot({
    ocr: { raw_text: 'LEGACY RAW OCR' },
  }), 'LEGACY RAW OCR');
});
