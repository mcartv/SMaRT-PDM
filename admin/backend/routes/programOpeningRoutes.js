const express = require('express');
const router = express.Router();

const programOpeningController = require('../controllers/programOpeningController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
    validateOpeningUniqueness,
} = require('../middleware/programOpeningUniquenessMiddleware');

const adminOnly = [protect, authorizeRoles('admin')];

router.get(
    '/admin/applications-summary',
    ...adminOnly,
    programOpeningController.getOpeningsApplicationSummary
);

router.get(
    '/mobile',
    programOpeningController.getMobileOpenings
);

router.get(
    '/',
    ...adminOnly,
    programOpeningController.getAllProgramOpenings
);

router.get(
    '/:openingId',
    ...adminOnly,
    programOpeningController.getProgramOpeningById
);

router.get(
    '/:openingId/applications',
    ...adminOnly,
    programOpeningController.getApplicationsByOpeningId
);

router.post(
    '/',
    ...adminOnly,
    validateOpeningUniqueness,
    programOpeningController.createProgramOpening
);

router.patch(
    '/:openingId',
    ...adminOnly,
    validateOpeningUniqueness,
    programOpeningController.updateProgramOpening
);

router.patch(
    '/:openingId/close',
    ...adminOnly,
    programOpeningController.closeProgramOpening
);

module.exports = router;
