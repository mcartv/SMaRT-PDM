// SMaRT-PDM: Applications — admin Application Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const adminApplicationService = require('../services/adminApplicationService');

// getRequestUserId: reads and returns get request user id for the Applications flow.
function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

// getSafeStatusCode: reads and returns get safe status code for the Applications flow.
function getSafeStatusCode(error) {
    const parsed = Number.parseInt(error?.statusCode, 10);
    return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
        ? parsed
        : 500;
}

// getApplications: reads and returns get applications for the Applications flow.
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

// getApplicationById: reads and returns get application by id for the Applications flow.
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

// approveApplication: handles approve application for the Applications flow.
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

// rejectApplication: handles reject application for the Applications flow.
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