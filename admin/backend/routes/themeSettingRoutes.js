const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const themeSettingController = require('../controllers/themeSettingController');

const router = express.Router();

router.get('/public/:portalKey', themeSettingController.getPublicThemeSetting);
router.get('/', protect, themeSettingController.getThemeSettings);
router.patch('/:portalKey', protect, themeSettingController.updateThemeSetting);

module.exports = router;
