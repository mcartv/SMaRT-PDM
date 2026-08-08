'use strict';

/**
 * Canonical digital representation of the PDM-OSFA endorsement slip.
 *
 * Important compatibility rule:
 * - Canonical values are used for all new endorsement writes.
 * - Legacy values remain readable during the phased rollout so existing
 *   records and older clients do not break while the UI/mobile layers are
 *   updated in later phases.
 */

const ENDORSEMENT_STAGES = Object.freeze({
    PENDING_SDO: 'pending_sdo',
    PENDING_GUIDANCE: 'pending_guidance',
    PENDING_PD: 'pending_pd',
    COMPLETED: 'completed',
    DISQUALIFIED_MAJOR: 'disqualified_major',
});

const SDO_RESULTS = Object.freeze({
    NO_OFFENSE: 'no_offense',
    MINOR_OFFENSE: 'minor_offense',
    MAJOR_OFFENSE: 'major_offense',
});

const GUIDANCE_RESULTS = Object.freeze({
    GOOD_MORAL_STANDING: 'good_moral_standing',
});

const PD_RESULTS = Object.freeze({
    GOOD_SCHOLASTIC_STANDING: 'good_scholastic_standing',
    AVERAGE_SCHOLASTIC_STANDING: 'average_scholastic_standing',
});

const LEGACY_RESULTS = Object.freeze({
    SDO_CLEARED: 'cleared',
    SDO_MINOR: 'disqualified_minor',
    SDO_MAJOR: 'disqualified_major',
    GUIDANCE_CLEARED: 'cleared',
    GUIDANCE_HELD: 'held',
    GUIDANCE_REJECTED: 'rejected',
    PD_APPROVED: 'approved',
    PD_REJECTED: 'rejected',
});

const RESULT_LABELS = Object.freeze({
    sdo: Object.freeze({
        [SDO_RESULTS.NO_OFFENSE]: 'No Disciplinary Offense',
        [SDO_RESULTS.MINOR_OFFENSE]: 'With Minor Offense/s',
        [SDO_RESULTS.MAJOR_OFFENSE]: 'With Major Offense/s',
        [LEGACY_RESULTS.SDO_CLEARED]: 'No Disciplinary Offense',
        [LEGACY_RESULTS.SDO_MINOR]: 'With Minor Offense/s',
        [LEGACY_RESULTS.SDO_MAJOR]: 'With Major Offense/s',
    }),
    guidance: Object.freeze({
        [GUIDANCE_RESULTS.GOOD_MORAL_STANDING]: 'Good Moral Standing',
        [LEGACY_RESULTS.GUIDANCE_CLEARED]: 'Good Moral Standing',
        [LEGACY_RESULTS.GUIDANCE_HELD]: 'For Counseling / Hold',
        [LEGACY_RESULTS.GUIDANCE_REJECTED]: 'Rejected',
    }),
    pd: Object.freeze({
        [PD_RESULTS.GOOD_SCHOLASTIC_STANDING]: 'Good Scholastic Standing',
        [PD_RESULTS.AVERAGE_SCHOLASTIC_STANDING]: 'Average Scholastic Standing',
        // Do not infer Good/Average from historical generic approvals.
        [LEGACY_RESULTS.PD_APPROVED]: 'Legacy Approved — Scholastic Standing Not Recorded',
        [LEGACY_RESULTS.PD_REJECTED]: 'Legacy Rejected by Program Director',
    }),
});

function normalizeText(value) {
    return value === null || value === undefined ? '' : String(value).trim().toLowerCase();
}

function normalizeSdoAction(action) {
    const value = normalizeText(action);
    if ([SDO_RESULTS.NO_OFFENSE, 'clear', LEGACY_RESULTS.SDO_CLEARED].includes(value)) {
        return SDO_RESULTS.NO_OFFENSE;
    }
    if ([SDO_RESULTS.MINOR_OFFENSE, 'disqualify_minor', LEGACY_RESULTS.SDO_MINOR].includes(value)) {
        return SDO_RESULTS.MINOR_OFFENSE;
    }
    if ([SDO_RESULTS.MAJOR_OFFENSE, 'disqualify_major', LEGACY_RESULTS.SDO_MAJOR].includes(value)) {
        return SDO_RESULTS.MAJOR_OFFENSE;
    }
    return null;
}

function normalizeGuidanceAction(action) {
    const value = normalizeText(action);
    return [
        GUIDANCE_RESULTS.GOOD_MORAL_STANDING,
        'clear',
        LEGACY_RESULTS.GUIDANCE_CLEARED,
    ].includes(value)
        ? GUIDANCE_RESULTS.GOOD_MORAL_STANDING
        : null;
}

function normalizePdAction(action, { scholasticStanding = null, gwa = null } = {}) {
    const value = normalizeText(action);
    const explicitStanding = normalizeText(scholasticStanding);

    if (explicitStanding === PD_RESULTS.GOOD_SCHOLASTIC_STANDING) {
        return PD_RESULTS.GOOD_SCHOLASTIC_STANDING;
    }
    if (explicitStanding === PD_RESULTS.AVERAGE_SCHOLASTIC_STANDING) {
        return PD_RESULTS.AVERAGE_SCHOLASTIC_STANDING;
    }

    if (value === PD_RESULTS.GOOD_SCHOLASTIC_STANDING) return PD_RESULTS.GOOD_SCHOLASTIC_STANDING;
    if (value === PD_RESULTS.AVERAGE_SCHOLASTIC_STANDING) return PD_RESULTS.AVERAGE_SCHOLASTIC_STANDING;

    // Compatibility with the pre-alignment backend action. Prefer the
    // explicitly selected standing when provided by the new frontend.
    if (value === 'approve' || value === LEGACY_RESULTS.PD_APPROVED) {
        const numericGwa = Number(gwa);
        return Number.isFinite(numericGwa) && numericGwa <= 1.75
            ? PD_RESULTS.GOOD_SCHOLASTIC_STANDING
            : PD_RESULTS.AVERAGE_SCHOLASTIC_STANDING;
    }

    return null;
}

function isSdoContinuingResult(result) {
    return [SDO_RESULTS.NO_OFFENSE, SDO_RESULTS.MINOR_OFFENSE].includes(result);
}

function isCanonicalPdResult(result) {
    return [PD_RESULTS.GOOD_SCHOLASTIC_STANDING, PD_RESULTS.AVERAGE_SCHOLASTIC_STANDING].includes(result);
}

module.exports = {
    ENDORSEMENT_STAGES,
    SDO_RESULTS,
    GUIDANCE_RESULTS,
    PD_RESULTS,
    LEGACY_RESULTS,
    RESULT_LABELS,
    normalizeSdoAction,
    normalizeGuidanceAction,
    normalizePdAction,
    isSdoContinuingResult,
    isCanonicalPdResult,
};
