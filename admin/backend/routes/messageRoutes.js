const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// PRIVATE
router.get('/conversations', protect, messageController.getConversations);
router.get('/conversations/:counterpartyId', protect, messageController.getConversationMessages);
router.patch('/conversations/:counterpartyId/read', protect, messageController.markConversationRead);
router.post('/conversations/:counterpartyId', protect, messageController.sendMessage);

// GROUP CHAT / ROOMS
router.get('/rooms', protect, messageController.getRooms);
router.post('/rooms', protect, messageController.createRoom);
router.get('/rooms/:roomId/messages', protect, messageController.getRoomMessages);
router.post('/rooms/:roomId/messages', protect, messageController.sendRoomMessage);
router.post('/rooms/:roomId/members', protect, messageController.addRoomMembers);
router.patch('/rooms/:roomId/read', protect, messageController.markRoomMessagesRead);

// SCHOLAR PICKER
router.get('/members/scholars', protect, messageController.getScholarMembers);

module.exports = router;