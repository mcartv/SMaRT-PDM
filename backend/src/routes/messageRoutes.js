const express = require('express');
const router = express.Router();

const messageController = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.get('/unread-count', protect, messageController.getUnreadCount);

router.get('/thread', protect, messageController.getThread);
router.post('/thread', protect, messageController.sendThreadMessage);
router.patch('/thread/read', protect, messageController.markThreadRead);

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

router.post('/rooms/:roomId/members', protect, messageController.addRoomMembers);
router.delete(
    '/rooms/:roomId/members/:memberId',
    protect,
    messageController.removeRoomMember
);

module.exports = router;