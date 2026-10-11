// SMaRT-PDM: Return of Obligations — audit Log Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');

const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');

router.get(
    '/recent-activity',
    protect,
    authorizeRoles('admin'), requirePermission('audit.view'),
    auditLogController.getMyRecentActivity
);

router.post(
    '/verify-password',
    protect,
    authorizeRoles('admin'), requirePermission('audit.view'),
    auditLogController.verifyAuditPassword
);

router.get(
    '/',
    protect,
    authorizeRoles('admin'), requirePermission('audit.view'),
    auditLogController.getAuditLogs
);

module.exports = router;
