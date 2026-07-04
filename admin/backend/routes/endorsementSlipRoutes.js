const express = require('express');
const router = express.Router();

const endorsementSlipController = require('../controllers/endorsementSlipController');
const { protect } = require('../middleware/authMiddleware');

router.get('/pd', protect, endorsementSlipController.getPdQueue);
router.get('/guidance', protect, endorsementSlipController.getGuidanceQueue);
router.get('/sdo', protect, endorsementSlipController.getSdoQueue);
router.get('/verify/:token', endorsementSlipController.verifySlip);
router.get('/:slipId', protect, endorsementSlipController.getSlipDetail);
router.post('/:slipId/pd-action', protect, endorsementSlipController.postPdAction);
router.post('/:slipId/guidance-action', protect, endorsementSlipController.postGuidanceAction);
router.post('/:slipId/sdo-action', protect, endorsementSlipController.postSdoAction);

module.exports = router;
