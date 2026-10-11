// SMaRT-PDM: Return of Obligations — benefactor Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const multer = require('multer');
const router = express.Router();

const {
    getBenefactors,
    getPublicBenefactors,
    createBenefactor,
    createBenefactorWithProgram,
    updateBenefactor,
    uploadBenefactorBranding,
    removeBenefactorBranding,
} = require('../controllers/benefactorController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
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


const benefactorCache = cacheJsonResponse({
    namespace: 'benefactors',
    ttlMs: 120000,
});
const publicBenefactorCache = cacheJsonResponse({
    namespace: 'benefactors',
    ttlMs: 120000,
    scope: 'public',
});
const invalidateBenefactors = invalidateCacheOnSuccess([
    'benefactors',
    'scholarship-programs',
    'program-openings',
]);

router.get('/public', publicBenefactorCache, getPublicBenefactors);
router.get('/', ...adminOnly, requirePermission('programs.view'), benefactorCache, getBenefactors);
router.post('/with-program', ...adminOnly, requirePermission('programs.manage'), invalidateBenefactors, createBenefactorWithProgram);
router.post('/', ...adminOnly, requirePermission('programs.manage'), invalidateBenefactors, createBenefactor);
router.post('/:id/branding/:slot', ...adminOnly, requirePermission('programs.manage'), brandingUpload.single('file'), invalidateBenefactors, uploadBenefactorBranding);
router.delete('/:id/branding/:slot', ...adminOnly, requirePermission('programs.manage'), invalidateBenefactors, removeBenefactorBranding);
router.patch('/:id', ...adminOnly, requirePermission('programs.manage'), invalidateBenefactors, updateBenefactor);

module.exports = router;
