const payoutService = require('../services/payoutService');

function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

function getSafeStatusCode(error) {
    const parsed = Number.parseInt(error?.statusCode, 10);
    return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
        ? parsed
        : 500;
}

async function createPayoutBatch(req, res) {
    try {
        const adminUserId = getRequestUserId(req);

        const result = await payoutService.createPayoutBatch({
            adminUserId,
            body: req.body || {},
        });

        return res.status(201).json(result);
    } catch (error) {
        console.error('CREATE PAYOUT BATCH ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to create payout batch.',
        });
    }
}

async function schedulePayoutBatch(req, res) {
    try {
        const adminUserId = getRequestUserId(req);

        const result = await payoutService.schedulePayoutBatch({
            adminUserId,
            payoutBatchId: req.params.payoutBatchId,
            body: req.body || {},
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('SCHEDULE PAYOUT BATCH ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to schedule payout batch.',
        });
    }
}

async function getMyPayouts(req, res) {
  try {
    const userId = getRequestUserId(req);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    const result = await payoutService.getMyPayouts(userId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('GET MY PAYOUTS ERROR:', error);

    return res.status(getSafeStatusCode(error)).json({
      error: error.message || 'Failed to load payout schedule.',
    });
  }
}

module.exports = {
    createPayoutBatch,
    schedulePayoutBatch,
    getMyPayouts,
};