const express = require('express');

const router = express.Router();

const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

/*
  MOBILE LEGACY / COMPATIBILITY ROUTES
*/
router.get('/unread-count', protect, messageController.getUnreadCount);
router.get('/thread', protect, messageController.getThread);
router.post('/thread', protect, messageController.sendThreadMessage);
router.patch('/thread/read', protect, messageController.markThreadRead);

/*
  SCHOLAR PICKER
  Keep this before dynamic routes.
*/
router.get('/members/scholars', protect, messageController.getScholarMembers);

/*
  ARCHIVED THREADS
*/
router.get('/archived', protect, messageController.getArchivedThreads);

/*
  PRIVATE CONVERSATIONS
*/
router.get('/conversations', protect, messageController.getConversations);
router.get('/conversations/:counterpartyId', protect, messageController.getConversationMessages);
router.get('/conversations/:counterpartyId/messages', protect, messageController.getConversationMessages);
router.post('/conversations/:counterpartyId', protect, messageController.sendMessage);
router.post('/conversations/:counterpartyId/messages', protect, messageController.sendMessage);

router.patch('/conversations/:counterpartyId/read', protect, messageController.markConversationRead);
router.patch('/conversations/:counterpartyId/unread', protect, messageController.markConversationUnread);
router.patch('/conversations/:counterpartyId/read-state', protect, messageController.setConversationReadState);
router.patch('/conversations/:counterpartyId/archive', protect, messageController.archiveConversation);
router.patch('/conversations/:counterpartyId/restore', protect, messageController.restoreConversation);

/*
  GROUP CHAT / ROOMS
*/
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

module.exports = router;