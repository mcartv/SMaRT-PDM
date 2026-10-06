// SMaRT-PDM: Payout — payout Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const payoutService = require('../services/payoutService');
const adminRealtimeRelayService = require('../services/adminRealtimeRelayService');

// getRequestUserId: reads and returns get request user id for the Payout flow.
function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

// getSafeStatusCode: reads and returns get safe status code for the Payout flow.
function getSafeStatusCode(error) {
    const parsed = Number.parseInt(error?.statusCode, 10);
    return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
        ? parsed
        : 500;
}

// createPayoutBatch: creates create payout batch for the Payout flow.
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

// schedulePayoutBatch: handles schedule payout batch for the Payout flow.
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

// getMyPayouts: reads and returns get my payouts for the Payout flow.
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

// updatePayoutEntryStatus: updates update payout entry status for the Payout flow.
async function updatePayoutEntryStatus(req, res) {
    try {
        const adminUserId = getRequestUserId(req);

        const result = await payoutService.updatePayoutEntryStatus({
            adminUserId,
            payoutEntryId: req.params.payoutEntryId,
            body: req.body || {},
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('UPDATE PAYOUT ENTRY STATUS ERROR:', error);

        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to update payout status.',
        });
    }
}


// uploadMyPayoutProof: uploads upload my payout proof for the Payout flow.
async function uploadMyPayoutProof(req, res) {
    try {
        const userId = getRequestUserId(req);
        const result = await payoutService.uploadMyPayoutProof(
            userId,
            req.params.payoutEntryId,
            req.file
        );

        const realtimePayload = {
            payout_entry_id: req.params.payoutEntryId,
            payout_proof_id: result.proof?.payout_proof_id || null,
            proof_status: result.proof?.proof_status || 'Pending Review',
            updated_at: new Date().toISOString(),
        };

        const io = req.app.get('io');
        if (io) {
            io.emit('payout:proof-submitted', realtimePayload);
        }

        adminRealtimeRelayService
            .relayPayoutEvent('payout:proof-submitted', realtimePayload)
            .catch((relayError) => {
                console.error(
                    'PAYOUT PROOF ADMIN REALTIME RELAY ERROR:',
                    relayError.message
                );
            });

        return res.status(200).json(result);
    } catch (error) {
        console.error('UPLOAD MY PAYOUT PROOF ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to upload payout proof.',
        });
    }
}

module.exports = {
    createPayoutBatch,
    schedulePayoutBatch,
    getMyPayouts,
    updatePayoutEntryStatus,
    uploadMyPayoutProof
};