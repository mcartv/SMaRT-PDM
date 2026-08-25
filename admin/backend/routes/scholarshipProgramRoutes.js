const express = require('express');
const router = express.Router();

const {
    getScholarshipPrograms,
    createScholarshipProgram,
    updateScholarshipProgram,
} = require('../controllers/scholarshipProgramController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];

// IMPORTANT: path must match frontend EXACTLY
router.get('/', ...adminOnly, getScholarshipPrograms);
router.post('/', ...adminOnly, createScholarshipProgram);
router.patch('/:id', ...adminOnly, updateScholarshipProgram);

module.exports = router;