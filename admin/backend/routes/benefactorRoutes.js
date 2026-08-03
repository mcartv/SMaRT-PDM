const express = require('express');
const router = express.Router();

const {
    getBenefactors,
    getPublicBenefactors,
    createBenefactor,
    updateBenefactor,
} = require('../controllers/benefactorController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/public', getPublicBenefactors);
router.get('/', protect, authorizeRoles('admin'), getBenefactors);
router.post('/', protect, authorizeRoles('admin'), createBenefactor);
router.patch('/:id', protect, authorizeRoles('admin'), updateBenefactor);

module.exports = router;
