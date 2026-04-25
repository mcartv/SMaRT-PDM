const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.get('/', protect, notificationController.getMyNotifications);
router.get('/me', protect, notificationController.getMyNotifications);
router.get('/unread-count', protect, notificationController.getUnreadCount);

router.post('/device-token', protect, notificationController.registerDeviceToken);

router.patch('/me/read-all', protect, notificationController.markAllAsRead);
router.patch('/read-all', protect, notificationController.markAllAsRead);
router.patch('/:notificationId/read', protect, notificationController.markAsRead);

router.delete('/:notificationId', protect, notificationController.deleteNotification);

// For admin backend/internal relay if still needed
router.post('/internal/user', notificationController.createInternalUserNotification);

module.exports = router;