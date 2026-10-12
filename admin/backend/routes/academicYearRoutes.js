// SMaRT-PDM: Return of Obligations — academic Year Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const router = express.Router();

const {
    protect,
    authorizeRoles,
} = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
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
    ...adminOnly, requirePermission('settings.view'),
    academicCache,
    academicYearController.getAcademicPeriods
);

router.get(
    '/current-window',
    ...adminOnly, requirePermission('settings.view'),
    academicCache,
    academicYearController.getCurrentAcademicYearWindow
);

router.patch(
    '/periods/:periodId/activate',
    ...adminOnly, requirePermission('settings.manage'),
    invalidateAcademic,
    academicYearController.activateAcademicPeriod
);

router.post(
    '/periods/:periodId/reset-test',
    ...adminOnly, requirePermission('settings.manage'),
    invalidateAcademic,
    academicYearController.resetAcademicPeriodForTesting
);

router.get(
    '/',
    ...adminOnly, requirePermission('settings.view'),
    academicCache,
    academicYearController.getAcademicYears
);

router.post(
    '/',
    ...adminOnly, requirePermission('settings.manage'),
    invalidateAcademic,
    academicYearController.createAcademicYear
);

router.patch(
    '/:id',
    ...adminOnly, requirePermission('settings.manage'),
    invalidateAcademic,
    academicYearController.updateAcademicYear
);

router.patch(
    '/:id/activate',
    ...adminOnly, requirePermission('settings.manage'),
    invalidateAcademic,
    academicYearController.activateAcademicYear
);

router.patch(
    '/:id/archive',
    ...adminOnly, requirePermission('settings.manage'),
    invalidateAcademic,
    academicYearController.archiveAcademicYear
);

router.patch(
    '/:id/restore',
    ...adminOnly, requirePermission('settings.manage'),
    invalidateAcademic,
    academicYearController.restoreAcademicYear
);

module.exports = router;
