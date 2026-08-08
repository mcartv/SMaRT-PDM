const express = require('express');
const router = express.Router();

const scholarController = require('../controllers/scholarController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/sdo/stats', protect, authorizeRoles('sdo'), scholarController.getSdoStats);
router.get('/stats', protect, authorizeRoles('admin', 'sdo'), scholarController.getStats);
router.get('/', protect, authorizeRoles('admin', 'sdo'), scholarController.getAllScholars);
router.get('/:id', protect, authorizeRoles('admin', 'sdo'), scholarController.getScholarById);
router.patch('/:id/sdo-status', protect, authorizeRoles('sdo'), scholarController.updateSdoStatus);
router.patch('/:id/archive', protect, authorizeRoles('admin'), scholarController.archiveScholar);
router.get('/:id/renewal-documents', protect, authorizeRoles('admin'), scholarController.getScholarRenewalDocuments);
router.patch('/:id/renewal-documents/:renewalDocumentId/verify', protect, authorizeRoles('admin'), scholarController.verifyScholarRenewalDocument);
router.patch('/:id/renewal-review', protect, authorizeRoles('admin'), scholarController.saveScholarRenewalReview);

module.exports = router;
