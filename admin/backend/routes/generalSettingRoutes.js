// SMaRT-PDM: Return of Obligations — general Setting Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
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

const logo = require('../services/portalLogoService');
const logoUpload = require('multer')({storage:require('multer').memoryStorage(),limits:{fileSize:3*1024*1024}});
router.get('/logo', logo.handler(() => 'public', 'read'));
router.patch('/logo', ...adminOnly, requirePermission('settings.manage'), logoUpload.single('file'), logo.handler(() => 'public', 'upload'));
router.delete('/logo', ...adminOnly, requirePermission('settings.manage'), logo.handler(() => 'public', 'reset'));
router.get('/public', publicGeneralCache, generalSettingController.getPublicGeneralSettings);
router.get('/', ...adminOnly, requirePermission('settings.view'), adminGeneralCache, generalSettingController.getGeneralSettings);
router.patch('/', ...adminOnly, requirePermission('settings.manage'), invalidateGeneralSettings, generalSettingController.updateGeneralSettings);

module.exports = router;
