const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const frontend = path.join(__dirname, '..', '..', 'frontend', 'src');
const read = (relative) => fs.readFileSync(path.join(frontend, relative), 'utf8');

test('Admin-visible OCR terminology uses Local and Enhanced OCR', () => {
    for (const relative of ['pages/DocumentVerification.jsx', 'pages/AboutPage.jsx']) {
        const source = read(relative);
        assert.doesNotMatch(source, /Gemini/i, relative);
    }
    const verification = read('pages/DocumentVerification.jsx');
    assert.match(verification, /Version 1 - Local OCR/);
    assert.match(verification, /Version 2 - Enhanced OCR/);
});
