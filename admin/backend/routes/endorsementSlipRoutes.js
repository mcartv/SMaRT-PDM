// SMaRT-PDM: Return of Obligations — endorsement Slip Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');
const router = express.Router();

const endorsementSlipController = require('../controllers/endorsementSlipController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const { requirePermission } = require('../middleware/rbacMiddleware');
// PHASE4_3_ENDORSEMENT_RBAC_V1
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

router.get('/', protect, authorizeRoles('admin', 'sdo', 'guidance', 'pd'), requirePermission('endorsements.view'), endorsementCache, endorsementSlipController.getAllSlips);
router.get('/pd', protect, authorizeRoles('pd'), requirePermission('endorsements.view'), endorsementCache, endorsementSlipController.getPdQueue);
router.get('/guidance', protect, authorizeRoles('guidance'), requirePermission('endorsements.view'), endorsementCache, endorsementSlipController.getGuidanceQueue);
router.get('/sdo', protect, authorizeRoles('sdo'), requirePermission('endorsements.view'), endorsementCache, endorsementSlipController.getSdoQueue);
router.get('/verify/:token', endorsementSlipController.verifySlip);
router.get('/:slipId/pdf', protect, authorizeRoles('admin'), requirePermission('endorsements.view'), endorsementSlipController.downloadSlipPdf);
router.get('/:slipId', protect, authorizeRoles('admin', 'sdo', 'guidance', 'pd'), requirePermission('endorsements.view'), endorsementCache, endorsementSlipController.getSlipDetail);

// Separation of duties: OSFA/Admin can monitor the workflow but cannot sign for another office.
router.post('/:slipId/pd-action', protect, authorizeRoles('pd'), requirePermission('endorsements.review_pd'), invalidateEndorsements, endorsementSlipController.postPdAction);
router.post('/:slipId/guidance-action', protect, authorizeRoles('guidance'), requirePermission('endorsements.review_gco'), invalidateEndorsements, endorsementSlipController.postGuidanceAction);
router.post('/:slipId/sdo-action', protect, authorizeRoles('sdo'), requirePermission('endorsements.review_sdo'), invalidateEndorsements, endorsementSlipController.postSdoAction);

module.exports = router;
