const express = require('express');
const router = express.Router();

const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.get('/unread-count', protect, messageController.getUnreadCount);

router.get('/thread', protect, messageController.getThread);
router.post('/thread', protect, messageController.sendThreadMessage);
router.patch('/thread/read', protect, messageController.markThreadRead);
router.patch('/thread/archive', protect, messageController.archiveThread);
router.patch('/thread/restore', protect, messageController.restoreThread);
router.get('/archived', protect, messageController.getArchivedThreads);

router.get('/conversations', protect, messageController.getConversations);
router.get(
    '/conversations/:counterpartyId',
    protect,
    messageController.getConversation
);
router.post(
    '/conversations/:counterpartyId',
    protect,
    messageController.sendConversationMessage
);
router.patch(
    '/conversations/:counterpartyId/read',
    protect,
    messageController.markConversationRead
);

router.get('/rooms', protect, messageController.getRooms);
router.post('/rooms', protect, messageController.createRoom);

router.get('/rooms/:roomId/thread', protect, messageController.getRoomThread);
router.get('/rooms/:roomId/messages', protect, messageController.getRoomThread);

router.post('/rooms/:roomId/send', protect, messageController.sendRoomMessage);
router.post('/rooms/:roomId/messages', protect, messageController.sendRoomMessage);

router.patch('/rooms/:roomId/read', protect, messageController.markRoomThreadRead);
router.patch('/rooms/:roomId/archive', protect, messageController.archiveRoom);
router.patch('/rooms/:roomId/restore', protect, messageController.restoreRoom);
router.get('/rooms/:roomId/members', protect, messageController.getRoomMembers);

router.post('/rooms/:roomId/members', protect, messageController.addRoomMembers);
router.delete(
    '/rooms/:roomId/members/:memberId',
    protect,
    messageController.removeRoomMember
);
router.delete('/rooms/:roomId/leave', protect, messageController.leaveRoom);
router.post('/rooms/:roomId/leave', protect, messageController.leaveRoom);

module.exports = router;