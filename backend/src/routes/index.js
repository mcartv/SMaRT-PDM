const express = require('express');

const authRoutes = require('./authRoutes');
const courseRoutes = require('./courseRoutes');
const profileRoutes = require('./profileRoutes');
const applicationRoutes = require('./applicationRoutes');
const openingRoutes = require('./openingRoutes');
const adminApplicationRoutes = require('./adminApplicationRoutes');
const notificationRoutes = require('./notificationRoutes');
const studentRoutes = require('./studentRoutes');
const payoutRoutes = require('./payoutRoutes');
const supportTicketRoutes = require('./supportTicketRoutes');

const router = express.Router();

router.use('/api/auth', authRoutes);
router.use('/api/courses', courseRoutes);
router.use('/api/profile', profileRoutes);
router.use('/api/applications', applicationRoutes);
router.use('/api/openings', openingRoutes);
router.use('/api/admin/applications', adminApplicationRoutes);
router.use('/api/notifications', notificationRoutes);
router.use('/api/students', studentRoutes);
router.use('/api/payouts', payoutRoutes);
router.use('/api/support-tickets', supportTicketRoutes);

router.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'OK' });
});

module.exports = router;