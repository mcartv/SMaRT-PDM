const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const studentController = require('../controllers/studentController');

const router = express.Router();

router.get('/me/status', protect, studentController.getMyStatus);

module.exports = router;