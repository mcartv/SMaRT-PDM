const renewalService = require('../services/renewalService');

function getUserId(req) {
    return (
        req.user?.userId ||
        req.user?.user_id ||
        req.user?.id ||
        req.user?.sub ||
        null
    );
}

function getStatusCode(error) {
    const statusCode = Number(error?.statusCode || error?.status || 500);
    return statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
}

function emitRenewalUpdated(req, action, payload = {}) {
    const io = req.app?.get?.('io');

    if (!io) return;

    const realtimePayload = {
        source: 'mobile-renewal-controller',
        action,
        updated_at: new Date().toISOString(),
        ...payload,
    };

    io.emit('renewal:updated', realtimePayload);
    io.emit('renewalUpdated', realtimePayload);
}

exports.getCurrentRenewal = async (req, res) => {
    try {
        const payload = await renewalService.fetchCurrentRenewal(getUserId(req));
        return res.status(200).json(payload);
    } catch (error) {
        console.error('GET CURRENT RENEWAL ERROR:', error.message);
        return res.status(getStatusCode(error)).json({
            error: error.message || 'Failed to load renewal package.',
        });
    }
};

exports.uploadDocument = async (req, res) => {
    try {
        const payload = await renewalService.uploadDocument({
            userId: getUserId(req),
            routeParam: req.params.routeParam,
            file: req.file,
        });

        emitRenewalUpdated(req, 'document-uploaded', {
            route_param: req.params.routeParam,
            renewal_id: payload?.renewal?.renewal_id || null,
        });

        return res.status(200).json(payload);
    } catch (error) {
        console.error('UPLOAD RENEWAL DOCUMENT ERROR:', error.message);
        return res.status(getStatusCode(error)).json({
            error: error.message || 'Failed to upload renewal document.',
        });
    }
};

exports.submitRenewal = async (req, res) => {
    try {
        const payload = await renewalService.submitRenewal(getUserId(req));

        emitRenewalUpdated(req, 'submitted', {
            renewal_id: payload?.renewal?.renewal_id || null,
            status: payload?.renewal?.renewal_status || null,
        });

        return res.status(200).json(payload);
    } catch (error) {
        console.error('SUBMIT RENEWAL ERROR:', error.message);
        return res.status(getStatusCode(error)).json({
            error: error.message || 'Failed to submit renewal.',
        });
    }
};