// SMaRT-PDM: Return of Obligations — notification Routes (mobile backend route); maps mobile API endpoints to middleware and controllers.
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.get('/', protect, notificationController.listMyNotifications);
router.get('/unread-count', protect, notificationController.getUnreadCount);

router.patch('/read-all', protect, notificationController.markAllNotificationsRead);
router.post('/read-all', protect, notificationController.markAllNotificationsRead);

router.patch('/me/read-all', protect, notificationController.markAllNotificationsRead);
router.post('/me/read-all', protect, notificationController.markAllNotificationsRead);

router.patch('/:notificationId/read', protect, notificationController.markNotificationRead);
router.post('/:notificationId/read', protect, notificationController.markNotificationRead);

router.delete('/:notificationId', protect, notificationController.deleteNotification);

router.post('/device-token', protect, notificationController.registerDeviceToken);

router.post('/internal', notificationController.createInternalUserNotification);

module.exports = router;