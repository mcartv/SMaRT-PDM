const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get(
    '/',
    protect,
    authorizeRoles('admin'),
    dashboardController.getAdminDashboard
);

module.exports = router;
