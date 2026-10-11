// SMaRT-PDM: Renewal — renewal Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const router = express.Router();

const renewalController = require('../controllers/renewalController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
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

router.get('/', adminOnly, requirePermission('applications.view'), renewalCache, renewalController.getRenewals);
router.get('/:id', adminOnly, requirePermission('applications.view'), renewalCache, renewalController.getRenewalDetails);
router.post('/:id/review', adminOnly, requirePermission('applications.review'), invalidateRenewals, renewalController.saveRenewalReview);

module.exports = router;
