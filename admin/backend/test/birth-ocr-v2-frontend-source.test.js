const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
    path.resolve(__dirname, '../../frontend/src/pages/DocumentVerification.jsx'),
    'utf8'
);

test('Birth review defaults to V2 and supports private image-assisted review', () => {
    assert.match(source, /useState\('v2'\)/);
    assert.match(source, /V2 Gemini review/);
    assert.match(source, /review-image/);
    assert.match(source, /BirthV2ReviewImage/);
    assert.match(source, /source_regions/);
    assert.match(source, /birthReviewImageStatus/);
    assert.match(source, /Private Birth review image timed out/);
    assert.match(source, /private_capture_available/);
    assert.match(source, /Dashed = expected calibrated cells/);
    assert.match(source, /Solid = exact uploaded cells/);
    assert.match(source, /Item 1 \/ Child/);
    assert.match(source, /Item 6 \/ Mother/);
    assert.match(source, /Item 13 \/ Father/);
    assert.match(source, /no OCR text was fabricated/);
    assert.match(source, /Full-Page Gemini Transcription/);
    assert.match(source, /Raw Tesseract OCR Snapshot/);
    assert.match(source, /Immutable machine-generated transcription · unverified/);
    assert.match(source, /birth_v2_full_page_gemini_recovery/);
    assert.match(source, /recovered from the full-page Gemini reading/);
});

test('Birth review keeps Child locked and exposes reject and rescan actions', () => {
    assert.match(source, /aria-label={`Child \${label}`}[\s\S]*?className="bg-stone-100"/);
    assert.match(source, /Request Rescan/);
    assert.match(source, />\s*Reject\s*</);
    assert.match(source, /Confirm Parents/);
    assert.match(source, /event\.altKey/);
});
