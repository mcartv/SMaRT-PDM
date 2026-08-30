const express = require('express');
const multer = require('multer');

const { protect } = require('../middleware/authMiddleware');
const authController = require('../controllers/authController');
const profileController = require('../controllers/profileController');
const accountRecoveryController = require('../controllers/accountRecoveryController');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1,
    },
});

function uploadAvatarImage(req, res, next) {
    upload.single('image')(req, res, (error) => {
        if (!error) {
            next();
            return;
        }

        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ error: 'Profile photo must be 5 MB or smaller.' });
            return;
        }

        if (error instanceof multer.MulterError) {
            res.status(400).json({ error: 'Unable to read the selected profile photo.' });
            return;
        }

        next(error);
    });
}

router.post('/check-student-id', authController.checkStudentId);
router.post('/register', authController.register);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/cancel-registration', authController.cancelRegistration);
router.post('/login', authController.login);
router.post(
    '/upload-avatar',
    protect,
    uploadAvatarImage,
    profileController.uploadAvatar
);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOtp);
router.post('/reset-password', authController.resetPassword);
router.post('/recovery/lookup', accountRecoveryController.lookup);
router.post('/recovery/start', accountRecoveryController.start);
router.post('/recovery/resend-code', accountRecoveryController.resendCode);
router.post('/recovery/verify-code', accountRecoveryController.verifyCode);
router.post('/recovery/reset-password', accountRecoveryController.resetPassword);
router.post('/request-email-change', protect, authController.requestEmailChange);
router.post('/verify-email-change', protect, authController.verifyEmailChange);

module.exports = router;
