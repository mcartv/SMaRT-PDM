const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const supportController = require('../controllers/supportController');

const router = express.Router();

router.get('/support-tickets', protect, supportController.getSupportTickets);
router.post('/support-tickets', protect, supportController.createSupportTicket);

module.exports = router;