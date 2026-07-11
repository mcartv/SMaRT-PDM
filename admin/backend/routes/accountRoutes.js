const express = require('express');
const router = express.Router();
const multer = require('multer');

const accountController = require('../controllers/accountController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

router.get('/me', protect, accountController.getCurrentStaffProfile);
router.patch('/me', protect, accountController.updateCurrentStaffProfile);
router.patch(
    '/me/profile-photo',
    protect,
    upload.single('file'),
    accountController.uploadCurrentStaffProfilePhoto
);
router.delete('/me/profile-photo', protect, accountController.removeCurrentStaffProfilePhoto);

router.get('/staff', protect, authorizeRoles('admin'), accountController.getStaffAccounts);
router.post('/staff', protect, authorizeRoles('admin'), accountController.createStaffAccount);
router.patch('/staff/:id', protect, authorizeRoles('admin'), accountController.updateStaffAccount);
router.patch('/staff/:id/archive', protect, authorizeRoles('admin'), accountController.archiveStaffAccount);
router.patch('/staff/:id/restore', protect, authorizeRoles('admin'), accountController.restoreStaffAccount);

// Safe delete: archives the account instead of hard-deleting it.
router.delete('/staff/:id', protect, authorizeRoles('admin'), accountController.deleteStaffAccount);

module.exports = router;