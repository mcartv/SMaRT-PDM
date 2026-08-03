const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const themeSettingController = require('../controllers/themeSettingController');

const router = express.Router();

router.get('/public/:portalKey', themeSettingController.getPublicThemeSetting);
router.get('/current/:portalKey', protect, themeSettingController.getCurrentThemeSetting);
router.get('/', protect, authorizeRoles('admin'), themeSettingController.getThemeSettings);
router.patch('/:portalKey', protect, authorizeRoles('admin'), themeSettingController.updateThemeSetting);

module.exports = router;
