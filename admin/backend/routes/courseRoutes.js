// SMaRT-PDM: Return of Obligations — course Routes (admin backend route); maps API endpoints to middleware and controllers.
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
const { requirePermission } = require('../middleware/rbacMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const courseCache = cacheJsonResponse({
    namespace: 'courses',
    ttlMs: 120000,
});
const invalidateCourses = invalidateCacheOnSuccess(['courses']);

router.get('/', protect, authorizeRoles('admin'), requirePermission('courses.view'), courseCache, getCourses);
router.post('/', protect, authorizeRoles('admin'), requirePermission('courses.manage'), invalidateCourses, createCourse);
router.patch('/:id', protect, authorizeRoles('admin'), requirePermission('courses.manage'), invalidateCourses, updateCourse);
router.patch('/:id/archive', protect, authorizeRoles('admin'), requirePermission('courses.manage'), invalidateCourses, archiveCourse);
router.patch('/:id/restore', protect, authorizeRoles('admin'), requirePermission('courses.manage'), invalidateCourses, restoreCourse);

// Safe delete: this archives instead of hard-deleting.
router.delete('/:id', protect, authorizeRoles('admin'), requirePermission('courses.manage'), invalidateCourses, archiveCourse);

module.exports = router;
