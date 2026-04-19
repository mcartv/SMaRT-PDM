const express = require('express');
const router = express.Router();

const announcementController = require('../controllers/announcementController');
const { protect } = require('../middleware/authMiddleware');

console.log('protect:', typeof protect);
console.log('getAnnouncements:', typeof announcementController.getAnnouncements);
console.log('getArchivedAnnouncements:', typeof announcementController.getArchivedAnnouncements);

router.get('/', protect, announcementController.getAnnouncements);
router.get('/archived', protect, announcementController.getArchivedAnnouncements);

router.post('/', protect, announcementController.createAnnouncement);

router.patch('/:id', protect, announcementController.updateAnnouncement);
router.patch('/:id/publish', protect, announcementController.publishAnnouncement);
router.patch('/:id/archive', protect, announcementController.archiveAnnouncement);
router.patch('/:id/restore', protect, announcementController.restoreAnnouncement);

module.exports = router;