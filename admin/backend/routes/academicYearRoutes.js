const express = require('express');
const router = express.Router();

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const academicYearController = require('../controllers/academicYearController');

router.use(protect, authorizeRoles('admin'));
router.get('/', academicYearController.getAcademicYears);
router.post('/', academicYearController.createAcademicYear);
router.patch('/:id', academicYearController.updateAcademicYear);
router.patch('/:id/activate', academicYearController.activateAcademicYear);
router.patch('/:id/archive', academicYearController.archiveAcademicYear);
router.patch('/:id/restore', academicYearController.restoreAcademicYear);

module.exports = router;
