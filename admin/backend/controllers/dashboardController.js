const dashboardService = require('../services/dashboardService');
const auditLogService = require('../services/auditLogService');

function getActorUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

async function writeDashboardAudit(req, dashboardPayload) {
    try {
        if (typeof auditLogService?.logAudit !== 'function') return;

        const summary = Array.isArray(dashboardPayload?.summaryCards)
            ? dashboardPayload.summaryCards
            : [];

        const summaryMap = summary.reduce((acc, item) => {
            acc[item.key] = item.value;
            return acc;
        }, {});

        await auditLogService.logAudit({
            req,
            userId: getActorUserId(req),
            actionTaken: 'VIEW_ADMIN_DASHBOARD',
            module: 'Dashboard',
            entityType: 'dashboard',
            entityId: 'admin_dashboard',
            description: 'Viewed admin dashboard operational summary.',
            metadata: {
                total_applications: summaryMap.total_applications || 0,
                pending_review: summaryMap.pending_review || 0,
                verified_documents: summaryMap.verified_documents || 0,
                active_scholars: summaryMap.active_scholars || 0,
                generated_at: dashboardPayload?.generatedAt || new Date().toISOString(),
            },
        });
    } catch (err) {
        console.error('DASHBOARD AUDIT LOG ERROR:', err.message);
    }
}

exports.getAdminDashboard = async (req, res) => {
    try {
        const payload = await dashboardService.getAdminDashboard();

        if (String(req.query.audit || '') === '1') {
            await writeDashboardAudit(req, payload);
        }

        res.status(200).json(payload);
    } catch (err) {
        console.error('GET ADMIN DASHBOARD ERROR:', err.message);
        res.status(err.statusCode || 500).json({
            message: 'Failed to load dashboard data',
            error: err.message,
        });
    }
};