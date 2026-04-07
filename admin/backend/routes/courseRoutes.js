const express = require('express');
const router = express.Router();

const {
    getCourses,
    createCourse,
    updateCourse,
} = require('../controllers/courseController');

const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getCourses);
router.post('/', protect, createCourse);
router.patch('/:id', protect, updateCourse);

module.exports = router;