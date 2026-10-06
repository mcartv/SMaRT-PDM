// SMaRT-PDM: marilao Residency — marilao Residency (admin backend); supports backend application behavior.
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

// normalizeLocation: normalizes normalize location for the marilao Residency flow.
function normalizeLocation(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[^a-zA-Z0-9]+/g, ' ')
        .trim()
        .toLowerCase();
}

// fieldValue: handles field value for the marilao Residency flow.
function fieldValue(value) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value.normalized_value ?? value.raw_text ?? value.value ?? '';
    }
    return value;
}

// isMarilaoLocation: checks whether is marilao location for the marilao Residency flow.
function isMarilaoLocation(value) {
    const normalized = normalizeLocation(fieldValue(value));
    if (!normalized) return false;
    if (` ${normalized} `.includes(' marilao ')) return true;
    return MARILAO_BARANGAYS.some((barangay) => (
        ` ${normalized} `.includes(` ${barangay} `)
    ));
}

// isMarilaoResidenceReview: checks whether is marilao residence review for the marilao Residency flow.
function isMarilaoResidenceReview(review = {}) {
    const documentKey = normalizeLocation(review.document_key).replace(/\s+/g, '_');
    if (!MARILAO_DOCUMENT_KEYS.has(documentKey)) return false;
    const fields = review.verified_fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return false;
    return LOCATION_FIELD_KEYS.some((key) => isMarilaoLocation(fields[key]));
}

// hasConfirmedResidenceAddress: checks whether has confirmed residence address for the marilao Residency flow.
function hasConfirmedResidenceAddress(review = {}) {
    const documentKey = normalizeLocation(review.document_key).replace(/\s+/g, '_');
    if (!MARILAO_DOCUMENT_KEYS.has(documentKey)) return false;
    const fields = review.verified_fields;
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return false;
    return LOCATION_FIELD_KEYS.some((key) => normalizeLocation(fieldValue(fields[key])));
}

// resolveMarilaoResidency: resolves resolve marilao residency for the marilao Residency flow.
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
