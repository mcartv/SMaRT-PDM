const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { protect } = require('../middleware/authMiddleware');

router.post('/announcements', protect, notificationController.createAnnouncementNotifications);

module.exports = router;