// SMaRT-PDM: Applications — application Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const router = express.Router();
const multer = require('multer');

const applicationController = require('../controllers/applicationController');
const applicationRegistryController = require('../controllers/applicationRegistryController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
const {
    notifySdoAfterSuccessfulVerification,
} = require('../middleware/endorsementNotificationMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const adminOnly = [protect, authorizeRoles('admin')];
const applicationsCache = cacheJsonResponse({
    namespace: 'applications',
    ttlMs: 3000,
});
const invalidateApplications = invalidateCacheOnSuccess([
    'applications',
    'program-openings',
]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

router.get('/', ...adminOnly, requirePermission('applications.view'), applicationsCache, applicationRegistryController.getApplications);
router.get('/iot-ocr/availability', ...adminOnly, requirePermission('documents.view'), applicationController.getIotOcrAvailability);
router.get('/iot-ocr/review-queue', ...adminOnly, requirePermission('documents.review'), applicationController.listIotOcrReviewQueue);
router.get('/:id', ...adminOnly, requirePermission('applications.view'), applicationController.getApplicationDetails);
router.get('/:id/documents', ...adminOnly, requirePermission('documents.view'), applicationController.getApplicationDocuments);
router.get('/:id/documents/:documentKey/view-url', ...adminOnly, requirePermission('documents.view'), applicationController.getApplicationDocumentViewUrl);
router.post('/:id/documents/upload', ...adminOnly, requirePermission('documents.review'), invalidateApplications, upload.single('file'), applicationController.uploadStudentDocument);
router.post('/:id/documents/:documentKey/iot-ocr', ...adminOnly, requirePermission('documents.review'), applicationController.runApplicationDocumentIotOcr);
router.get('/:id/documents/:documentKey/iot-ocr', ...adminOnly, requirePermission('documents.view'), applicationController.getApplicationDocumentIotOcr);
router.post('/:id/documents/:documentKey/iot-ocr/:requestId/confirm', ...adminOnly, requirePermission('documents.review'), invalidateApplications, applicationController.confirmApplicationDocumentIotOcr);
router.post('/:id/documents/:documentKey/iot-ocr/:requestId/retry', ...adminOnly, requirePermission('documents.review'), applicationController.retryApplicationDocumentIotOcr);
router.post('/:id/documents/:documentKey/iot-ocr/:requestId/cancel', ...adminOnly, requirePermission('documents.review'), applicationController.cancelApplicationDocumentIotOcr);
router.post('/:id/documents/:documentKey/iot-ocr/:requestId/reject', ...adminOnly, requirePermission('documents.review'), invalidateApplications, applicationController.rejectApplicationDocumentIotOcr);
router.post('/:id/documents/:documentKey/iot-ocr/:requestId/rescan', ...adminOnly, requirePermission('documents.review'), invalidateApplications, applicationController.rescanApplicationDocumentIotOcr);
router.get('/:id/documents/:documentKey/iot-ocr/:requestId/captured-image', ...adminOnly, requirePermission('documents.view'), applicationController.streamApplicationCapturedOcrImage);
router.get('/:id/documents/:documentKey/iot-ocr/:requestId/review-image', ...adminOnly, requirePermission('documents.view'), applicationController.streamApplicationBirthOcrImage);
router.get('/:id/documents/:documentKey/iot-ocr/:requestId/review-image-url', ...adminOnly, requirePermission('documents.view'), applicationController.getApplicationBirthOcrImageUrl);
router.get('/:id/documents/:documentKey/ocr-snapshot', ...adminOnly, requirePermission('documents.view'), applicationController.getApplicationDocumentOcrSnapshot);
router.post('/:id/documents/:documentKey/ocr-snapshot', ...adminOnly, requirePermission('documents.review'), invalidateApplications, applicationController.saveApplicationDocumentOcrSnapshot);
router.post(
    '/:id/application-form/request-reedit', ...adminOnly, requirePermission('applications.manage'),
    invalidateApplications,
    applicationController.requestApplicationFormReedit
);
router.patch(
    '/:id/documents/:documentKey/review', ...adminOnly, requirePermission('documents.review'),
    invalidateApplications,
    applicationController.saveApplicationDocumentReview
);
router.post(
    '/:id/verify', ...adminOnly, requirePermission('applications.review'),
    invalidateApplications,
    notifySdoAfterSuccessfulVerification,
    applicationController.saveApplicationVerification
);
router.patch('/:id/approve', ...adminOnly, requirePermission('applications.review'), invalidateApplications, applicationController.approveApplication);
router.patch('/:id/remarks', ...adminOnly, requirePermission('applications.manage'), invalidateApplications, applicationController.saveApplicationRemarks);
router.patch('/:id/disqualify', ...adminOnly, requirePermission('applications.review'), invalidateApplications, applicationController.disqualifyApplication);

module.exports = router;
