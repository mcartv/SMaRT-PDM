const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

router.get('/me', protect, notificationController.getMyNotifications);
router.patch('/:notificationId/read', protect, notificationController.markAsRead);
router.patch('/me/read-all', protect, notificationController.markAllAsRead);

module.exports = router;