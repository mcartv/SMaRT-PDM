const express = require('express');
const router = express.Router();

const payoutController = require('../controllers/payoutController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.use(protect, authorizeRoles('admin'));

router.get(
    '/',
    payoutController.getPayoutBatches
);

router.get(
    '/openings',
    payoutController.getPayoutOpenings
);

router.get(
    '/eligible-scholars',
    payoutController.getEligibleScholarsByOpening
);

router.post(
    '/',
    payoutController.createPayoutBatch
);

router.patch(
    '/entries/:payoutEntryId/status',
    payoutController.updateScholarStatus
);

router.patch(
    '/:payoutBatchId/archive',
    payoutController.archivePayoutBatch
);

router.patch(
    '/:payoutBatchId/restore',
    payoutController.restorePayoutBatch
);


router.get('/proofs', payoutController.getPayoutProofs);
router.patch('/proofs/:proofId/review', payoutController.reviewPayoutProof);

module.exports = router;
