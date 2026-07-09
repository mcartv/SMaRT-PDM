const express = require('express');
const router = express.Router();

const roController = require('../controllers/roController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const adminOnly = [protect, authorizeRoles('admin')];

router.get('/summary', adminOnly, roController.getSummary);
router.get('/scholars', adminOnly, roController.getROScholars);
router.patch('/scholars/:studentId/clear', adminOnly, roController.clearScholarRO);

module.exports = router;