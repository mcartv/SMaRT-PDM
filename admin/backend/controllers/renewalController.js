const renewalService = require('../services/renewalService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function getStatusCode(error) {
    const statusCode = Number(error?.statusCode || error?.status || 500);
    return statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
}

function emitRenewalUpdated(req, action, payload = {}) {
    const io = req.app?.get?.('io');

    if (!io) return;

    const realtimePayload = {
        action,
        source: 'admin-renewal-controller',
        updated_at: new Date().toISOString(),
        ...payload,
    };

    if (typeof socketEvents?.renewalUpdated === 'function') {
        socketEvents.renewalUpdated(io, realtimePayload);
    }

    if (typeof socketEvents?.emitEvent === 'function') {
        socketEvents.emitEvent(io, 'renewal:updated', realtimePayload);
        socketEvents.emitEvent(io, `renewal:${action}`, realtimePayload);
    } else {
        io.emit('renewal:updated', realtimePayload);
        io.emit(`renewal:${action}`, realtimePayload);
    }
}

async function writeAudit(req, action, entityId, metadata = {}) {
    try {
        if (typeof auditLogService?.logAudit !== 'function') {
            return;
        }

        await auditLogService.logAudit({
            req,
            userId:
                req.user?.user_id ||
                req.user?.userId ||
                req.user?.id ||
                null,
            actionTaken: `RENEWAL_${String(action || '').toUpperCase()}`,
            module: 'Renewals',
            entityType: 'renewal',
            entityId: entityId ? String(entityId) : null,
            description: `Renewal ${action} completed.`,
            metadata,
        });
    } catch (error) {
        console.error('RENEWAL AUDIT ERROR:', error.message);
    }
}

exports.getRenewals = async (req, res) => {
    try {
        const payload = await renewalService.fetchRenewals();
        return res.status(200).json(payload);
    } catch (error) {
        console.error('RENEWAL CONTROLLER ERROR:', error.message);
        return res.status(getStatusCode(error)).json({
            error: error.message || 'Failed to load renewals.',
        });
    }
};

exports.getRenewalDetails = async (req, res) => {
    try {
        const payload = await renewalService.fetchRenewalDetailsById(req.params.id);
        return res.status(200).json(payload);
    } catch (error) {
        console.error('RENEWAL DETAIL CONTROLLER ERROR:', error.message);
        return res.status(getStatusCode(error)).json({
            error: error.message || 'Failed to load renewal details.',
        });
    }
};

exports.saveRenewalReview = async (req, res) => {
    try {
        const payload = await renewalService.saveRenewalReview(
            req.params.id,
            req.body,
            req.user
        );

        const action = String(req.body?.final_action || 'updated')
            .trim()
            .toLowerCase();

        emitRenewalUpdated(req, action, {
            renewal_id: req.params.id,
            status: payload?.renewal?.status || null,
            data: payload,
        });

        await writeAudit(req, action, req.params.id, {
            final_action: req.body?.final_action || null,
            document_review_count: Array.isArray(req.body?.document_reviews)
                ? req.body.document_reviews.length
                : 0,
        });

        return res.status(200).json({
            message: 'Renewal review saved successfully.',
            data: payload,
        });
    } catch (error) {
        console.error('RENEWAL REVIEW CONTROLLER ERROR:', error.message);
        return res.status(getStatusCode(error)).json({
            error: error.message || 'Failed to save renewal review.',
        });
    }
};