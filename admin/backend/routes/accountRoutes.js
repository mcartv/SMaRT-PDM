// SMaRT-PDM: Return of Obligations — account Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const router = express.Router();
const multer = require('multer');

const accountController = require('../controllers/accountController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
// SMARTPDM_PHASE3_RBAC_AUDIT_V1
const { authorizeRoleGroup, requirePermission } = require('../middleware/rbacMiddleware');
const {
    adminAccountMutationLimiter,
    passwordActionLimiter,
    profileEditLimiter,
    profilePhotoLimiter,
} = require('../middleware/accountRateLimiters');
const allStaff = authorizeRoleGroup('ALL_STAFF');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

router.get('/me', protect, allStaff, accountController.getCurrentStaffProfile);
router.patch('/me', protect, allStaff, profileEditLimiter, accountController.updateCurrentStaffProfile);
router.post('/me/password/verify', protect, allStaff, passwordActionLimiter, accountController.verifyCurrentStaffPassword);
router.patch('/me/password/verify', protect, allStaff, passwordActionLimiter, accountController.verifyCurrentStaffPassword);
router.patch('/me/password', protect, allStaff, passwordActionLimiter, accountController.changeCurrentStaffPassword);
router.patch(
    '/me/profile-photo',
    protect,
    allStaff,
    profilePhotoLimiter,
    upload.single('file'),
    accountController.uploadCurrentStaffProfilePhoto
);
router.delete('/me/profile-photo', protect, allStaff, profilePhotoLimiter, accountController.removeCurrentStaffProfilePhoto);

router.get('/staff', protect, authorizeRoles('admin'), requirePermission('accounts.view'), accountController.getStaffAccounts);
router.post('/staff', protect, authorizeRoles('admin'), requirePermission('accounts.create'), adminAccountMutationLimiter, accountController.createStaffAccount);
router.post('/admin', protect, authorizeRoles('admin'), requirePermission('accounts.create'), adminAccountMutationLimiter, accountController.createAdminAccount);
router.patch('/staff/:id', protect, authorizeRoles('admin'), requirePermission('accounts.update'), adminAccountMutationLimiter, accountController.updateStaffAccount);
router.patch('/staff/:id/archive', protect, authorizeRoles('admin'), requirePermission('accounts.archive'), adminAccountMutationLimiter, accountController.archiveStaffAccount);
router.patch('/staff/:id/restore', protect, authorizeRoles('admin'), requirePermission('accounts.archive'), adminAccountMutationLimiter, accountController.restoreStaffAccount); // SMARTPDM_PHASE4_1_RESTORE_PERMISSION_V2

module.exports = router;
