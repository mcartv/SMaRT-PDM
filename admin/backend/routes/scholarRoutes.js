const express = require('express');
const router = express.Router();

const scholarController = require('../controllers/scholarController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/sdo/stats', protect, authorizeRoles('sdo'), scholarController.getSdoStats);
router.get('/stats', protect, scholarController.getStats);
router.get('/', protect, scholarController.getAllScholars);

// student-based scholar record routes
router.get('/:id', protect, scholarController.getScholarById);
router.patch('/:id/sdo-status', protect, authorizeRoles('sdo'), scholarController.updateSdoStatus);

// renewal routes
router.get('/:id/renewal-documents', protect, scholarController.getScholarRenewalDocuments);
router.patch(
    '/:id/renewal-documents/:renewalDocumentId/verify',
    protect,
    scholarController.verifyScholarRenewalDocument
);
router.patch('/:id/renewal-review', protect, scholarController.saveScholarRenewalReview);

module.exports = router;