const express = require('express');
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const payoutController = require('../controllers/payoutController');

const router = express.Router();
const proofUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 },
});

router.post('/batches', protect, payoutController.createPayoutBatch);
router.patch('/batches/:payoutBatchId/schedule', protect, payoutController.schedulePayoutBatch);
router.patch('/entries/:payoutEntryId/status', protect, payoutController.updatePayoutEntryStatus);
router.get('/me', protect, payoutController.getMyPayouts);
router.post(
    '/entries/:payoutEntryId/proof',
    protect,
    proofUpload.single('proof'),
    payoutController.uploadMyPayoutProof
);

module.exports = router;