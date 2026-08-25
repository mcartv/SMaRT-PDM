const express = require('express');

const ocrController = require('../controllers/ocrController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];

const router = express.Router();

router.post('/jobs', ...adminOnly, ocrController.createOcrJob);

module.exports = router;
