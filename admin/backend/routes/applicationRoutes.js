const express = require('express');
const router = express.Router();
const multer = require('multer');

const applicationController = require('../controllers/applicationController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.use(protect, authorizeRoles('admin'));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

// =========================
// MAIN ROUTES
// =========================

router.get('/', applicationController.getApplications);
router.get('/:id', applicationController.getApplicationDetails);
router.get('/:id/documents', applicationController.getApplicationDocuments);

// =========================
// DOCUMENT ACTIONS
// =========================

router.post(
    '/:id/documents/upload',
    upload.single('file'),
    applicationController.uploadStudentDocument
);

// =========================
// IoT OCR ROUTES
// =========================

router.post(
    '/:id/documents/:documentKey/iot-ocr',
    applicationController.runApplicationDocumentIotOcr
);

router.get(
    '/:id/documents/:documentKey/ocr-snapshot',
    applicationController.getApplicationDocumentOcrSnapshot
);

router.post(
    '/:id/documents/:documentKey/ocr-snapshot',
    applicationController.saveApplicationDocumentOcrSnapshot
);

// =========================
// VERIFICATION
// =========================

router.post(
    '/:id/verify',
    applicationController.saveApplicationVerification
);

router.patch(
    '/:id/approve',
    applicationController.approveApplication
);

router.patch(
    '/:id/remarks',
    applicationController.saveApplicationRemarks
);

router.patch(
    '/:id/disqualify',
    applicationController.disqualifyApplication
);

module.exports = router;
