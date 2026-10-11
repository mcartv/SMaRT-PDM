// SMaRT-PDM: Return of Obligations — ro Setting Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
// SMARTPDM_PHASE4_4_RO_RBAC_V1
const roSettingController = require('../controllers/roSettingController');

const router = express.Router();

const adminOnly = [protect, authorizeRoles('admin')];

router.get('/', adminOnly, requirePermission('ro.view'), roSettingController.getSettings);
router.get('/active', adminOnly, requirePermission('ro.view'), roSettingController.getActiveSetting);

// Manual apply active setting to existing pending RO records.
// This must be before /:settingId.
router.patch(
    '/active/apply-to-pending',
    adminOnly,
    requirePermission('ro.settings_manage'), roSettingController.applyActiveSettingToPending
);

// RO departments — MUST be before /:settingId
router.get('/departments', adminOnly, requirePermission('ro.view'), roSettingController.getDepartments);
router.post('/departments', adminOnly, requirePermission('ro.settings_manage'), roSettingController.createDepartment);

router.patch(
    '/departments/:departmentId',
    adminOnly,
    requirePermission('ro.settings_manage'), roSettingController.updateDepartment
);

router.patch(
    '/departments/:departmentId/toggle',
    adminOnly,
    requirePermission('ro.settings_manage'), roSettingController.toggleDepartment
);

router.put(
    '/departments/:departmentId/coordinator',
    adminOnly,
    requirePermission('ro.settings_manage'), roSettingController.setDepartmentCoordinator
);

router.post('/', adminOnly, requirePermission('ro.settings_manage'), roSettingController.createSetting);
router.patch('/:settingId', adminOnly, requirePermission('ro.settings_manage'), roSettingController.updateSetting);
router.patch('/:settingId/activate', adminOnly, requirePermission('ro.settings_manage'), roSettingController.activateSetting);

module.exports = router;
