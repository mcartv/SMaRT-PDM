const assert = require('node:assert/strict');
const test = require('node:test');
const {
    OCR_VERSION,
    OCR_VERSION_SUPPORT,
    OCR_MODE_LABELS,
} = require('../utils/ocrVersions');

test('OCR version support is document-aware and uses canonical persisted values', () => {
    assert.deepEqual(OCR_VERSION, { V1: 'v1', V2: 'v2' });
    assert.deepEqual(OCR_VERSION_SUPPORT.birth_certificate, ['v1', 'v2']);
    assert.deepEqual(OCR_VERSION_SUPPORT.student_grade_forms, ['v1', 'v2']);
    assert.deepEqual(OCR_VERSION_SUPPORT.certificate_of_indigency, ['v1', 'v2']);
    assert.deepEqual(OCR_MODE_LABELS, { v1: 'Local OCR', v2: 'Enhanced OCR' });
});

test('Grade V2 exposes the required structured field contract with nullable confidence', () => {
    const service = require('../services/gradeOcrV2Service');
    assert.deepEqual(service.FIELD_KEYS, [
        'student_number', 'student_name', 'course', 'semester', 'academic_year', 'gwa',
    ]);
    assert.equal(service.GRADE_SCHEMA.properties.fields.required.length, 6);
    assert.deepEqual(service.normalizeFields({ gwa: '1.50' }).gwa, {
        raw_text: '1.50', normalized_value: '1.50', confidence: null,
    });
});

test('Indigency V2 exposes its two-field structured contract', () => {
    const service = require('../services/indigencyOcrV2Service');
    assert.deepEqual(service.FIELD_KEYS, [
        'certificate_subject_name', 'residency_address',
    ]);
    assert.deepEqual(service.normalizeFields({
        certificate_subject_name: 'Nathalie Sarmiento',
        residency_address: '#12 De Vera Compound',
    }).residency_address, {
        raw_text: '#12 De Vera Compound',
        normalized_value: '#12 De Vera Compound',
        confidence: null,
    });
});
