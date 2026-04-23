const express = require('express');
const { getNextOcrJob, submitOcrJobResult } = require('../controllers/piController');
const { verifyPiToken } = require('../middleware/verifyPiToken');

const router = express.Router();

router.use(verifyPiToken);
router.get('/jobs/next', getNextOcrJob);
router.post('/jobs/:id/result', submitOcrJobResult);

module.exports = router;
