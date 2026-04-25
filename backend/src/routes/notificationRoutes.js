const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const notificationController = require('../controllers/notificationController');

const router = express.Router();

// Mobile existing call
router.get('/', protect, notificationController.getMyNotifications);

// New explicit call
router.get('/me', protect, notificationController.getMyNotifications);

router.patch('/me/read-all', protect, notificationController.markAllAsRead);
router.patch('/:notificationId/read', protect, notificationController.markAsRead);

module.exports = router;