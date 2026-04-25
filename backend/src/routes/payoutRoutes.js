const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const payoutController = require('../controllers/payoutController');

const router = express.Router();

router.post('/batches', protect, payoutController.createPayoutBatch);
router.patch('/batches/:payoutBatchId/schedule', protect, payoutController.schedulePayoutBatch);
router.patch('/entries/:payoutEntryId/status', protect, payoutController.updatePayoutEntryStatus);
router.get('/me', protect, payoutController.getMyPayouts);

module.exports = router;