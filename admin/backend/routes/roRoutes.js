const express = require('express');

const router = express.Router();

const roController = require('../controllers/roController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const adminOnly = [protect, authorizeRoles('admin')];

router.get('/summary', adminOnly, roController.getSummary);
router.get('/scholars', adminOnly, roController.getROScholars);

router.get(
    '/scholars/:studentId/history',
    adminOnly,
    roController.getScholarObligationHistory
);

router.get(
    '/scholar-requests',
    adminOnly,
    roController.getScholarRequests
);

router.patch(
    '/scholar-requests/:requestId',
    adminOnly,
    roController.updateScholarRequest
);

router.post(
    '/scholar-requests/:requestId/assign',
    adminOnly,
    roController.assignScholarsToRequest
);

router.post(
    '/scholars/batch-assign',
    adminOnly,
    roController.batchAssignScholarsRO
);

router.post(
    '/scholars/:studentId/assign',
    adminOnly,
    roController.assignScholarRO
);

router.patch(
    '/scholars/:studentId/clear',
    adminOnly,
    roController.clearScholarRO
);

router.patch(
    '/time-logs/:logId/validate',
    adminOnly,
    roController.validateTimeLog
);

router.patch(
    '/time-log-proofs/:proofId/review',
    adminOnly,
    roController.reviewTimeLogProof
);

module.exports = router;
