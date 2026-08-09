const express = require('express');
const router = express.Router();
const multer = require('multer');

const applicationController = require('../controllers/applicationController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const adminOnly = [protect, authorizeRoles('admin')];
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/', ...adminOnly, applicationController.getApplications);
router.get('/iot-ocr/availability', ...adminOnly, applicationController.getIotOcrAvailability);
router.get('/:id', ...adminOnly, applicationController.getApplicationDetails);
router.get('/:id/documents', ...adminOnly, applicationController.getApplicationDocuments);
router.post('/:id/documents/upload', ...adminOnly, upload.single('file'), applicationController.uploadStudentDocument);
router.post('/:id/documents/:documentKey/iot-ocr', ...adminOnly, applicationController.runApplicationDocumentIotOcr);
router.get('/:id/documents/:documentKey/iot-ocr', ...adminOnly, applicationController.getApplicationDocumentIotOcr);
router.post('/:id/documents/:documentKey/iot-ocr/:requestId/confirm', ...adminOnly, applicationController.confirmApplicationDocumentIotOcr);
router.post('/:id/documents/:documentKey/iot-ocr/:requestId/retry', ...adminOnly, applicationController.retryApplicationDocumentIotOcr);
router.get('/:id/documents/:documentKey/ocr-snapshot', ...adminOnly, applicationController.getApplicationDocumentOcrSnapshot);
router.post('/:id/documents/:documentKey/ocr-snapshot', ...adminOnly, applicationController.saveApplicationDocumentOcrSnapshot);
router.post('/:id/verify', ...adminOnly, applicationController.saveApplicationVerification);
router.patch('/:id/approve', ...adminOnly, applicationController.approveApplication);
router.patch('/:id/remarks', ...adminOnly, applicationController.saveApplicationRemarks);
router.patch('/:id/disqualify', ...adminOnly, applicationController.disqualifyApplication);

module.exports = router;
