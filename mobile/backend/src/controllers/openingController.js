// SMaRT-PDM: Scholarship Openings — opening Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const openingService = require('../services/openingService');
const { getSafeStatusCode } = require('../utils/httpStatus');

// getRequestUserId: reads and returns get request user id for the Scholarship Openings flow.
function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

// getOpenings: reads and returns get openings for the Scholarship Openings flow.
async function getOpenings(req, res) {
    try {
        // Availability is operational state. Never let a browser, proxy, or
        // service worker reuse a response after an admin closes an opening.
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        const userId = getRequestUserId(req);
        const result = await openingService.getOpeningsForMobile(userId);

        return res.status(200).json(result);
    } catch (error) {
        console.error('MOBILE OPENINGS ROUTE ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load openings.',
            code: error.code || undefined,
        });
    }
}

// getLatestOpening: reads and returns get latest opening for the Scholarship Openings flow.
async function getLatestOpening(req, res) {
    try {
        res.setHeader('Cache-Control', 'private, no-store, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        const userId = getRequestUserId(req);
        const result = await openingService.getLatestOpeningForMobile(userId);

        return res.status(200).json(result);
    } catch (error) {
        console.error('LATEST OPENING ROUTE ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load latest opening.',
            code: error.code || undefined,
        });
    }
}

// applyToOpening: handles apply to opening for the Scholarship Openings flow.
async function applyToOpening(req, res) {
    try {
        const userId = getRequestUserId(req);
        const { openingId } = req.params;

        const result = await openingService.applyToOpeningForMobile(
            userId,
            openingId,
            req.body || {}
        );

        return res.status(201).json(result);
    } catch (error) {
        console.error('APPLY TO OPENING ROUTE ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to submit application.',
            code: error.code || undefined,
        });
    }
}

module.exports = {
    getOpenings,
    getLatestOpening,
    applyToOpening,
};
