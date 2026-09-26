const express = require('express');
const router = express.Router();

const payoutController = require('../controllers/payoutController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];

const payoutCache = cacheJsonResponse({
    namespace: 'payouts',
    ttlMs: 3000,
});
const invalidatePayouts = invalidateCacheOnSuccess([
    'payouts',
]);

router.get(
    '/',
    ...adminOnly,
    payoutCache,
    payoutController.getPayoutBatches
);

router.get(
    '/openings',
    ...adminOnly,
    payoutCache,
    payoutController.getPayoutOpenings
);

router.get(
    '/eligible-scholars',
    ...adminOnly,
    payoutCache,
    payoutController.getEligibleScholarsByOpening
);

router.post(
    '/',
    ...adminOnly,
    invalidatePayouts,
    payoutController.createPayoutBatch
);

router.patch(
    '/entries/:payoutEntryId/status',
    ...adminOnly,
    invalidatePayouts,
    payoutController.updateScholarStatus
);

router.patch(
    '/:payoutBatchId/archive',
    ...adminOnly,
    invalidatePayouts,
    payoutController.archivePayoutBatch
);

router.patch(
    '/:payoutBatchId/restore',
    ...adminOnly,
    invalidatePayouts,
    payoutController.restorePayoutBatch
);


router.get('/proofs', ...adminOnly, payoutCache, payoutController.getPayoutProofs);
router.patch('/proofs/:proofId/review', ...adminOnly, invalidatePayouts, payoutController.reviewPayoutProof);

module.exports = router;
