const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { authorizeRoleGroup } = require('../middleware/rbacMiddleware');
const reportController = require('../controllers/reportController');

const router = express.Router();
const reportStaff = [protect, authorizeRoleGroup('REPORT_STAFF')];

router.get('/metadata', ...reportStaff, reportController.getReportMetadata);
router.get('/preview', ...reportStaff, reportController.previewReport);
router.get('/export', ...reportStaff, reportController.exportReport);

module.exports = router;
