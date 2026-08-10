const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

test('document verification does not render application metadata cards', () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '../../frontend/src/pages/DocumentVerification.jsx'),
        'utf8'
    );

    assert.doesNotMatch(source, /Application Metadata/i);
    assert.doesNotMatch(source, /applicationMetadata/);
});
