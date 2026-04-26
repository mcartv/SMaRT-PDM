const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const reportController = require('../controllers/reportController');

const router = express.Router();

router.get('/metadata', protect, reportController.getReportMetadata);
router.get('/export', protect, reportController.exportReport);

module.exports = router;