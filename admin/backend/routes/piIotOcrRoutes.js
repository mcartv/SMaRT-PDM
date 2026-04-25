const express = require('express');

const piIotOcrController = require('../controllers/piIotOcrController');
const { verifyPiToken } = require('../middleware/verifyPiToken');

const router = express.Router();

router.use(verifyPiToken);
router.get('/next', piIotOcrController.getNextIotOcrRequest);
router.post('/:requestId/result', piIotOcrController.submitIotOcrRequestResult);

module.exports = router;
