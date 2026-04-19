const supportTicketService = require('../services/supportTicketService');
const socketEvents = require('../utils/socketEvents');

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
        socketEvents.ticketUpdated(io, {
            ticket_id: ticketId,
            status: updated.status,
            updated_at: new Date().toISOString()
        });

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