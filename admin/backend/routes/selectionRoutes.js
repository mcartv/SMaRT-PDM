const express = require('express');
const selectionController = require('../controllers/selectionController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const router = express.Router();

const selectionPreviewCache = cacheJsonResponse({
    namespace: 'selection-preview',
    ttlMs: 3000,
});
const invalidateSelection = invalidateCacheOnSuccess([
    'selection-preview',
    'applications',
    'program-openings',
]);

router.use(protect, authorizeRoles('admin'));
router.get('/openings/:openingId/preview', selectionPreviewCache, selectionController.getPreview);
router.post('/openings/:openingId/finalize', invalidateSelection, selectionController.finalize);
router.post('/openings/:openingId/promote-next', invalidateSelection, selectionController.promote);
router.patch('/applications/:applicationId/qualify', invalidateSelection, selectionController.markQualified);

module.exports = router;
