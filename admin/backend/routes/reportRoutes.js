// SMaRT-PDM: Return of Obligations — report Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoleGroup, requirePermission } = require('../middleware/rbacMiddleware');
const reportController = require('../controllers/reportController');

const router = express.Router();
const reportStaff = [protect, authorizeRoleGroup('REPORT_STAFF')];

router.get('/metadata', ...reportStaff, requirePermission('reports.view'), reportController.getReportMetadata);
router.get('/preview', ...reportStaff, requirePermission('reports.view'), reportController.previewReport);
router.get('/export', ...reportStaff, requirePermission('reports.generate'), reportController.exportReport);

module.exports = router;
