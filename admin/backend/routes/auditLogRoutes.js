const express = require('express');

const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.post(
    '/verify-password',
    protect,
    authorizeRoles('admin'),
    auditLogController.verifyAuditPassword
);

router.get(
    '/',
    protect,
    authorizeRoles('admin'),
    auditLogController.getAuditLogs
);

module.exports = router;