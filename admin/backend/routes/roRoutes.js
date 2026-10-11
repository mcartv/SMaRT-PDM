// SMaRT-PDM: Return of Obligations — ro Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');

const router = express.Router();

const roController = require('../controllers/roController');
const roPaginationController = require('../controllers/roPaginationController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
// SMARTPDM_PHASE4_4_RO_RBAC_V1
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const adminOnly = [protect, authorizeRoles('admin')];
const roCache = cacheJsonResponse({
    namespace: 'ro',
    ttlMs: 3000,
});
const invalidateRo = invalidateCacheOnSuccess(['ro']);

router.get('/summary', adminOnly, requirePermission('ro.view'), roCache, roController.getSummary);
router.get('/scholars', adminOnly, requirePermission('ro.view'), roCache, roPaginationController.getROScholars);

router.get(
    '/scholars/:studentId/history',
    adminOnly,
    requirePermission('ro.view'), roCache,
    roController.getScholarObligationHistory
);

router.get(
    '/scholar-requests',
    adminOnly,
    requirePermission('ro.view'), roCache,
    roController.getScholarRequests
);

router.patch(
    '/scholar-requests/:requestId',
    adminOnly,
    requirePermission('ro.assign'), invalidateRo,
    roController.updateScholarRequest
);

router.post(
    '/scholar-requests/:requestId/assign',
    adminOnly,
    requirePermission('ro.assign'), invalidateRo,
    roController.assignScholarsToRequest
);

router.post(
    '/scholars/batch-assign',
    adminOnly,
    requirePermission('ro.assign'), invalidateRo,
    roController.batchAssignScholarsRO
);

router.post(
    '/scholars/:studentId/assign',
    adminOnly,
    requirePermission('ro.assign'), invalidateRo,
    roController.assignScholarRO
);

router.patch(
    '/scholars/:studentId/clear',
    adminOnly,
    requirePermission('ro.assign'), invalidateRo,
    roController.clearScholarRO
);

router.patch(
    '/time-logs/:logId/validate',
    adminOnly,
    requirePermission('ro.validate'), invalidateRo,
    roController.validateTimeLog
);

router.patch(
    '/time-log-proofs/:proofId/review',
    adminOnly,
    requirePermission('ro.validate'), invalidateRo,
    roController.reviewTimeLogProof
);

module.exports = router;
