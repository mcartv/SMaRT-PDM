const express = require('express');

const router = express.Router();

const roController = require('../controllers/roController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
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

router.get('/summary', adminOnly, roCache, roController.getSummary);
router.get('/scholars', adminOnly, roCache, roController.getROScholars);

router.get(
    '/scholars/:studentId/history',
    adminOnly,
    roCache,
    roController.getScholarObligationHistory
);

router.get(
    '/scholar-requests',
    adminOnly,
    roCache,
    roController.getScholarRequests
);

router.patch(
    '/scholar-requests/:requestId',
    adminOnly,
    invalidateRo,
    roController.updateScholarRequest
);

router.post(
    '/scholar-requests/:requestId/assign',
    adminOnly,
    invalidateRo,
    roController.assignScholarsToRequest
);

router.post(
    '/scholars/batch-assign',
    adminOnly,
    invalidateRo,
    roController.batchAssignScholarsRO
);

router.post(
    '/scholars/:studentId/assign',
    adminOnly,
    invalidateRo,
    roController.assignScholarRO
);

router.patch(
    '/scholars/:studentId/clear',
    adminOnly,
    invalidateRo,
    roController.clearScholarRO
);

router.patch(
    '/time-logs/:logId/validate',
    adminOnly,
    invalidateRo,
    roController.validateTimeLog
);

router.patch(
    '/time-log-proofs/:proofId/review',
    adminOnly,
    invalidateRo,
    roController.reviewTimeLogProof
);

module.exports = router;
