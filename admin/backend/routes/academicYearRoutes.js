const express = require('express');
const router = express.Router();

const {
    protect,
    authorizeRoles,
} = require('../middleware/authMiddleware');
const academicYearController = require('../controllers/academicYearController');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const adminOnly = [
    protect,
    authorizeRoles('admin'),
];

const academicCache = cacheJsonResponse({
    namespace: 'academic-years',
    ttlMs: 120000,
});
const invalidateAcademic = invalidateCacheOnSuccess([
    'academic-years',
    'program-openings',
]);

router.get(
    '/periods',
    ...adminOnly,
    academicCache,
    academicYearController.getAcademicPeriods
);

router.get(
    '/current-window',
    ...adminOnly,
    academicCache,
    academicYearController.getCurrentAcademicYearWindow
);

router.patch(
    '/periods/:periodId/activate',
    ...adminOnly,
    invalidateAcademic,
    academicYearController.activateAcademicPeriod
);

router.post(
    '/periods/:periodId/reset-test',
    ...adminOnly,
    invalidateAcademic,
    academicYearController.resetAcademicPeriodForTesting
);

router.get(
    '/',
    ...adminOnly,
    academicCache,
    academicYearController.getAcademicYears
);

router.post(
    '/',
    ...adminOnly,
    invalidateAcademic,
    academicYearController.createAcademicYear
);

router.patch(
    '/:id',
    ...adminOnly,
    invalidateAcademic,
    academicYearController.updateAcademicYear
);

router.patch(
    '/:id/activate',
    ...adminOnly,
    invalidateAcademic,
    academicYearController.activateAcademicYear
);

router.patch(
    '/:id/archive',
    ...adminOnly,
    invalidateAcademic,
    academicYearController.archiveAcademicYear
);

router.patch(
    '/:id/restore',
    ...adminOnly,
    invalidateAcademic,
    academicYearController.restoreAcademicYear
);

module.exports = router;
