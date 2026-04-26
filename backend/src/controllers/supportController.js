const supportService = require('../services/supportService');

function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

function isSupportAdmin(req) {
    return !!(
        req.user?.adminId ||
        req.user?.admin_id ||
        ['admin', 'sdo'].includes((req.user?.role || '').toString().toLowerCase())
    );
}

async function getSupportTickets(req, res) {
    try {
        if (!isSupportAdmin(req)) {
            return res.status(403).json({
                error: 'Only staff accounts can access support tickets.',
            });
        }

        const items = await supportService.listSupportTicketsForAdmin();
        return res.status(200).json({ items });
    } catch (error) {
        console.error('SUPPORT TICKET LIST ROUTE ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to load support tickets.',
        });
    }
}

async function createSupportTicket(req, res) {
    try {
        const userId = getRequestUserId(req);

        const issueCategory = (req.body?.issue_category || '').toString().trim();
        const description = (req.body?.description || '').toString().trim();

        if (!issueCategory) {
            return res.status(400).json({ error: 'issue_category is required.' });
        }

        if (issueCategory.length > 50) {
            return res.status(400).json({
                error: 'issue_category must be 50 characters or fewer.',
            });
        }

        if (!description) {
            return res.status(400).json({ error: 'description is required.' });
        }

        const data = await supportService.createSupportTicket({
            userId,
            issueCategory,
            description,
        });

        return res.status(201).json({
            message: 'Support ticket created successfully.',
            data,
        });
    } catch (error) {
        console.error('SUPPORT TICKET CREATE ROUTE ERROR:', error);
        return res.status(error.statusCode || 500).json({
            error: error.message || 'Failed to create support ticket.',
        });
    }
}

module.exports = {
    getSupportTickets,
    createSupportTicket,
};