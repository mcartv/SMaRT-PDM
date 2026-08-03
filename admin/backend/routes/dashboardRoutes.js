const express = require('express');
const router = express.Router();

const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.get(
    '/',
    protect,
    dashboardController.getAdminDashboard
);

module.exports = router;