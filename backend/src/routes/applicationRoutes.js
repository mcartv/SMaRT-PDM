const express = require('express');
const multer = require('multer');

const { protect } = require('../middleware/authMiddleware');
const applicationController = require('../controllers/applicationController');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
});

router.get('/me/form-data', protect, applicationController.getMyFormData);
router.post('/me/form-data', protect, applicationController.saveMyFormData);
router.put('/me/form-data', protect, applicationController.saveMyFormData);
router.get('/me/documents', protect, applicationController.getMyDocuments);
router.post('/me/submit', protect, applicationController.submitMyApplicationForm);
router.post(
    '/me/documents/:documentId/upload',
    protect,
    upload.single('document'),
    applicationController.uploadMyDocument
);

module.exports = router;