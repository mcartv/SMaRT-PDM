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
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const courseCache = cacheJsonResponse({
    namespace: 'courses',
    ttlMs: 120000,
});
const invalidateCourses = invalidateCacheOnSuccess(['courses']);

router.get('/', protect, authorizeRoles('admin'), courseCache, getCourses);
router.post('/', protect, authorizeRoles('admin'), invalidateCourses, createCourse);
router.patch('/:id', protect, authorizeRoles('admin'), invalidateCourses, updateCourse);
router.patch('/:id/archive', protect, authorizeRoles('admin'), invalidateCourses, archiveCourse);
router.patch('/:id/restore', protect, authorizeRoles('admin'), invalidateCourses, restoreCourse);

// Safe delete: this archives instead of hard-deleting.
router.delete('/:id', protect, authorizeRoles('admin'), invalidateCourses, archiveCourse);

module.exports = router;
