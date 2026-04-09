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
<<<<<<< HEAD
router.patch('/:id/assign-program', protect, applicationController.assignApplicationProgram);
=======

// Student/mobile uploads
>>>>>>> 32ae8418452c712013f3762e9f8f6c40fa9d0fb7
router.post(
    '/:id/documents/upload',
    protect,
    upload.single('file'),
    applicationController.uploadStudentDocument
);
<<<<<<< HEAD
=======

// Admin review / verification
>>>>>>> 32ae8418452c712013f3762e9f8f6c40fa9d0fb7
router.post('/:id/verify', protect, applicationController.saveApplicationVerification);
router.patch('/:id/mark-reviewed', protect, applicationController.markApplicationReviewed);

// Admin remarks / decision
router.patch('/:id/remarks', protect, applicationController.saveApplicationRemarks);
router.patch('/:id/approve', protect, applicationController.approveApplication);
router.patch('/:id/waitlist', protect, applicationController.moveApplicationToWaiting);

// Disqualify only for actual invalid cases
router.patch('/:id/disqualify', protect, applicationController.disqualifyApplication);

<<<<<<< HEAD
module.exports = router;
=======
// Optional compatibility route
router.post('/:id/disqualify', protect, applicationController.disqualifyApplication);

module.exports = router;
>>>>>>> 32ae8418452c712013f3762e9f8f6c40fa9d0fb7
