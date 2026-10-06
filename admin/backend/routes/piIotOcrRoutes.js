// SMaRT-PDM: OCR — pi Iot Ocr Routes (admin backend route); maps API endpoints to middleware and controllers.
const express = require('express');

const piIotOcrController = require('../controllers/piIotOcrController');
const { verifyPiToken } = require('../middleware/verifyPiToken');

const router = express.Router();
const captureUploadRelay = require('../services/captureUploadRelay');

router.put('/:requestId/capture-artifacts/:artifactId/upload',
    captureUploadRelay.verify,
    express.raw({ type: ['image/jpeg', 'image/png'], limit: '15mb' }),
    captureUploadRelay.upload);

router.use(verifyPiToken);
router.get('/schema', piIotOcrController.getIotOcrSchemaStatus);
router.get('/next', piIotOcrController.getNextIotOcrRequest);
router.post('/:requestId/status', piIotOcrController.updateIotOcrRequestStatus);
router.post('/:requestId/capture-artifacts/authorize', piIotOcrController.authorizeV2CaptureUploads);
router.post('/:requestId/capture-artifacts/complete', piIotOcrController.completeV2CaptureUploads);
router.post('/:requestId/result', piIotOcrController.submitIotOcrRequestResult);

module.exports = router;
