// SMaRT-PDM: support Ticket Controller — support Ticket Controller (mobile backend controller); handles mobile API input/output and delegates business logic.
const supportTicketService = require('../services/supportTicketService');

// getRequestUserId: reads and returns get request user id for the support Ticket Controller flow.
function getRequestUserId(req) {
    return req.user?.user_id || req.user?.userId || req.user?.id || null;
}

// getSafeStatusCode: reads and returns get safe status code for the support Ticket Controller flow.
function getSafeStatusCode(error) {
    const parsed = Number.parseInt(error?.statusCode, 10);
    return Number.isInteger(parsed) && parsed >= 400 && parsed <= 599
        ? parsed
        : 500;
}

// getMyTickets: reads and returns get my tickets for the support Ticket Controller flow.
async function getMyTickets(req, res) {
    try {
        const userId = getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await supportTicketService.getMyTickets(userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('SUPPORT TICKETS ME ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load your support tickets.',
        });
    }
}

// createTicket: creates create ticket for the support Ticket Controller flow.
async function createTicket(req, res) {
    try {
        const userId = getRequestUserId(req);

        if (!userId) {
            return res.status(401).json({ error: 'Authentication required.' });
        }

        const result = await supportTicketService.createTicket(userId, req.body || {});
        return res.status(201).json(result);
    } catch (error) {
        console.error('SUPPORT TICKET CREATE ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to create support ticket.',
        });
    }
}

// getAllTickets: reads and returns get all tickets for the support Ticket Controller flow.
async function getAllTickets(req, res) {
    try {
        const result = await supportTicketService.getAllTickets(req.user || {});
        return res.status(200).json(result);
    } catch (error) {
        console.error('SUPPORT TICKET LIST ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to load support tickets.',
        });
    }
}

// updateTicket: updates update ticket for the support Ticket Controller flow.
async function updateTicket(req, res) {
    try {
        const result = await supportTicketService.updateTicket({
            authUser: req.user || {},
            ticketId: req.params.ticketId,
            body: req.body || {},
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('SUPPORT TICKET UPDATE ERROR:', error);
        return res.status(getSafeStatusCode(error)).json({
            error: error.message || 'Failed to update support ticket.',
        });
    }
}

module.exports = {
    getMyTickets,
    createTicket,
    getAllTickets,
    updateTicket,
};