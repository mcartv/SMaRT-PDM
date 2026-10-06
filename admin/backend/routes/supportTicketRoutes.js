// SMaRT-PDM: Return of Obligations — support Ticket Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const router = express.Router();

const supportTicketController = require('../controllers/supportTicketController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get(
    '/',
    protect,
    authorizeRoles('admin', 'sdo'),
    supportTicketController.getSupportTickets
);

router.patch(
    '/:ticketId',
    protect,
    authorizeRoles('admin', 'sdo'),
    supportTicketController.updateSupportTicket
);

module.exports = router;