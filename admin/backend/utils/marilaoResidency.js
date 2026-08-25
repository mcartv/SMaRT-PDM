const MARILAO_DOCUMENT_KEYS = new Set([
    'certificate_of_indigency',
    'indigency',
    'barangay_certificate',
    'certificate_of_residency',
    'barangay_clearance',
]);

const MARILAO_BARANGAYS = Object.freeze([
    'abangan norte',
    'abangan sur',
    'ibayo',
    'lambakin',
    'lias',
    'loma de gato',
    'nagbalon',
    'patubig',
    'poblacion i',
    'poblacion ii',
    'prenza i',
    'prenza ii',
    'saog',
    'santa rosa i',
    'santa rosa ii',
    'tabing ilog',
]);

const LOCATION_FIELD_KEYS = Object.freeze([
    'residency_address',
    'full_address',
    'address',
]);

function normalizeLocation(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toLowerCase();
}

function fieldValue(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value.normalized_value ?? value.raw_text ?? value.value ?? '';
    }
    return value;
}

function isMarilaoLocation(value) {
    const normalized = normalizeLocation(fieldValue(value));
    if (!normalized) return false;
    if (` ${normalized} `.includes(' marilao ')) return true;
    return MARILAO_BARANGAYS.some((barangay) => (
        ` ${normalized} `.includes(` ${barangay} `)
    ));
}

function isMarilaoResidenceReview(review = {}) {
    const documentKey = normalizeLocation(review.document_key).replace(/\s+/g, '_');
    if (!MARILAO_DOCUMENT_KEYS.has(documentKey)) return false;
    const fields = review.verified_fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return false;
    return LOCATION_FIELD_KEYS.some((key) => isMarilaoLocation(fields[key]));
}

function hasConfirmedResidenceAddress(review = {}) {
    const documentKey = normalizeLocation(review.document_key).replace(/\s+/g, '_');
    if (!MARILAO_DOCUMENT_KEYS.has(documentKey)) return false;
    const fields = review.verified_fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return false;
    return LOCATION_FIELD_KEYS.some((key) => normalizeLocation(fieldValue(fields[key])));
}

function resolveMarilaoResidency(reviews = []) {
    if (!Array.isArray(reviews)) return null;
    const confirmedResidenceReviews = reviews.filter(hasConfirmedResidenceAddress);
    if (confirmedResidenceReviews.length === 0) return null;
    return confirmedResidenceReviews.some(isMarilaoResidenceReview);
}

module.exports = {
    MARILAO_BARANGAYS,
    isMarilaoLocation,
    isMarilaoResidenceReview,
    hasConfirmedResidenceAddress,
    resolveMarilaoResidency,
};
