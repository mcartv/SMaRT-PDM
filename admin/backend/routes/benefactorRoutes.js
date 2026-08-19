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
const adminOnly = [protect, authorizeRoles('admin')];

router.get('/public', getPublicBenefactors);
router.get('/', ...adminOnly, getBenefactors);
router.post('/with-program', ...adminOnly, createBenefactorWithProgram);
router.post('/', ...adminOnly, createBenefactor);
router.patch('/:id', ...adminOnly, updateBenefactor);

module.exports = router;
