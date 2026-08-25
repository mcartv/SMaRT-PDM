const adminApplicationService = require('../services/adminApplicationService');

function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

function getSafeStatusCode(error) {
    const parsed = Number.parseInt(error?.statusCode, 10);
    return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
        ? parsed
        : 500;
}

async function getApplications(req, res) {
    try {
        const result = await adminApplicationService.getApplications(req.query || {});
        return res.status(200).json(result);
    } catch (error) {
        console.error('ADMIN GET APPLICATIONS ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load applications.',
        });
    }
}

async function getApplicationById(req, res) {
    try {
        const result = await adminApplicationService.getApplicationById(
            req.params.applicationId
        );

        return res.status(200).json(result);
    } catch (error) {
        console.error('ADMIN GET APPLICATION DETAIL ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load application.',
        });
    }
}

async function approveApplication(req, res) {
    try {
        const adminUserId = getRequestUserId(req);

        const result = await adminApplicationService.approveApplication({
            applicationId: req.params.applicationId,
            adminUserId,
            remarks: req.body?.remarks,
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('ADMIN APPROVE APPLICATION ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to approve application.',
        });
    }
}

async function rejectApplication(req, res) {
    try {
        const adminUserId = getRequestUserId(req);

        const result = await adminApplicationService.rejectApplication({
            applicationId: req.params.applicationId,
            adminUserId,
            rejectionReason: req.body?.rejection_reason || req.body?.reason,
            remarks: req.body?.remarks,
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('ADMIN REJECT APPLICATION ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to reject application.',
        });
    }
}

module.exports = {
    getApplications,
    getApplicationById,
    approveApplication,
    rejectApplication,
};