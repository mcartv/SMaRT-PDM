const EVIDENCE_STATES = Object.freeze(['confirmed', 'partial', 'conflict', 'incomplete', 'unavailable']);
const COMPARISON_RESULTS = Object.freeze(['exact', 'normalized_match', 'different', 'missing']);

function normalizeOcrComparisonValue(value) {
    return String(value ?? '')
        .normalize('NFC')
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s*([\-])\s*/g, '$1')
        .replace(/\s*([,.;:])\s*/g, '$1 ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLocaleUpperCase();
}

function compareOcrValues(rawA, rawB) {
    const left = String(rawA ?? '');
    const right = String(rawB ?? '');
    if (!left.trim() || !right.trim()) return 'missing';
    if (left === right) return 'exact';
    return normalizeOcrComparisonValue(left) === normalizeOcrComparisonValue(right)
        ? 'normalized_match'
        : 'different';
}

function evidenceState({ primary, supporting, supportingAvailable = true } = {}) {
    const hasPrimary = Boolean(String(primary ?? '').trim());
    const hasSupporting = Boolean(String(supporting ?? '').trim());
    if (!supportingAvailable && hasPrimary) return 'partial';
    if (!hasPrimary && !hasSupporting) return supportingAvailable ? 'incomplete' : 'unavailable';
    if (!hasPrimary) return 'incomplete';
    if (!hasSupporting) return supportingAvailable ? 'incomplete' : 'partial';
    return ['exact', 'normalized_match'].includes(compareOcrValues(primary, supporting))
        ? 'confirmed'
        : 'conflict';
}

function overallEvidenceState(evidence = {}) {
    const priority = ['conflict', 'incomplete', 'partial', 'unavailable', 'confirmed'];
    return priority.find((state) => Object.values(evidence).some((item) => item?.state === state)) || 'unavailable';
}

module.exports = {
    EVIDENCE_STATES,
    COMPARISON_RESULTS,
    normalizeOcrComparisonValue,
    compareOcrValues,
    evidenceState,
    overallEvidenceState,
};
