const supportTicketService = require('../services/supportTicketService');
const auditLogService = require('../services/auditLogService');
const socketEvents = require('../utils/socketEvents');

function getActorUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

async function writeTicketAudit(req, actionTaken, description, ticketId, metadata = {}) {
    try {
        if (typeof auditLogService?.logAudit !== 'function') return;

        await auditLogService.logAudit({
            req,
            userId: getActorUserId(req),
            actionTaken,
            module: 'Support Tickets',
            entityType: 'support_ticket',
            entityId: ticketId ? String(ticketId) : null,
            description,
            metadata,
        });
    } catch (error) {
        console.error('SUPPORT TICKET AUDIT ERROR:', error.message);
    }
}

exports.getSupportTickets = async (req, res) => {
    try {
        const items = await supportTicketService.fetchSupportTickets();

        res.status(200).json({
            items,
        });
    } catch (err) {
        console.error('GET SUPPORT TICKETS CONTROLLER ERROR:', err);
        res.status(500).json({
            error: err.message || 'Failed to load support tickets',
        });
    }
};

exports.updateSupportTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { status, assignToSelf } = req.body || {};

        const updated = await supportTicketService.updateSupportTicket(ticketId, {
            status,
            assignToSelf,
            currentUser: req.user,
        });

        const io = req.app.get('io');
        const eventPayload = {
            ticket_id: ticketId,
            status: updated.status,
            updated_at: new Date().toISOString()
        };

        socketEvents.ticketUpdated(io, eventPayload);

        if (String(updated.status || '').toLowerCase() === 'resolved') {
            socketEvents.ticketResolved(io, eventPayload);
        }

        socketEvents.reportUpdated(io, {
            module: 'reports',
            source: 'support_tickets',
            action: 'updated',
            ticket_id: ticketId,
            updated_at: eventPayload.updated_at,
        });

        await writeTicketAudit(
            req,
            'UPDATE_SUPPORT_TICKET',
            `Updated support ticket status to ${updated.status || status || 'updated'}.`,
            ticketId,
            {
                status: updated.status || status || null,
                assignToSelf: !!assignToSelf,
                changes: req.body || {},
            }
        );

        res.status(200).json({
            data: updated,
        });
    } catch (err) {
        console.error('UPDATE SUPPORT TICKET CONTROLLER ERROR:', err);

        const statusCode =
            err.message === 'Support ticket not found'
                ? 404
                : err.message === 'Nothing to update'
                    ? 400
                    : err.message === 'Invalid status value'
                        ? 400
                        : 500;

        res.status(statusCode).json({
            error: err.message || 'Failed to update support ticket',
        });
    }
};