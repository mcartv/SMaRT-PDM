const express = require('express');
const router = express.Router();

const notificationController = require('../controllers/notificationController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { authorizeRoleGroup } = require('../middleware/rbacMiddleware');
const allStaff = authorizeRoleGroup('ALL_STAFF');

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
    allStaff,
    notificationController.getMyNotifications
);

router.get(
    '/unread-count',
    protect,
    allStaff,
    notificationController.getUnreadCount
);

router.patch(
    '/read-all',
    protect,
    allStaff,
    notificationController.markAllAsRead
);

router.patch(
    '/:notificationId/read',
    protect,
    allStaff,
    notificationController.markAsRead
);

router.patch(
    '/:notificationId/unread',
    protect,
    allStaff,
    notificationController.markAsUnread
);

router.patch(
    '/:notificationId/archive',
    protect,
    allStaff,
    notificationController.archiveNotification
);

router.patch(
    '/:notificationId/restore',
    protect,
    allStaff,
    notificationController.restoreNotification
);

router.post(
    '/announcement',
    protect,
    allStaff,
    authorizeRoles('admin'),
    notificationController.createAnnouncementNotifications
);

module.exports = router;