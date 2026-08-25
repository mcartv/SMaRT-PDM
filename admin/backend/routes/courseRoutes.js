const express = require('express');
const router = express.Router();

const {
    getCourses,
    createCourse,
    updateCourse,
    archiveCourse,
    restoreCourse,
} = require('../controllers/courseController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', protect, authorizeRoles('admin'), getCourses);
router.post('/', protect, authorizeRoles('admin'), createCourse);
router.patch('/:id', protect, authorizeRoles('admin'), updateCourse);
router.patch('/:id/archive', protect, authorizeRoles('admin'), archiveCourse);
router.patch('/:id/restore', protect, authorizeRoles('admin'), restoreCourse);

// Safe delete: this archives instead of hard-deleting.
router.delete('/:id', protect, authorizeRoles('admin'), archiveCourse);

module.exports = router;
