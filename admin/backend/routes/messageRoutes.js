const express = require('express');

const router = express.Router();

const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoleGroup } = require('../middleware/rbacMiddleware');

router.use(protect, authorizeRoleGroup('ALL_STAFF'));

/*
  MOBILE LEGACY / COMPATIBILITY ROUTES
*/
router.get('/unread-count', messageController.getUnreadCount);
router.get('/thread', messageController.getThread);
router.post('/thread', messageController.sendThreadMessage);
router.patch('/thread/read', messageController.markThreadRead);

/*
  SCHOLAR PICKER
  Keep this before dynamic routes.
*/
router.get('/members/scholars', messageController.getScholarMembers);
router.get('/members/contacts', messageController.getMessagingContacts);

/*
  ARCHIVED THREADS
*/
router.get('/archived', messageController.getArchivedThreads);

/*
  PRIVATE CONVERSATIONS
*/
router.get('/conversations', messageController.getConversations);
router.get('/conversations/:counterpartyId', messageController.getConversationMessages);
router.get('/conversations/:counterpartyId/messages', messageController.getConversationMessages);
router.post('/conversations/:counterpartyId', messageController.sendMessage);
router.post('/conversations/:counterpartyId/messages', messageController.sendMessage);

router.patch('/conversations/:counterpartyId/read', messageController.markConversationRead);
router.patch('/conversations/:counterpartyId/unread', messageController.markConversationUnread);
router.patch('/conversations/:counterpartyId/read-state', messageController.setConversationReadState);
router.patch('/conversations/:counterpartyId/archive', messageController.archiveConversation);
router.patch('/conversations/:counterpartyId/restore', messageController.restoreConversation);

/*
  GROUP CHAT / ROOMS
*/
router.get('/rooms', messageController.getRooms);
router.post('/rooms', messageController.createRoom);

router.get('/rooms/:roomId/messages', messageController.getRoomMessages);
router.post('/rooms/:roomId/messages', messageController.sendRoomMessage);

router.get('/rooms/:roomId/members', messageController.getRoomMembers);
router.post('/rooms/:roomId/members', messageController.addRoomMembers);
router.delete('/rooms/:roomId/members/:memberId', messageController.removeRoomMember);
router.delete('/rooms/:roomId/leave', messageController.leaveRoom);
router.post('/rooms/:roomId/leave', messageController.leaveRoom);

router.patch('/rooms/:roomId/read', messageController.markRoomMessagesRead);
router.patch('/rooms/:roomId/unread', messageController.markRoomMessagesUnread);
router.patch('/rooms/:roomId/read-state', messageController.setRoomReadState);
router.patch('/rooms/:roomId/archive', messageController.archiveRoom);
router.patch('/rooms/:roomId/restore', messageController.restoreRoom);

module.exports = router;
