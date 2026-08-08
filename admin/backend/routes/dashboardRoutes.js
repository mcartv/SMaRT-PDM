const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];

router.get(
    '/',
    ...adminOnly,
    dashboardController.getAdminDashboard
);

module.exports = router;