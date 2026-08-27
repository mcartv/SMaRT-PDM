const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoleGroup, authorizeOwnPortalTheme } = require('../middleware/rbacMiddleware');
const themeSettingController = require('../controllers/themeSettingController');

const router = express.Router();
const allStaff = authorizeRoleGroup('ALL_STAFF');

router.get('/public/:portalKey', themeSettingController.getPublicThemeSetting);
router.get('/current/:portalKey', protect, allStaff, authorizeOwnPortalTheme, themeSettingController.getCurrentThemeSetting);
router.get('/', protect, allStaff, themeSettingController.getThemeSettings);
router.patch('/:portalKey/force-dark', protect, allStaff, authorizeOwnPortalTheme, themeSettingController.updateForceDarkMode);
router.patch('/:portalKey', protect, allStaff, authorizeOwnPortalTheme, themeSettingController.updateThemeSetting);

module.exports = router;
