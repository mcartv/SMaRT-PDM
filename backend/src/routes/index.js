const express = require('express');
const authRoutes = require('./authRoutes');
const courseRoutes = require('./courseRoutes');
const supportRoutes = require('./supportRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/', courseRoutes);
router.use('/', supportRoutes);

module.exports = router;