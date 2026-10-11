// SMaRT-PDM: Scholars — scholar Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const router = express.Router();

const scholarController = require('../controllers/scholarController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
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

router.get('/sdo/stats', protect, authorizeRoles('sdo'), requirePermission('students.view'), scholarCache, scholarController.getSdoStats);
router.get('/stats', protect, authorizeRoles('admin', 'sdo'), requirePermission('students.view'), scholarCache, scholarController.getStats);
router.get('/removed', protect, authorizeRoles('admin'), requirePermission('students.view'), scholarCache, scholarController.getRemovedScholars);
router.get('/', protect, authorizeRoles('admin', 'sdo'), requirePermission('students.view'), scholarCache, scholarController.getAllScholars);
router.get('/:id', protect, authorizeRoles('admin', 'sdo'), requirePermission('students.view'), scholarCache, scholarController.getScholarById);
router.patch('/:id/sdo-status', protect, authorizeRoles('sdo'), requirePermission('discipline.manage'), invalidateScholars, scholarController.updateSdoStatus);
router.patch('/:id/archive', protect, authorizeRoles('admin'), requirePermission('students.update'), invalidateScholars, scholarController.archiveScholar);

// Renewal document verification remains uncached because it is an active review surface.
router.get('/:id/renewal-documents', protect, authorizeRoles('admin'), requirePermission('documents.view'), scholarController.getScholarRenewalDocuments);
router.patch('/:id/renewal-documents/:renewalDocumentId/verify', protect, authorizeRoles('admin'), requirePermission('documents.review'), invalidateScholars, scholarController.verifyScholarRenewalDocument);
router.patch('/:id/renewal-review', protect, authorizeRoles('admin'), requirePermission('applications.review'), invalidateScholars, scholarController.saveScholarRenewalReview);

module.exports = router;
