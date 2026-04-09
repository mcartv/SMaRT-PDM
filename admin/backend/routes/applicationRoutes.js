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

router.get('/export/excel', protect, applicationController.exportApplicationsExcel);
router.get('/', protect, applicationController.getApplications);
router.get('/:id', protect, applicationController.getApplicationDetails);
router.get('/:id/documents', protect, applicationController.getApplicationDocuments);

// Student/mobile uploads here
router.post(
    '/:id/documents/upload',
    protect,
    upload.single('file'),
    applicationController.uploadStudentDocument
);

// Admin review/verification here
router.post('/:id/verify', protect, applicationController.saveApplicationVerification);
router.patch('/:id/mark-reviewed', protect, applicationController.markApplicationReviewed);
router.patch('/:id/disqualify', protect, applicationController.disqualifyApplication);

module.exports = router;