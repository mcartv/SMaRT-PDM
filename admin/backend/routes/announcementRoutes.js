const express = require('express');
const router = express.Router();

const announcementController = require('../controllers/announcementController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
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
    ...adminOnly,
    announcementCache,
    announcementController.getAnnouncements
);

router.get(
    '/archived',
    ...adminOnly,
    announcementCache,
    announcementController.getArchivedAnnouncements
);

router.post(
    '/',
    ...adminOnly,
    invalidateAnnouncements,
    announcementController.createAnnouncement
);

router.patch(
    '/:id',
    ...adminOnly,
    invalidateAnnouncements,
    announcementController.updateAnnouncement
);

router.patch(
    '/:id/publish',
    ...adminOnly,
    invalidateAnnouncements,
    announcementController.publishAnnouncement
);

router.patch(
    '/:id/archive',
    ...adminOnly,
    invalidateAnnouncements,
    announcementController.archiveAnnouncement
);

router.patch(
    '/:id/restore',
    ...adminOnly,
    invalidateAnnouncements,
    announcementController.restoreAnnouncement
);

module.exports = router;
