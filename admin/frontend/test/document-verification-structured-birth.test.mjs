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
  APPLICANT_IDENTITY_UNCONFIRMED,
  buildExtractedData,
  buildRawOcrSnapshot,
  reviewBirthApplicantIdentity,
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

test('clear child-name evidence does not show the identity warning', () => {
  const review = reviewBirthApplicantIdentity({
    applicantName: 'Orlando Kurt Villafuerte',
    childNameRawText: 'VILLAFUERTE ORLANDO KURT',
    ocrReviewRequired: true,
  });

  assert.equal(review.status, 'confirmed');
  assert.equal(review.review_code, null);
  assert.equal(review.warning, '');
  assert.equal(review.manual_review_required, true);
});

test('unrelated child OCR returns a conservative unconfirmed warning', () => {
  const review = reviewBirthApplicantIdentity({
    applicantName: 'Orlando Kurt Villafuerte',
    childNameRawText: 'VENICE EVE PELIMA',
    ocrReviewRequired: true,
  });

  assert.equal(review.status, 'unconfirmed');
  assert.equal(review.review_code, APPLICANT_IDENTITY_UNCONFIRMED);
  assert.equal(review.manual_review_required, true);
  assert.match(review.warning, /could not be confirmed/i);
  assert.doesNotMatch(review.warning, /different person|belongs to/i);
});

test('empty, noisy, and partial child OCR remain unconfirmed', () => {
  for (const childNameRawText of ['', '||| 1 1 ???', 'ORLANDO']) {
    const review = reviewBirthApplicantIdentity({
      applicantName: 'Orlando Kurt Villafuerte',
      childNameRawText,
    });

    assert.equal(review.status, 'unconfirmed');
    assert.equal(review.review_code, APPLICANT_IDENTITY_UNCONFIRMED);
  }
});

test('mother and father OCR never affect applicant identity matching', () => {
  const buildMapped = (motherRawText, fatherRawText) => buildExtractedData(
    buildBirthDocument({
      child_name: { raw_text: 'VENICE EVE PELIMA', review_required: true },
      mother_maiden_name: { raw_text: motherRawText, review_required: true },
      father_name: { raw_text: fatherRawText, review_required: true },
    }),
    { student: { name: 'Orlando Kurt Villafuerte' } }
  );

  const matchingParents = buildMapped(
    'ORLANDO KURT VILLAFUERTE',
    'ORLANDO KURT VILLAFUERTE'
  );
  const emptyParents = buildMapped('', '');

  assert.deepEqual(matchingParents.identityReview, emptyParents.identityReview);
  assert.equal(
    matchingParents.identityReview.review_code,
    APPLICANT_IDENTITY_UNCONFIRMED
  );
});

test('identity mismatch keeps the requirement pending and OCR provisional', () => {
  const activeDoc = buildBirthDocument({
    child_name: { raw_text: 'VENICE EVE PELIMA', review_required: true },
    mother_maiden_name: { raw_text: 'MOTHER OCR', review_required: true },
    father_name: { raw_text: '', review_required: true },
  });
  const mapped = buildExtractedData(activeDoc, {
    student: { name: 'Orlando Kurt Villafuerte' },
  });

  assert.equal(activeDoc.status, 'pending');
  assert.equal(mapped.identityReview.status, 'unconfirmed');
  assert.equal(mapped.manualReviewRequired, true);
  assert.equal(mapped.extractedFields[0].value, 'VENICE EVE PELIMA');
  assert.equal(mapped.extractedFields[2].value, 'Not extracted');
  assert.ok(
    mapped.extractedFields.every((field) => field.badge === 'Provisional OCR')
  );
});
