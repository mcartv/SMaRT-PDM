const test = require('node:test');
const assert = require('node:assert/strict');

const {
    SDO_RESULTS,
    GUIDANCE_RESULTS,
    PD_RESULTS,
    normalizeSdoAction,
    normalizeGuidanceAction,
    normalizePdAction,
    isSdoContinuingResult,
} = require('../utils/endorsementContract');

test('SDO canonical results match the official slip and only minor/no-offense continue', () => {
    assert.equal(normalizeSdoAction('no_offense'), SDO_RESULTS.NO_OFFENSE);
    assert.equal(normalizeSdoAction('minor_offense'), SDO_RESULTS.MINOR_OFFENSE);
    assert.equal(normalizeSdoAction('major_offense'), SDO_RESULTS.MAJOR_OFFENSE);
    assert.equal(isSdoContinuingResult(SDO_RESULTS.NO_OFFENSE), true);
    assert.equal(isSdoContinuingResult(SDO_RESULTS.MINOR_OFFENSE), true);
    assert.equal(isSdoContinuingResult(SDO_RESULTS.MAJOR_OFFENSE), false);
});

test('legacy SDO action aliases normalize to canonical results during rollout', () => {
    assert.equal(normalizeSdoAction('clear'), SDO_RESULTS.NO_OFFENSE);
    assert.equal(normalizeSdoAction('disqualify_minor'), SDO_RESULTS.MINOR_OFFENSE);
    assert.equal(normalizeSdoAction('disqualify_major'), SDO_RESULTS.MAJOR_OFFENSE);
});

test('Guidance only accepts Good Moral Standing', () => {
    assert.equal(
        normalizeGuidanceAction('good_moral_standing'),
        GUIDANCE_RESULTS.GOOD_MORAL_STANDING
    );
    assert.equal(normalizeGuidanceAction('clear'), GUIDANCE_RESULTS.GOOD_MORAL_STANDING);
    assert.equal(normalizeGuidanceAction('hold'), null);
    assert.equal(normalizeGuidanceAction('reject'), null);
});

test('PD only accepts explicit scholastic standing values', () => {
    assert.equal(
        normalizePdAction('good_scholastic_standing'),
        PD_RESULTS.GOOD_SCHOLASTIC_STANDING
    );
    assert.equal(
        normalizePdAction('average_scholastic_standing'),
        PD_RESULTS.AVERAGE_SCHOLASTIC_STANDING
    );
    assert.equal(
        normalizePdAction('approve', { scholasticStanding: 'good_scholastic_standing' }),
        PD_RESULTS.GOOD_SCHOLASTIC_STANDING
    );
    assert.equal(
        normalizePdAction('approve', { scholasticStanding: 'average_scholastic_standing' }),
        PD_RESULTS.AVERAGE_SCHOLASTIC_STANDING
    );
    assert.equal(normalizePdAction('reject'), null);
});
