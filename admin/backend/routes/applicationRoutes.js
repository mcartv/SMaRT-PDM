const express = require('express');
const router = express.Router();
const multer = require('multer');

const applicationController = require('../controllers/applicationController');
const { protect } = require('../middleware/authMiddleware');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

// =========================
// MAIN ROUTES
// =========================

router.get('/', protect, applicationController.getApplications);
router.get('/:id', protect, applicationController.getApplicationDetails);
router.get('/:id/documents', protect, applicationController.getApplicationDocuments);

// =========================
// DOCUMENT ACTIONS
// =========================

router.post(
    '/:id/documents/upload',
    protect,
    upload.single('file'),
    applicationController.uploadStudentDocument
);

// =========================
// IoT OCR ROUTES (FINAL)
// =========================

router.post(
    '/:id/documents/:documentKey/iot-ocr',
    protect,
    applicationController.runApplicationDocumentIotOcr
);

router.post(
    '/:id/documents/:documentKey/ocr-snapshot',
    protect,
    applicationController.saveApplicationDocumentOcrSnapshot
);

// =========================
// VERIFICATION
// =========================

router.post(
    '/:id/verify',
    protect,
    applicationController.saveApplicationVerification
);

module.exports = router;