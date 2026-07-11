const express = require('express');
const router = express.Router();

const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.get('/conversations', protect, messageController.getConversations);
router.get('/conversations/:counterpartyId', protect, messageController.getConversation);
router.get('/thread', protect, messageController.getThread);
router.post('/thread', protect, messageController.sendThreadMessage);
router.patch('/thread/read', protect, messageController.markThreadRead);

module.exports = router;
