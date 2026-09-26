const express = require('express');
const router = express.Router();

const {
    getScholarshipPrograms,
    createScholarshipProgram,
    updateScholarshipProgram,
} = require('../controllers/scholarshipProgramController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];

const programCache = cacheJsonResponse({
    namespace: 'scholarship-programs',
    ttlMs: 120000,
});
const invalidatePrograms = invalidateCacheOnSuccess([
    'scholarship-programs',
    'program-openings',
]);

// IMPORTANT: path must match frontend EXACTLY
router.get('/', ...adminOnly, programCache, getScholarshipPrograms);
router.post('/', ...adminOnly, invalidatePrograms, createScholarshipProgram);
router.patch('/:id', ...adminOnly, invalidatePrograms, updateScholarshipProgram);

module.exports = router;
