const express = require('express');
const router = express.Router();

const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const adminOnly = [protect, authorizeRoles('admin')];
const academicYearController = require('../controllers/academicYearController');

router.get('/', ...adminOnly, academicYearController.getAcademicYears);
router.post('/', ...adminOnly, academicYearController.createAcademicYear);
router.patch('/:id', ...adminOnly, academicYearController.updateAcademicYear);
router.patch('/:id/activate', ...adminOnly, academicYearController.activateAcademicYear);
router.patch('/:id/archive', ...adminOnly, academicYearController.archiveAcademicYear);
router.patch('/:id/restore', ...adminOnly, academicYearController.restoreAcademicYear);

module.exports = router;