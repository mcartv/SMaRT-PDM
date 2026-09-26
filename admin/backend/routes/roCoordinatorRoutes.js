const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoleGroup } = require('../middleware/rbacMiddleware');
const controller = require('../controllers/roCoordinatorController');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const router = express.Router();
const roCoordinatorCache = cacheJsonResponse({
    namespace: 'ro-coordinator',
    ttlMs: 3000,
});
const invalidateCoordinator = invalidateCacheOnSuccess([
    'ro-coordinator',
    'ro',
]);

// RO coordination is an additional assignment-based capability. PD, SDO, and Guidance
// staff keep their primary role and access these routes only with an active RO Area assignment.
router.use(protect, authorizeRoleGroup('RO_COORDINATOR_CAPABLE'));
router.get('/summary', roCoordinatorCache, controller.getSummary);
router.get('/requests', roCoordinatorCache, controller.getRequests);
router.get('/scholar-requests', roCoordinatorCache, controller.getScholarRequests);
router.post('/scholar-requests', invalidateCoordinator, controller.createScholarRequest);
router.patch('/scholar-requests/:requestId/cancel', invalidateCoordinator, controller.cancelScholarRequest);
router.patch('/requests/:placementId/decision', invalidateCoordinator, controller.decideRequest);
router.get('/attendance', roCoordinatorCache, controller.getAttendanceQueue);
router.patch('/attendance/:logId/decision', invalidateCoordinator, controller.validateAttendance);

module.exports = router;
