const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const announcementController = require('../controllers/announcementController');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const router = express.Router();

const announcementCache = cacheJsonResponse({
    namespace: 'mobile-announcements',
    ttlMs: 5000,
});
const invalidateAnnouncements = invalidateCacheOnSuccess([
    'mobile-announcements',
]);

router.get('/', protect, announcementCache, announcementController.getAnnouncements);
router.post('/:announcementId/view', protect, invalidateAnnouncements, announcementController.markAnnouncementViewed);

module.exports = router;
