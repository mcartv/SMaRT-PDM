const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware');
const academicYearController = require('../controllers/academicYearController');

router.get('/', protect, academicYearController.getAcademicYears);
router.post('/', protect, academicYearController.createAcademicYear);
router.patch('/:id', protect, academicYearController.updateAcademicYear);
router.patch('/:id/activate', protect, academicYearController.activateAcademicYear);
router.patch('/:id/archive', protect, academicYearController.archiveAcademicYear);
router.patch('/:id/restore', protect, academicYearController.restoreAcademicYear);

module.exports = router;