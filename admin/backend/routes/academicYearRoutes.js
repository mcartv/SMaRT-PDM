const express = require('express');
const router = express.Router();

const {
    protect,
    authorizeRoles,
} = require('../middleware/authMiddleware');
const academicYearController = require('../controllers/academicYearController');

const adminOnly = [
    protect,
    authorizeRoles('admin'),
];

router.get(
    '/periods',
    ...adminOnly,
    academicYearController.getAcademicPeriods
);

router.patch(
    '/periods/:periodId/activate',
    ...adminOnly,
    academicYearController.activateAcademicPeriod
);

router.post(
    '/periods/:periodId/reset-test',
    ...adminOnly,
    academicYearController.resetAcademicPeriodForTesting
);

router.get(
    '/',
    ...adminOnly,
    academicYearController.getAcademicYears
);

router.post(
    '/',
    ...adminOnly,
    academicYearController.createAcademicYear
);

router.patch(
    '/:id',
    ...adminOnly,
    academicYearController.updateAcademicYear
);

router.patch(
    '/:id/activate',
    ...adminOnly,
    academicYearController.activateAcademicYear
);

router.patch(
    '/:id/archive',
    ...adminOnly,
    academicYearController.archiveAcademicYear
);

router.patch(
    '/:id/restore',
    ...adminOnly,
    academicYearController.restoreAcademicYear
);

module.exports = router;
