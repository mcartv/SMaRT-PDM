const express = require('express');
const router = express.Router();

const renewalController = require('../controllers/renewalController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const adminOnly = [
    protect,
    authorizeRoles('admin', 'Admin'),
];

router.get('/', adminOnly, renewalController.getRenewals);
router.get('/:id', adminOnly, renewalController.getRenewalDetails);
router.post('/:id/review', adminOnly, renewalController.saveRenewalReview);

module.exports = router;