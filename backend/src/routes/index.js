const express = require('express');

const authRoutes = require('./authRoutes');
const courseRoutes = require('./courseRoutes');
const profileRoutes = require('./profileRoutes');
const applicationRoutes = require('./applicationRoutes');
const openingRoutes = require('./openingRoutes');
const adminApplicationRoutes = require('./adminApplicationRoutes');
const notificationRoutes = require('./notificationRoutes');
const announcementRoutes = require('./announcementRoutes');
const studentRoutes = require('./studentRoutes');
const payoutRoutes = require('./payoutRoutes');
const supportTicketRoutes = require('./supportTicketRoutes');
const roRoutes = require('./roRoutes');

const router = express.Router();



router.use('/api/auth', authRoutes);

router.use('/api/courses', courseRoutes);
router.use('/api/profile', profileRoutes);
router.use('/api/applications', applicationRoutes);
router.use('/api/openings', openingRoutes);
router.use('/api/admin/applications', adminApplicationRoutes);
router.use('/api/notifications', notificationRoutes);
router.use('/api/announcements', announcementRoutes);
router.use('/api/students', studentRoutes);
router.use('/api/payouts', payoutRoutes);
router.use('/api/support-tickets', supportTicketRoutes);
router.use('/api/ro', roRoutes);

router.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

module.exports = router;
