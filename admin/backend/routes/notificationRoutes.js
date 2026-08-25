const express = require('express');
const router = express.Router();

const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

/**
 * Notification Routes
 *
 * Naming rule:
 * - No DELETE route here.
 * - Soft-delete behavior is named archive.
 * - Bringing back archived records is named restore.
 */

router.get(
    '/',
    protect,
    notificationController.getMyNotifications
);

router.get(
    '/unread-count',
    protect,
    notificationController.getUnreadCount
);

router.patch(
    '/read-all',
    protect,
    notificationController.markAllAsRead
);

router.patch(
    '/:notificationId/read',
    protect,
    notificationController.markAsRead
);

router.patch(
    '/:notificationId/archive',
    protect,
    notificationController.archiveNotification
);

router.patch(
    '/:notificationId/restore',
    protect,
    notificationController.restoreNotification
);

router.post(
    '/announcement',
    protect,
    notificationController.createAnnouncementNotifications
);

module.exports = router;