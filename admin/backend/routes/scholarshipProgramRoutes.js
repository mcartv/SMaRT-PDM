const express = require('express');
const router = express.Router();

const {
    getScholarshipPrograms,
    createScholarshipProgram,
    updateScholarshipProgram,
} = require('../controllers/scholarshipProgramController');

const { protect } = require('../middleware/authMiddleware');

// IMPORTANT: path must match frontend EXACTLY
router.get('/', protect, getScholarshipPrograms);
router.post('/', protect, createScholarshipProgram);
router.patch('/:id', protect, updateScholarshipProgram);

module.exports = router;