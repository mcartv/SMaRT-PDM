const express = require('express');

const ocrController = require('../controllers/ocrController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/jobs', protect, ocrController.createOcrJob);

module.exports = router;
