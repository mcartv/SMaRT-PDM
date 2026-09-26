const express = require('express');
const router = express.Router();

const renewalController = require('../controllers/renewalController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const adminOnly = [
    protect,
    authorizeRoles('admin', 'Admin'),
];

const renewalCache = cacheJsonResponse({
    namespace: 'renewals',
    ttlMs: 3000,
});
const invalidateRenewals = invalidateCacheOnSuccess([
    'renewals',
    'scholars',
]);

router.get('/', adminOnly, renewalCache, renewalController.getRenewals);
router.get('/:id', adminOnly, renewalCache, renewalController.getRenewalDetails);
router.post('/:id/review', adminOnly, invalidateRenewals, renewalController.saveRenewalReview);

module.exports = router;
