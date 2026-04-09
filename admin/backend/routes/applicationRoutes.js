const express = require('express');
const router = express.Router();
const applicationController = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');

router.get('/export/excel', protect, applicationController.exportApplicationsExcel);
router.get('/', protect, applicationController.getApplications);
router.get('/:id', protect, applicationController.getApplicationDetails);
router.get('/:id/documents', protect, applicationController.getApplicationDocuments);
router.patch('/:id/assign-program', protect, applicationController.assignApplicationProgram);
router.post('/:id/verify', protect, applicationController.saveApplicationVerification);
router.patch('/:id/mark-reviewed', protect, applicationController.markApplicationReviewed);
router.patch('/:id/disqualify', protect, applicationController.disqualifyApplication);

module.exports = router;
