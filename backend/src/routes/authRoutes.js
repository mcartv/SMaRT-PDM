const express = require('express');
const multer = require('multer');

const { protect } = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');
const profileController = require('../controllers/profileController');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
});

router.post('/check-student-id', authController.checkStudentId);
router.post('/register', authController.register);
router.post('/verify-otp', authController.verifyOtp);
router.post('/login', authController.login);
router.post(
    '/upload-avatar',
    protect,
    upload.single('image'),
    profileController.uploadAvatar
);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOtp);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
