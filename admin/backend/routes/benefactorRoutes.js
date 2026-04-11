const express = require('express');
const router = express.Router();

const {
    getBenefactors,
    createBenefactor,
    updateBenefactor,
} = require('../controllers/benefactorController');

const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getBenefactors);
router.post('/', protect, createBenefactor);
router.patch('/:id', protect, updateBenefactor);

module.exports = router;