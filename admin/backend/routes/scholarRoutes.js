const express = require('express');
const router = express.Router();

const scholarController = require('../controllers/scholarController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const scholarCache = cacheJsonResponse({
    namespace: 'scholars',
    ttlMs: 3000,
});
const invalidateScholars = invalidateCacheOnSuccess([
    'scholars',
    'applications',
    'renewals',
    'payouts',
    'ro',
]);

router.get('/sdo/stats', protect, authorizeRoles('sdo'), scholarCache, scholarController.getSdoStats);
router.get('/stats', protect, authorizeRoles('admin', 'sdo'), scholarCache, scholarController.getStats);
router.get('/removed', protect, authorizeRoles('admin'), scholarCache, scholarController.getRemovedScholars);
router.get('/', protect, authorizeRoles('admin', 'sdo'), scholarCache, scholarController.getAllScholars);
router.get('/:id', protect, authorizeRoles('admin', 'sdo'), scholarCache, scholarController.getScholarById);
router.patch('/:id/sdo-status', protect, authorizeRoles('sdo'), invalidateScholars, scholarController.updateSdoStatus);
router.patch('/:id/archive', protect, authorizeRoles('admin'), invalidateScholars, scholarController.archiveScholar);

// Renewal document verification remains uncached because it is an active review surface.
router.get('/:id/renewal-documents', protect, authorizeRoles('admin'), scholarController.getScholarRenewalDocuments);
router.patch('/:id/renewal-documents/:renewalDocumentId/verify', protect, authorizeRoles('admin'), invalidateScholars, scholarController.verifyScholarRenewalDocument);
router.patch('/:id/renewal-review', protect, authorizeRoles('admin'), invalidateScholars, scholarController.saveScholarRenewalReview);

module.exports = router;
