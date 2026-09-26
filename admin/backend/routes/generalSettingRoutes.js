const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];
const generalSettingController = require('../controllers/generalSettingController');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const router = express.Router();

const publicGeneralCache = cacheJsonResponse({
    namespace: 'general-settings',
    ttlMs: 60000,
    scope: 'public',
});
const adminGeneralCache = cacheJsonResponse({
    namespace: 'general-settings',
    ttlMs: 60000,
});
const invalidateGeneralSettings = invalidateCacheOnSuccess([
    'general-settings',
]);

router.get('/public', publicGeneralCache, generalSettingController.getPublicGeneralSettings);
router.get('/', ...adminOnly, adminGeneralCache, generalSettingController.getGeneralSettings);
router.patch('/', ...adminOnly, invalidateGeneralSettings, generalSettingController.updateGeneralSettings);

module.exports = router;
