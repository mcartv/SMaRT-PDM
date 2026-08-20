const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const announcementController = require('../controllers/announcementController');

const router = express.Router();

router.get('/', protect, announcementController.getAnnouncements);
router.post('/:announcementId/view', protect, announcementController.markAnnouncementViewed);

module.exports = router;
