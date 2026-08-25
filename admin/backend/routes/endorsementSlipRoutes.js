const express = require('express');
const router = express.Router();

const endorsementSlipController = require('../controllers/endorsementSlipController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', protect, authorizeRoles('admin', 'sdo', 'guidance', 'pd'), endorsementSlipController.getAllSlips);
router.get('/pd', protect, authorizeRoles('pd'), endorsementSlipController.getPdQueue);
router.get('/guidance', protect, authorizeRoles('guidance'), endorsementSlipController.getGuidanceQueue);
router.get('/sdo', protect, authorizeRoles('sdo'), endorsementSlipController.getSdoQueue);
router.get('/verify/:token', endorsementSlipController.verifySlip);
router.get('/:slipId/pdf', protect, authorizeRoles('admin', 'sdo', 'guidance', 'pd'), endorsementSlipController.downloadSlipPdf);
router.get('/:slipId', protect, authorizeRoles('admin', 'sdo', 'guidance', 'pd'), endorsementSlipController.getSlipDetail);

// Separation of duties: OSFA/Admin can monitor the workflow but cannot sign for another office.
router.post('/:slipId/pd-action', protect, authorizeRoles('pd'), endorsementSlipController.postPdAction);
router.post('/:slipId/guidance-action', protect, authorizeRoles('guidance'), endorsementSlipController.postGuidanceAction);
router.post('/:slipId/sdo-action', protect, authorizeRoles('sdo'), endorsementSlipController.postSdoAction);

module.exports = router;
