const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, announcementController.getAnnouncements);
router.post('/', protect, announcementController.createAnnouncement);
router.patch('/:id', protect, announcementController.updateAnnouncement);
router.patch('/:id/publish', protect, announcementController.publishAnnouncement);
router.patch('/:id/archive', protect, announcementController.archiveAnnouncement);

module.exports = router;