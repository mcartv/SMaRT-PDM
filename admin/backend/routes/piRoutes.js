const express = require('express');

const piController = require('../controllers/piController');
const { verifyPiToken } = require('../middleware/verifyPiToken');

const router = express.Router();

router.use(verifyPiToken);
router.get('/jobs/next', piController.getNextOcrJob);
router.post('/jobs/:id/result', piController.submitOcrJobResult);

module.exports = router;
