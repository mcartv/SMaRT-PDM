const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const adminApplicationController = require('../controllers/adminApplicationController');

const router = express.Router();

router.get('/', protect, adminApplicationController.getApplications);
router.get('/:applicationId', protect, adminApplicationController.getApplicationById);

router.patch(
    '/:applicationId/approve',
    protect,
    adminApplicationController.approveApplication
);

router.patch(
    '/:applicationId/reject',
    protect,
    adminApplicationController.rejectApplication
);

module.exports = router;