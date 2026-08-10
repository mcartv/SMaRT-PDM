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

test('only confirmed full residence address establishes Marilao residency', () => {
    assert.equal(resolveMarilaoResidency([
        {
            document_key: 'certificate_of_indigency',
            verified_fields: {
                residency_address: '12 Sample Street, Lias, Marilao, Bulacan',
            },
        },
    ]), true);

    assert.equal(resolveMarilaoResidency([
        {
            document_key: 'barangay_certificate',
            verified_fields: { full_address: 'Abangan Norte, Marilao, Bulacan' },
        },
    ]), true);

    assert.equal(resolveMarilaoResidency([
        {
            document_key: 'certificate_of_indigency',
            verified_fields: {
                residency_address: '12 Sample Street, Malolos, Bulacan',
                issuing_barangay: 'Lias',
            },
        },
    ]), false);

    assert.equal(resolveMarilaoResidency([
        {
            document_key: 'certificate_of_indigency',
            verified_fields: { issuing_barangay: 'Lias' },
        },
    ]), false);

    assert.equal(resolveMarilaoResidency([
        {
            document_key: 'student_grade_forms',
            verified_fields: { address: 'Marilao' },
        },
    ]), false);
});
