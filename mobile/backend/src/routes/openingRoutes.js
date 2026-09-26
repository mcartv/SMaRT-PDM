const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const openingController = require('../controllers/openingController');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const router = express.Router();

const openingCache = cacheJsonResponse({
    namespace: 'mobile-openings',
    ttlMs: 5000,
});
const invalidateOpenings = invalidateCacheOnSuccess([
    'mobile-openings',
]);

/*
  Specific route first.
*/
router.get('/latest', protect, openingCache, openingController.getLatestOpening);
router.get('/', protect, openingCache, openingController.getOpenings);

router.post('/:openingId/apply', protect, invalidateOpenings, openingController.applyToOpening);

module.exports = router;
