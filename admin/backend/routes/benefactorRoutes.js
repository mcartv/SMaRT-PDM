const express = require('express');
const router = express.Router();

const {
    getBenefactors,
    getPublicBenefactors,
    createBenefactor,
    createBenefactorWithProgram,
    updateBenefactor,
} = require('../controllers/benefactorController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];

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
router.get('/', ...adminOnly, benefactorCache, getBenefactors);
router.post('/with-program', ...adminOnly, invalidateBenefactors, createBenefactorWithProgram);
router.post('/', ...adminOnly, invalidateBenefactors, createBenefactor);
router.patch('/:id', ...adminOnly, invalidateBenefactors, updateBenefactor);

module.exports = router;
