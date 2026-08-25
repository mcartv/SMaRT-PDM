const OCR_VERSION = Object.freeze({
    V1: 'v1',
    V2: 'v2',
});

const OCR_VERSION_SUPPORT = Object.freeze({
    birth_certificate: Object.freeze([OCR_VERSION.V1, OCR_VERSION.V2]),
    certificate_of_live_birth: Object.freeze([OCR_VERSION.V1, OCR_VERSION.V2]),
    student_grade_forms: Object.freeze([OCR_VERSION.V1, OCR_VERSION.V2]),
    certificate_of_indigency: Object.freeze([OCR_VERSION.V1, OCR_VERSION.V2]),
});

const OCR_MODE_LABELS = Object.freeze({
    [OCR_VERSION.V1]: 'Local OCR',
    [OCR_VERSION.V2]: 'Enhanced OCR',
});

function supportedOcrVersions(documentKey) {
    return OCR_VERSION_SUPPORT[documentKey] || [];
}

function isSupportedOcrVersion(documentKey, version) {
    return supportedOcrVersions(documentKey).includes(version);
}

module.exports = {
    OCR_VERSION,
    OCR_VERSION_SUPPORT,
    OCR_MODE_LABELS,
    supportedOcrVersions,
    isSupportedOcrVersion,
};
