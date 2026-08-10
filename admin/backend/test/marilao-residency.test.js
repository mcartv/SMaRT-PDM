const test = require('node:test');
const assert = require('node:assert/strict');

const {
    isMarilaoLocation,
    resolveMarilaoResidency,
} = require('../utils/marilaoResidency');

test('recognizes Marilao and its barangays as residency evidence', () => {
    assert.equal(isMarilaoLocation('Marilao, Bulacan'), true);
    assert.equal(isMarilaoLocation('Barangay Abangan Norte'), true);
    assert.equal(isMarilaoLocation('Loma de Gato, Bulacan'), true);
    assert.equal(isMarilaoLocation('Meycauayan, Bulacan'), false);
});

test('only confirmed indigency or barangay certificate fields establish residency', () => {
    assert.equal(resolveMarilaoResidency([
        {
            document_key: 'certificate_of_indigency',
            verified_fields: { issuing_barangay: 'Lias' },
        },
    ]), true);

    assert.equal(resolveMarilaoResidency([
        {
            document_key: 'barangay_certificate',
            verified_fields: { municipality: 'Marilao' },
        },
    ]), true);

    assert.equal(resolveMarilaoResidency([
        {
            document_key: 'certificate_of_indigency',
            verified_fields: { issuing_barangay: 'Malolos' },
        },
    ]), false);

    assert.equal(resolveMarilaoResidency([
        {
            document_key: 'student_grade_forms',
            verified_fields: { address: 'Marilao' },
        },
    ]), false);
});
