// SMaRT-PDM: Return of Obligations — program Opening Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const router = express.Router();

const programOpeningController = require('../controllers/programOpeningController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
const {
    validateOpeningUniqueness,
} = require('../middleware/programOpeningUniquenessMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const adminOnly = [protect, authorizeRoles('admin')];
const openingCache = cacheJsonResponse({
    namespace: 'program-openings',
    ttlMs: 5000,
});
const publicOpeningCache = cacheJsonResponse({
    namespace: 'program-openings',
    ttlMs: 5000,
    scope: 'public',
});
const invalidateOpenings = invalidateCacheOnSuccess([
    'program-openings',
    'applications',
]);

router.get(
    '/admin/applications-summary',
    ...adminOnly, requirePermission('programs.view'),
    openingCache,
    programOpeningController.getOpeningsApplicationSummary
);

router.get(
    '/mobile',
    publicOpeningCache,
    programOpeningController.getMobileOpenings
);

router.get(
    '/',
    ...adminOnly, requirePermission('programs.view'),
    openingCache,
    programOpeningController.getAllProgramOpenings
);

router.get(
    '/:openingId',
    ...adminOnly, requirePermission('programs.view'),
    openingCache,
    programOpeningController.getProgramOpeningById
);

router.get(
    '/:openingId/applications',
    ...adminOnly, requirePermission('applications.view'),
    openingCache,
    programOpeningController.getApplicationsByOpeningId
);

router.post(
    '/',
    ...adminOnly, requirePermission('programs.manage'),
    invalidateOpenings,
    validateOpeningUniqueness,
    programOpeningController.createProgramOpening
);

router.patch(
    '/:openingId',
    ...adminOnly, requirePermission('programs.manage'),
    invalidateOpenings,
    validateOpeningUniqueness,
    programOpeningController.updateProgramOpening
);

router.patch(
    '/:openingId/close',
    ...adminOnly, requirePermission('programs.manage'),
    invalidateOpenings,
    programOpeningController.closeProgramOpening
);

module.exports = router;
