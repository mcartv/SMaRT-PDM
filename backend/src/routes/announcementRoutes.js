const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const announcementController = require('../controllers/announcementController');

const router = express.Router();

router.get('/', protect, announcementController.getAnnouncements);

module.exports = router;
