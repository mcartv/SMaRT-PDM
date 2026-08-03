const express = require('express');
const { protect, requireStaff } = require('../middleware/authMiddleware');
const supportTicketController = require('../controllers/supportTicketController');

const router = express.Router();

router.get('/me', protect, supportTicketController.getMyTickets);
router.post('/', protect, supportTicketController.createTicket);

router.get('/', protect, requireStaff, supportTicketController.getAllTickets);
router.patch('/:ticketId', protect, requireStaff, supportTicketController.updateTicket);

module.exports = router;
