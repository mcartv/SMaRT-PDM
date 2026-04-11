const express = require('express');
const router = express.Router();

const {
    getPayoutBatches,
    getPayoutOpenings,
    getEligibleScholarsByOpening,
    createPayoutBatch,
    updateScholarStatus,
} = require('../controllers/payoutController');

const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, getPayoutBatches);
router.get('/openings', protect, getPayoutOpenings);
router.get('/eligible-scholars', protect, getEligibleScholarsByOpening);
router.post('/', protect, createPayoutBatch);
router.patch('/entries/:payoutEntryId/status', protect, updateScholarStatus);

module.exports = router;