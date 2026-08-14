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
});

test('Birth review keeps Child locked and exposes reject and rescan actions', () => {
    assert.match(source, /aria-label={`Child \${label}`}[\s\S]*?className="bg-stone-100"/);
    assert.match(source, /Request Rescan/);
    assert.match(source, />\s*Reject\s*</);
    assert.match(source, /Confirm Parents/);
    assert.match(source, /event\.altKey/);
});
