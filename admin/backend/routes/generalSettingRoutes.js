const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];
const generalSettingController = require('../controllers/generalSettingController');

const router = express.Router();

router.get('/public', generalSettingController.getPublicGeneralSettings);
router.get('/', ...adminOnly, generalSettingController.getGeneralSettings);
router.patch('/', ...adminOnly, generalSettingController.updateGeneralSettings);

module.exports = router;
