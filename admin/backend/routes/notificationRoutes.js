const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, notificationController.getMyNotifications);
router.get('/unread-count', protect, notificationController.getUnreadCount);
router.patch('/read-all', protect, notificationController.markAllAsRead);
router.patch('/:notificationId/read', protect, notificationController.markAsRead);
router.delete('/:notificationId', protect, notificationController.deleteNotification);
router.post('/announcements', protect, notificationController.createAnnouncementNotifications);

module.exports = router;
