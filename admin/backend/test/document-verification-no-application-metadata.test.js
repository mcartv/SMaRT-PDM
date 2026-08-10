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

test('grade review uses the bottom raw snapshot and visible OCR score labels', () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '../../frontend/src/pages/DocumentVerification.jsx'),
        'utf8'
    );
    const gradeStart = source.indexOf('{isGradeReview && (');
    const gradeEnd = source.indexOf('{reviewCandidate && !isGradeReview', gradeStart);
    const gradeCard = source.slice(gradeStart, gradeEnd);

    assert.ok(gradeStart >= 0 && gradeEnd > gradeStart);
    assert.doesNotMatch(gradeCard, /<summary[^>]*>Raw OCR<\/summary>/);
    assert.doesNotMatch(gradeCard, />Validation Issues<\/summary>/);
    assert.match(gradeCard, /gradeOcrScore\(reviewCandidate, key/);
    assert.match(gradeCard, /gradeOcrScore\(reviewCandidate, 'gwa'/);
});
