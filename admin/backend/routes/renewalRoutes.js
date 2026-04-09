const express = require('express');
const router = express.Router();
const renewalController = require('../controllers/renewalController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', protect, renewalController.getRenewals);
router.get('/:id', protect, renewalController.getRenewalDetails);
router.post('/:id/review', protect, renewalController.saveRenewalReview);

module.exports = router;
