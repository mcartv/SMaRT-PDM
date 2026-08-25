const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const roSettingController = require('../controllers/roSettingController');

const router = express.Router();

const adminOnly = [protect, authorizeRoles('admin')];

router.get('/', adminOnly, roSettingController.getSettings);
router.get('/active', adminOnly, roSettingController.getActiveSetting);

// Manual apply active setting to existing pending RO records.
// This must be before /:settingId.
router.patch(
    '/active/apply-to-pending',
    adminOnly,
    roSettingController.applyActiveSettingToPending
);

// RO departments — MUST be before /:settingId
router.get('/departments', adminOnly, roSettingController.getDepartments);
router.post('/departments', adminOnly, roSettingController.createDepartment);

router.patch(
    '/departments/:departmentId',
    adminOnly,
    roSettingController.updateDepartment
);

router.patch(
    '/departments/:departmentId/toggle',
    adminOnly,
    roSettingController.toggleDepartment
);

router.post('/', adminOnly, roSettingController.createSetting);
router.patch('/:settingId', adminOnly, roSettingController.updateSetting);
router.patch('/:settingId/activate', adminOnly, roSettingController.activateSetting);

module.exports = router;