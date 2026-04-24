const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const courseController = require('../controllers/courseController');

const router = express.Router();

router.get('/courses', protect, courseController.getCourses);

module.exports = router;