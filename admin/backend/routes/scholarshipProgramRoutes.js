// SMaRT-PDM: Scholars — scholarship Program Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const multer = require('multer');
const router = express.Router();

const {
    getScholarshipPrograms,
    createScholarshipProgram,
    updateScholarshipProgram,
    uploadProgramBranding,
    removeProgramBranding,
} = require('../controllers/scholarshipProgramController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];
const brandingUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 3 * 1024 * 1024 },
    fileFilter: (req, file, callback) => {
        if (['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)) {
            return callback(null, true);
        }
        const error = new Error('Only PNG, JPG, and WEBP images are supported');
        error.statusCode = 400;
        return callback(error);
    },
});


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
router.post('/:id/branding/:slot', ...adminOnly, brandingUpload.single('file'), invalidatePrograms, uploadProgramBranding);
router.delete('/:id/branding/:slot', ...adminOnly, invalidatePrograms, removeProgramBranding);
router.patch('/:id', ...adminOnly, invalidatePrograms, updateScholarshipProgram);

module.exports = router;
