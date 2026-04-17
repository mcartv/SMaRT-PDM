const express = require('express');
const router = express.Router();

const {
    getPayoutBatches,
    getPayoutOpenings,
    getEligibleScholarsByOpening,
    createPayoutBatch,
    updateScholarStatus,
    archivePayoutBatch,
} = require('../controllers/payoutController');

const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getPayoutBatches);
router.get('/openings', protect, getPayoutOpenings);
router.get('/eligible-scholars', protect, getEligibleScholarsByOpening);
router.post('/', protect, createPayoutBatch);
router.patch('/entries/:payoutEntryId/status', protect, updateScholarStatus);
router.patch('/:batchId/archive', protect, archivePayoutBatch);

module.exports = router;