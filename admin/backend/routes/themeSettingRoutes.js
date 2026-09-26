const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoleGroup, authorizeOwnPortalTheme } = require('../middleware/rbacMiddleware');
const themeSettingController = require('../controllers/themeSettingController');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const router = express.Router();
const allStaff = authorizeRoleGroup('ALL_STAFF');

const publicThemeCache = cacheJsonResponse({
    namespace: 'theme-settings',
    ttlMs: 60000,
    scope: 'public',
});
const staffThemeCache = cacheJsonResponse({
    namespace: 'theme-settings',
    ttlMs: 60000,
});
const invalidateThemes = invalidateCacheOnSuccess(['theme-settings']);

router.get('/public/:portalKey', publicThemeCache, themeSettingController.getPublicThemeSetting);
router.get('/current/:portalKey', protect, allStaff, authorizeOwnPortalTheme, staffThemeCache, themeSettingController.getCurrentThemeSetting);
router.get('/', protect, allStaff, staffThemeCache, themeSettingController.getThemeSettings);
router.patch('/:portalKey/force-dark', protect, allStaff, authorizeOwnPortalTheme, invalidateThemes, themeSettingController.updateForceDarkMode);
router.patch('/:portalKey', protect, allStaff, authorizeOwnPortalTheme, invalidateThemes, themeSettingController.updateThemeSetting);

module.exports = router;
