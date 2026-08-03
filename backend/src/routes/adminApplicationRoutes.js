const express = require('express');
const { protect, requireAdmin } = require('../middleware/authMiddleware');
const adminApplicationController = require('../controllers/adminApplicationController');

const router = express.Router();

router.use(protect, requireAdmin);

router.get('/', adminApplicationController.getApplications);
router.get('/:applicationId', adminApplicationController.getApplicationById);

router.patch(
    '/:applicationId/approve',
    adminApplicationController.approveApplication
);

router.patch(
    '/:applicationId/reject',
    adminApplicationController.rejectApplication
);

module.exports = router;
