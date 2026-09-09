import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const { default: Preview } = await vite.ssrLoadModule('/src/components/ScannedDocumentPreview.jsx');
after(() => vite.close());
const render = (documentKey, overrides = {}) => renderToStaticMarkup(React.createElement(Preview, { documentKey, candidate: { request_id: 'scan', document_key: documentKey, ocr_version: 'v2', status: 'review_required', ...overrides } }));
test('grade and indigency captures show accessible loading previews', () => {
  for (const key of ['student_grade_forms', 'certificate_of_indigency']) {
    assert.match(render(key), /Captured document/);
    assert.match(render(key), /role="status"/);
    assert.match(render(key, { status: 'completed' }), /Captured document/);
  }
});
test('birth certificate and legacy scans do not enter the new preview', () => {
  assert.equal(render('birth_certificate'), '');
  assert.equal(render('student_grade_forms', { ocr_version: 'v1' }), '');
});
test('mismatched and unfinished scans cannot show a preview', () => {
  assert.equal(render('student_grade_forms', { document_key: 'certificate_of_indigency' }), '');
  assert.equal(render('student_grade_forms', { status: 'processing' }), '');
});
