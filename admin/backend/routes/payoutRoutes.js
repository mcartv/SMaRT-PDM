const express = require('express');
const router = express.Router();

const payoutController = require('../controllers/payoutController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];

router.get(
    '/',
    ...adminOnly,
    payoutController.getPayoutBatches
);

router.get(
    '/openings',
    ...adminOnly,
    payoutController.getPayoutOpenings
);

router.get(
    '/eligible-scholars',
    ...adminOnly,
    payoutController.getEligibleScholarsByOpening
);

router.post(
    '/',
    ...adminOnly,
    payoutController.createPayoutBatch
);

router.patch(
    '/entries/:payoutEntryId/status',
    ...adminOnly,
    payoutController.updateScholarStatus
);

router.patch(
    '/:payoutBatchId/archive',
    ...adminOnly,
    payoutController.archivePayoutBatch
);

router.patch(
    '/:payoutBatchId/restore',
    ...adminOnly,
    payoutController.restorePayoutBatch
);


router.get('/proofs', ...adminOnly, payoutController.getPayoutProofs);
router.patch('/proofs/:proofId/review', ...adminOnly, payoutController.reviewPayoutProof);

module.exports = router;