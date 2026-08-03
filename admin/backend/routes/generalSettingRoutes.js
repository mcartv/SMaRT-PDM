const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const generalSettingController = require('../controllers/generalSettingController');

const router = express.Router();

router.get('/public', generalSettingController.getPublicGeneralSettings);
router.get('/', protect, authorizeRoles('admin'), generalSettingController.getGeneralSettings);
router.patch('/', protect, authorizeRoles('admin'), generalSettingController.updateGeneralSettings);

module.exports = router;
