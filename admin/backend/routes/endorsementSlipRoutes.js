const express = require('express');
const router = express.Router();

const endorsementSlipController = require('../controllers/endorsementSlipController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const {
    cacheJsonResponse,
    invalidateCacheOnSuccess,
} = require('../middleware/appCacheMiddleware');

const endorsementCache = cacheJsonResponse({
    namespace: 'endorsements',
    ttlMs: 3000,
});
const invalidateEndorsements = invalidateCacheOnSuccess([
    'endorsements',
    'applications',
    'program-openings',
]);

router.get('/', protect, authorizeRoles('admin', 'sdo', 'guidance', 'pd'), endorsementCache, endorsementSlipController.getAllSlips);
router.get('/pd', protect, authorizeRoles('pd'), endorsementCache, endorsementSlipController.getPdQueue);
router.get('/guidance', protect, authorizeRoles('guidance'), endorsementCache, endorsementSlipController.getGuidanceQueue);
router.get('/sdo', protect, authorizeRoles('sdo'), endorsementCache, endorsementSlipController.getSdoQueue);
router.get('/verify/:token', endorsementSlipController.verifySlip);
router.get('/:slipId/pdf', protect, authorizeRoles('admin', 'sdo', 'guidance', 'pd'), endorsementSlipController.downloadSlipPdf);
router.get('/:slipId', protect, authorizeRoles('admin', 'sdo', 'guidance', 'pd'), endorsementCache, endorsementSlipController.getSlipDetail);

// Separation of duties: OSFA/Admin can monitor the workflow but cannot sign for another office.
router.post('/:slipId/pd-action', protect, authorizeRoles('pd'), invalidateEndorsements, endorsementSlipController.postPdAction);
router.post('/:slipId/guidance-action', protect, authorizeRoles('guidance'), invalidateEndorsements, endorsementSlipController.postGuidanceAction);
router.post('/:slipId/sdo-action', protect, authorizeRoles('sdo'), invalidateEndorsements, endorsementSlipController.postSdoAction);

module.exports = router;
