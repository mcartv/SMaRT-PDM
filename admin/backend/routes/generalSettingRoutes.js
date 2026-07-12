const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const generalSettingController = require('../controllers/generalSettingController');

const router = express.Router();

router.get('/public', generalSettingController.getPublicGeneralSettings);
router.get('/', protect, generalSettingController.getGeneralSettings);
router.patch('/', protect, generalSettingController.updateGeneralSettings);

module.exports = router;
