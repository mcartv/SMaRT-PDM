const express = require('express');
const router = express.Router();

const scholarshipProgramController = require('../controllers/scholarshipProgramController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, scholarshipProgramController.getScholarshipPrograms);
router.post('/', protect, scholarshipProgramController.createScholarshipProgram);
router.patch('/:id', protect, scholarshipProgramController.updateScholarshipProgram);

module.exports = router;