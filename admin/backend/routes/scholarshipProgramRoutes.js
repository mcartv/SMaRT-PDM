const express = require('express');
const router = express.Router();

const {
    getScholarshipPrograms,
    createScholarshipProgram,
    updateScholarshipProgram,
} = require('../controllers/scholarshipProgramController');

const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// IMPORTANT: path must match frontend EXACTLY
router.use(protect, authorizeRoles('admin'));
router.get('/', getScholarshipPrograms);
router.post('/', createScholarshipProgram);
router.patch('/:id', updateScholarshipProgram);

module.exports = router;
