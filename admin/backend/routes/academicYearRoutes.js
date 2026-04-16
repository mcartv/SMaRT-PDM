const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const academicYearController = require('../controllers/academicYearController');

router.get('/', protect, academicYearController.getAcademicYears);
router.post('/', protect, academicYearController.createAcademicYear);
router.patch('/:id', protect, academicYearController.updateAcademicYear);
router.patch('/:id/activate', protect, academicYearController.activateAcademicYear);

module.exports = router;