const express = require('express');
const router = express.Router();

const {
    getCourses,
    createCourse,
    updateCourse,
    archiveCourse,
    restoreCourse,
} = require('../controllers/courseController');

const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getCourses);
router.post('/', protect, createCourse);
router.patch('/:id', protect, updateCourse);
router.patch('/:id/archive', protect, archiveCourse);
router.patch('/:id/restore', protect, restoreCourse);

// Safe delete: this archives instead of hard-deleting.
router.delete('/:id', protect, archiveCourse);

module.exports = router;