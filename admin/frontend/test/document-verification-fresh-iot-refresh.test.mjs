import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';

globalThis.window = {
  location: { origin: 'http://localhost' },
  clearTimeout,
  setTimeout,
};
globalThis.sessionStorage = { getItem: () => null };

const vite = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
});

const {
  buildExtractedData,
  buildIotOcrSnapshotOverride,
  buildRawOcrSnapshot,
  getIotOcrRequestId,
} = await vite.ssrLoadModule('/src/pages/DocumentVerification.jsx');

const source = await readFile(
  new URL('../src/pages/DocumentVerification.jsx', import.meta.url),
  'utf8'
);

after(async () => {
  await vite.close();
});

test('request ID normalization accepts the trigger and snapshot response shapes', () => {
  assert.equal(getIotOcrRequestId({ request_id: 'request-a' }), 'request-a');
  assert.equal(getIotOcrRequestId({ id: 'request-b' }), 'request-b');
  assert.equal(
    getIotOcrRequestId({ data: { request_id: 'request-c' } }),
    'request-c'
  );
  assert.equal(getIotOcrRequestId({}), null);
});

test('fresh snapshot override renders the latest structured and raw OCR values', () => {
  const override = buildIotOcrSnapshotOverride({
    ocr_confidence: 87,
    iot_ocr_request: {
      request_id: 'fresh-request',
      status: 'completed',
    },
    ocr: {
      raw_text: 'FRESH RAW OCR',
      review_required: true,
      structured_fields: {
        document_type: 'birth_certificate',
        review_required: true,
        fields: {
          child_name: { raw_text: 'FRESH CHILD' },
          mother_maiden_name: { raw_text: 'FRESH MOTHER' },
          father_name: { raw_text: 'FRESH FATHER' },
        },
      },
    },
  });

  const document = {
    id: 'birth_certificate',
    document_key: 'birth_certificate',
    ...override,
  };

  const mapped = buildExtractedData(document, {
    student: { name: 'FRESH CHILD' },
  });

  assert.equal(buildRawOcrSnapshot(document), 'FRESH RAW OCR');
  assert.equal(mapped.confidence, '87%');
  assert.deepEqual(
    mapped.extractedFields.map((field) => field.value),
    ['FRESH CHILD', 'FRESH MOTHER', 'FRESH FATHER']
  );
  assert.equal(override.iot_ocr_request.request_id, 'fresh-request');
});

test('frontend waits for the exact fresh request instead of stopping on old OCR data', () => {
  assert.match(source, /ocr-snapshot\?request_id=/);
  assert.match(source, /latestRequestId === requestId/);
  assert.match(source, /setRawOcrSnapshot\('\(Waiting for fresh OCR result\.\.\.\)'\)/);
  assert.match(source, /const maxAttempts = 180/);
  assert.doesNotMatch(source, /if \(hasDocumentOcrResult\(latestDoc\)\)/);
});
