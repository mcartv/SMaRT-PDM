const dashboardService = require('../services/dashboardService');
const auditLogService = require('../services/auditLogService');

function getActorUserId(req) {
    return (
        req.user?.user_id ||
        req.user?.userId ||
        req.user?.id ||
        null
    );
}

async function writeDashboardAudit(req, dashboardPayload) {
    try {
        if (typeof auditLogService?.logAudit !== 'function') return;

        const summary = Array.isArray(
            dashboardPayload?.summaryCards
        )
            ? dashboardPayload.summaryCards
            : [];

        const actions = Array.isArray(
            dashboardPayload?.actionSummary
        )
            ? dashboardPayload.actionSummary
            : [];

        const summaryMap = summary.reduce((acc, item) => {
            acc[item.key] = item.value;
            return acc;
        }, {});

        const actionMap = actions.reduce((acc, item) => {
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
            description:
                'Viewed admin dashboard operational summary.',
            metadata: {
                total_applications:
                    summaryMap.total_applications || 0,
                needs_action:
                    summaryMap.needs_action || 0,
                ready_for_activation:
                    summaryMap.ready_for_activation || 0,
                waitlisted:
                    summaryMap.waitlisted || 0,
                active_scholars:
                    summaryMap.active_scholars || 0,
                open_openings:
                    summaryMap.open_openings || 0,
                active_payouts:
                    summaryMap.active_payouts || 0,
                benefactors:
                    summaryMap.benefactors || 0,
                requirements_review:
                    actionMap.requirements_review || 0,
                endorsement_review:
                    actionMap.endorsement_review || 0,
                renewals_pending:
                    actionMap.renewals_pending || 0,
                ro_attention:
                    actionMap.ro_attention || 0,
                payout_pending:
                    actionMap.payout_pending || 0,
                generated_at:
                    dashboardPayload?.generatedAt ||
                    new Date().toISOString(),
            },
        });
    } catch (err) {
        console.error(
            'DASHBOARD AUDIT LOG ERROR:',
            err.message
        );
    }
}

exports.getAdminDashboard = async (req, res) => {
    try {
        const payload =
            await dashboardService.getAdminDashboard();

        if (String(req.query.audit || '') === '1') {
            await writeDashboardAudit(req, payload);
        }

        res.status(200).json(payload);
    } catch (err) {
        console.error(
            'GET ADMIN DASHBOARD ERROR:',
            err.message
        );

        res.status(err.statusCode || 500).json({
            message: 'Failed to load dashboard data',
            error: err.message,
        });
    }
};
