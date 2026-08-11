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
    assert.doesNotMatch(source, /Confidence:\s*\{confidence\}/);
    assert.doesNotMatch(source, /Admin OCR Notes/i);
    assert.doesNotMatch(source, />\s*Selected Document\s*</i);
    assert.doesNotMatch(source, /Rejection Reason \/ Admin Remarks/i);
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
    assert.match(gradeCard, /ocrScoreLabel\(reviewCandidate, key/);
    assert.match(gradeCard, /ocrScoreLabel\(reviewCandidate, 'gwa'/);

    const fieldsStart = source.indexOf('const GRADE_REVIEW_FIELDS');
    const fieldsEnd = source.indexOf('];', fieldsStart);
    const visibleFields = source.slice(fieldsStart, fieldsEnd);
    assert.match(visibleFields, /student_number|Student Number/);
    assert.doesNotMatch(visibleFields, /student_name|Student Name/);
    assert.doesNotMatch(visibleFields, /course|Course/);
    assert.doesNotMatch(visibleFields, /semester|Semester/);
    assert.doesNotMatch(visibleFields, /academic_year|Academic Year/);
});

test('review candidate always stops the running OCR UI', () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '../../frontend/src/pages/DocumentVerification.jsx'),
        'utf8'
    );

    assert.match(source, /setReviewCandidate\(candidate\);[\s\S]*?stopPolling\(\);[\s\S]*?setRunningIotOcr\(false\);/);
    assert.match(source, /candidateReady[\s\S]*?'review_required'[\s\S]*?stopPolling\(\);[\s\S]*?setRunningIotOcr\(false\);/);
});

test('indigency has a dedicated editable review while raw OCR is immutable', () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '../../frontend/src/pages/DocumentVerification.jsx'),
        'utf8'
    );

    assert.match(source, /const INDIGENCY_REVIEW_FIELDS/);
    assert.match(source, />INDIGENCY OCR</);
    assert.match(source, /deriveIndigencyReviewValues/);
    assert.match(source, /aria-label="Immutable raw OCR snapshot"/);
    assert.match(source, /value=\{rawOcrSnapshot\}[\s\S]*?readOnly/);
    assert.doesNotMatch(source, /onSaveRawOcr|onRawOcrChange|Save OCR Snapshot/);
    assert.match(source, /!\['student_grade_forms', 'certificate_of_indigency', 'birth_certificate'\]\.includes/);
    assert.match(source, /\['residency_address', 'Full Address'\]/);
    assert.doesNotMatch(source, /\['issue_date', 'Issue Date'\]/);
    assert.doesNotMatch(source, /\['issuing_barangay', 'Issuing Barangay'\]/);
    assert.match(source, /aria-label="Verified full residence address"/);
    assert.match(
        source,
        /\['student_grade_forms', 'certificate_of_indigency', 'birth_certificate'\]\.includes\(activeDoc\?\.id\)[\s\S]*?requestStatus === 'completed'/
    );
});

test('birth certificate has a dedicated parent review card and immutable raw snapshot', () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '../../frontend/src/pages/DocumentVerification.jsx'),
        'utf8'
    );

    assert.match(source, />BIRTH CERTIFICATE OCR</);
    assert.match(source, /const BIRTH_PARENT_FIELDS/);
    assert.match(source, /mother_maiden_name/);
    assert.match(source, /father_name/);
    assert.match(source, /Child Name \(reference\)/);
    assert.match(source, /Confirm Parents/);
    assert.match(source, /isBirthReview/);
    assert.match(source, /aria-label="Immutable raw OCR snapshot"/);
});

test('registration and request letter cannot run IoT OCR', () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '../../frontend/src/pages/DocumentVerification.jsx'),
        'utf8'
    );

    assert.match(source, /IOT_OCR_DISABLED_DOCUMENT_KEYS/);
    assert.match(source, /'certificate_of_registration'/);
    assert.match(source, /'letter_of_request'/);
    assert.match(source, /!IOT_OCR_DISABLED_DOCUMENT_KEYS\.has\(activeDoc\.id\)/);
    assert.match(source, /IoT OCR unavailable/);
});

test('student summary displays confirmed Marilao residency as true or false', () => {
    const source = fs.readFileSync(
        path.resolve(__dirname, '../../frontend/src/pages/DocumentVerification.jsx'),
        'utf8'
    );

    assert.match(source, /label="Marilao Resident"/);
    assert.match(source, /marilao_resident === true \? 'True' : 'False'/);
});
