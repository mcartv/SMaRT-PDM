const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/check-student-id', authController.checkStudentId);
router.post('/register', authController.register);
router.post('/verify-otp', authController.verifyOtp);
router.post('/login', authController.login);

module.exports = router;