const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many login attempts. Please try again later.',
    },
});

const recoveryLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many recovery attempts. Please try again later.',
    },
});

router.post('/login', loginLimiter, authController.adminLogin);
router.post('/pd/login', loginLimiter, authController.pdLogin);
router.post('/guidance/login', loginLimiter, authController.guidanceLogin);
router.post('/sdo/login', loginLimiter, authController.sdoLogin);

router.post('/session/resume', authController.resumeAdminSession);

router.get(
    '/session/recent',
    protect,
    authorizeRoles('admin'),
    authController.getRecentAdminSessions
);

router.post(
    '/session/heartbeat',
    protect,
    authorizeRoles('admin'),
    authController.heartbeatAdminSession
);

router.post(
    '/session/release',
    protect,
    authorizeRoles('admin'),
    authController.releaseAdminSessionPage
);

router.post(
    '/session/release-beacon',
    authController.releaseAdminSessionBeacon
);

router.post(
    '/session/logout',
    protect,
    authorizeRoles('admin'),
    authController.logoutAdminSession
);

router.post(
    '/admin/forgot-password/start',
    recoveryLimiter,
    authController.startAdminPasswordReset
);

router.post(
    '/admin/forgot-password/verify',
    recoveryLimiter,
    authController.verifyAdminPasswordResetOtp
);

router.post(
    '/admin/forgot-password/reset',
    recoveryLimiter,
    authController.resetAdminPassword
);

module.exports = router;
