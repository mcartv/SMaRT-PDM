const express = require('express');
const router = express.Router();

const programOpeningController = require('../controllers/programOpeningController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
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
    ...adminOnly,
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
    ...adminOnly,
    openingCache,
    programOpeningController.getAllProgramOpenings
);

router.get(
    '/:openingId',
    ...adminOnly,
    openingCache,
    programOpeningController.getProgramOpeningById
);

router.get(
    '/:openingId/applications',
    ...adminOnly,
    openingCache,
    programOpeningController.getApplicationsByOpeningId
);

router.post(
    '/',
    ...adminOnly,
    invalidateOpenings,
    validateOpeningUniqueness,
    programOpeningController.createProgramOpening
);

router.patch(
    '/:openingId',
    ...adminOnly,
    invalidateOpenings,
    validateOpeningUniqueness,
    programOpeningController.updateProgramOpening
);

router.patch(
    '/:openingId/close',
    ...adminOnly,
    invalidateOpenings,
    programOpeningController.closeProgramOpening
);

module.exports = router;
