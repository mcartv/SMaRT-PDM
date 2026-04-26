const openingService = require('../services/openingService');

function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

async function getOpenings(req, res) {
    try {
        const userId = getRequestUserId(req);
        const result = await openingService.getOpeningsForMobile(userId);

        return res.status(200).json(result);
    } catch (error) {
        console.error('MOBILE OPENINGS ROUTE ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to load openings.',
        });
    }
}

async function getLatestOpening(req, res) {
    try {
        const userId = getRequestUserId(req);
        const item = await openingService.getLatestOpeningForMobile(userId);

        return res.status(200).json({ item });
    } catch (error) {
        console.error('LATEST OPENING ROUTE ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to load latest opening.',
        });
    }
}

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
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to submit application.',
        });
    }
}

module.exports = {
    getOpenings,
    getLatestOpening,
    applyToOpening,
};