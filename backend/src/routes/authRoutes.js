const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/check-student-id', authController.checkStudentId);
router.post('/register', authController.register);
router.post('/verify-otp', authController.verifyOtp);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-reset-otp', authController.verifyResetOtp);
router.post('/reset-password', authController.resetPassword);

module.exports = router;