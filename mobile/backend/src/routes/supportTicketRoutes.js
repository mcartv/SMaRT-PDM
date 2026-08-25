const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const supportTicketController = require('../controllers/supportTicketController');

const router = express.Router();

router.get('/me', protect, supportTicketController.getMyTickets);
router.post('/', protect, supportTicketController.createTicket);

router.get('/', protect, supportTicketController.getAllTickets);
router.patch('/:ticketId', protect, supportTicketController.updateTicket);

module.exports = router;