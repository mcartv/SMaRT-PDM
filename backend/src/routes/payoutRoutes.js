const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const payoutController = require('../controllers/payoutController');

const router = express.Router();

router.post('/batches', protect, payoutController.createPayoutBatch);
router.patch('/batches/:payoutBatchId/schedule', protect, payoutController.schedulePayoutBatch);

module.exports = router;