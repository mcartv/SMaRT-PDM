const express = require('express');
const router = express.Router();

const payoutController = require('../controllers/payoutController');
const { protect } = require('../middleware/authMiddleware');

router.get(
    '/',
    protect,
    payoutController.getPayoutBatches
);

router.get(
    '/openings',
    protect,
    payoutController.getPayoutOpenings
);

router.get(
    '/eligible-scholars',
    protect,
    payoutController.getEligibleScholarsByOpening
);

router.post(
    '/',
    protect,
    payoutController.createPayoutBatch
);

router.patch(
    '/entries/:payoutEntryId/status',
    protect,
    payoutController.updateScholarStatus
);

router.patch(
    '/:payoutBatchId/archive',
    protect,
    payoutController.archivePayoutBatch
);

router.patch(
    '/:payoutBatchId/restore',
    protect,
    payoutController.restorePayoutBatch
);

module.exports = router;