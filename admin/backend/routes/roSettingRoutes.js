const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const roSettingController = require('../controllers/roSettingController');

const router = express.Router();

router.get('/', protect, roSettingController.getSettings);
router.get('/active', protect, roSettingController.getActiveSetting);

// Manual apply active setting to existing pending RO records.
// This must be before /:settingId.
router.patch('/active/apply-to-pending', protect, roSettingController.applyActiveSettingToPending);

// RO departments — MUST be before /:settingId
router.get('/departments', protect, roSettingController.getDepartments);
router.post('/departments', protect, roSettingController.createDepartment);
router.patch(
    '/departments/:departmentId',
    protect,
    roSettingController.updateDepartment
);
router.patch(
    '/departments/:departmentId/toggle',
    protect,
    roSettingController.toggleDepartment
);

router.post('/', protect, roSettingController.createSetting);
router.patch('/:settingId', protect, roSettingController.updateSetting);
router.patch('/:settingId/activate', protect, roSettingController.activateSetting);

module.exports = router;