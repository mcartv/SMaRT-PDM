// SMaRT-PDM: Return of Obligations — announcement Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const router = express.Router();

const announcementController = require('../controllers/announcementController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];

const announcementCache = cacheJsonResponse({
    namespace: 'announcements',
    ttlMs: 15000,
});
const invalidateAnnouncements = invalidateCacheOnSuccess(['announcements']);

router.get(
    '/',
    ...adminOnly, requirePermission('announcements.view'),
    announcementCache,
    announcementController.getAnnouncements
);

router.get(
    '/archived',
    ...adminOnly, requirePermission('announcements.view'),
    announcementCache,
    announcementController.getArchivedAnnouncements
);

router.post(
    '/',
    ...adminOnly, requirePermission('announcements.manage'),
    invalidateAnnouncements,
    announcementController.createAnnouncement
);

router.patch(
    '/:id',
    ...adminOnly, requirePermission('announcements.manage'),
    invalidateAnnouncements,
    announcementController.updateAnnouncement
);

router.patch(
    '/:id/publish',
    ...adminOnly, requirePermission('announcements.manage'),
    invalidateAnnouncements,
    announcementController.publishAnnouncement
);

router.patch(
    '/:id/archive',
    ...adminOnly, requirePermission('announcements.manage'),
    invalidateAnnouncements,
    announcementController.archiveAnnouncement
);

router.patch(
    '/:id/restore',
    ...adminOnly, requirePermission('announcements.manage'),
    invalidateAnnouncements,
    announcementController.restoreAnnouncement
);

module.exports = router;
