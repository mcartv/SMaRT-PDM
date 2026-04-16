const express = require('express');
const router = express.Router();
const multer = require('multer');

const applicationController = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
});

// Export / registry
router.get('/export/excel', protect, applicationController.exportApplicationsExcel);
router.get('/', protect, applicationController.getApplications);

// Applicant details / docs
router.get('/:id', protect, applicationController.getApplicationDetails);
router.get('/:id/documents', protect, applicationController.getApplicationDocuments);

// Student/mobile uploads
router.post(
    '/:id/documents/upload',
    protect,
    upload.single('file'),
    applicationController.uploadStudentDocument
);

// Admin review / verification
router.post('/:id/verify', protect, applicationController.saveApplicationVerification);
router.patch('/:id/mark-reviewed', protect, applicationController.markApplicationReviewed);

// Admin remarks / decision
router.patch('/:id/remarks', protect, applicationController.saveApplicationRemarks);
router.patch('/:id/approve', protect, applicationController.approveApplication);

// Disqualify only for actual invalid cases
router.patch('/:id/disqualify', protect, applicationController.disqualifyApplication);

// Optional compatibility route
router.post('/:id/disqualify', protect, applicationController.disqualifyApplication);

module.exports = router;