const express = require('express');
const router = express.Router();

const announcementController = require('../controllers/announcementController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];

router.get(
    '/',
    adminOnly,
    announcementController.getAnnouncements
);

router.get(
    '/archived',
    adminOnly,
    announcementController.getArchivedAnnouncements
);

router.post(
    '/',
    adminOnly,
    announcementController.createAnnouncement
);

router.patch(
    '/:id',
    adminOnly,
    announcementController.updateAnnouncement
);

router.patch(
    '/:id/publish',
    adminOnly,
    announcementController.publishAnnouncement
);

router.patch(
    '/:id/archive',
    adminOnly,
    announcementController.archiveAnnouncement
);

router.patch(
    '/:id/restore',
    adminOnly,
    announcementController.restoreAnnouncement
);

module.exports = router;
