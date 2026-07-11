const express = require('express');
const router = express.Router();

const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// ARCHIVED THREADS
router.get('/archived', protect, messageController.getArchivedThreads);

// PRIVATE
router.get('/conversations', protect, messageController.getConversations);
router.get('/conversations/:counterpartyId', protect, messageController.getConversationMessages);
router.patch('/conversations/:counterpartyId/read', protect, messageController.markConversationRead);
router.patch('/conversations/:counterpartyId/unread', protect, messageController.markConversationUnread);
router.patch('/conversations/:counterpartyId/read-state', protect, messageController.setConversationReadState);
router.patch('/conversations/:counterpartyId/archive', protect, messageController.archiveConversation);
router.patch('/conversations/:counterpartyId/restore', protect, messageController.restoreConversation);
router.post('/conversations/:counterpartyId', protect, messageController.sendMessage);

// GROUP CHAT / ROOMS
router.get('/rooms', protect, messageController.getRooms);
router.post('/rooms', protect, messageController.createRoom);
router.get('/rooms/:roomId/messages', protect, messageController.getRoomMessages);
router.post('/rooms/:roomId/messages', protect, messageController.sendRoomMessage);
router.post('/rooms/:roomId/members', protect, messageController.addRoomMembers);
router.patch('/rooms/:roomId/read', protect, messageController.markRoomMessagesRead);
router.patch('/rooms/:roomId/unread', protect, messageController.markRoomMessagesUnread);
router.patch('/rooms/:roomId/read-state', protect, messageController.setRoomReadState);
router.patch('/rooms/:roomId/archive', protect, messageController.archiveRoom);
router.patch('/rooms/:roomId/restore', protect, messageController.restoreRoom);

// SCHOLAR PICKER
router.get('/members/scholars', protect, messageController.getScholarMembers);

module.exports = router;