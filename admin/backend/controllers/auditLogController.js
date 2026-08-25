const auditLogService = require('../services/auditLogService');

function getActorUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.sub || null;
}

function sendError(res, err, fallbackMessage) {
    const message = err.message || fallbackMessage;

    return res.status(err.statusCode || 500).json({
        success: false,
        message,
        error: { message },
    });
}

exports.verifyAuditPassword = async (req, res) => {
    try {
        const result = await auditLogService.verifyAuditPassword({
            userId: getActorUserId(req),
            password: req.body?.password,
        });

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (err) {
        console.error('VERIFY AUDIT PASSWORD ERROR:', err);
        return sendError(res, err, 'Failed to verify audit password.');
    }
};

exports.getAuditLogs = async (req, res) => {
    try {
        const auditAccessToken = req.get('x-audit-access-token');

        auditLogService.verifyAuditAccessToken(
            auditAccessToken,
            getActorUserId(req)
        );

        const data = await auditLogService.listAuditLogs({
            limit: req.query.limit,
            offset: req.query.offset,
            search: req.query.search,
            module: req.query.module,
        });

        return res.status(200).json({
            success: true,
            ...data,
        });
    } catch (err) {
        console.error('GET AUDIT LOGS ERROR:', err);
        return sendError(res, err, 'Failed to load audit logs.');
    }
};

exports.getMyRecentActivity = async (req, res) => {
    try {
        const items = await auditLogService.listRecentActivityForUser({
            userId: getActorUserId(req),
            limit: req.query.limit,
        });

        return res.status(200).json({
            success: true,
            items,
        });
    } catch (err) {
        console.error('GET MY RECENT ACTIVITY ERROR:', err);
        return sendError(res, err, 'Failed to load recent activity.');
    }
};
