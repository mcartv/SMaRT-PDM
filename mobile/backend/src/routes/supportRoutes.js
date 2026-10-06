// SMaRT-PDM: Return of Obligations — support Routes (mobile backend route); maps mobile API endpoints to middleware and controllers.
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const supportController = require('../controllers/supportController');

const router = express.Router();

router.get('/support-tickets', protect, supportController.getSupportTickets);
router.post('/support-tickets', protect, supportController.createSupportTicket);

module.exports = router;