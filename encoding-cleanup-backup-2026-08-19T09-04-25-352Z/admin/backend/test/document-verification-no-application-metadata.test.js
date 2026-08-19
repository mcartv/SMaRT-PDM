'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { read } = require('./_current-system-test-utils');

test('document verification uses readable current OCR result labels', () => {
  const source = read('frontend/src/pages/DocumentVerification.jsx');

  assert.match(source, /Detected/);
  assert.doesNotMatch(source, /ΓÇö/);
});

test('document verification remains focused on document/OCR review', () => {
  const source = read('frontend/src/pages/DocumentVerification.jsx');

  assert.match(source, /Document/i);
  assert.match(source, /OCR/i);
});
