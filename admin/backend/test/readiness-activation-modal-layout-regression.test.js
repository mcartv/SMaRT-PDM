const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const source = fs.readFileSync(
    path.resolve(__dirname, '../../frontend/src/pages/ApplicationReview.jsx'),
    'utf8'
);

test('scholar activation modal keeps header, scroll area, and footer inside its bounds', () => {
    const start = source.indexOf('Confirm scholar activation');
    const modal = source.slice(Math.max(0, start - 1000), start + 5000);

    assert.match(modal, /grid-rows-\[auto_minmax\(0,1fr\)_auto\]/);
    assert.match(modal, /min-h-0[^"]*overflow-y-auto[^"]*overscroll-contain/);
    assert.match(modal, /DialogFooter className="m-0[^"]*shrink-0[^"]*rounded-none/);
    assert.match(modal, /max-h-\[calc\(100dvh-1\.5rem\)\]/);
});
