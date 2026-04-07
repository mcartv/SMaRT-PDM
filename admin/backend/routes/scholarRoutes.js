const express = require('express');
const router = express.Router();
const scholarController = require('../controllers/scholarController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/sdo/stats', protect, authorizeRoles('sdo'), scholarController.getSdoStats);
router.get('/stats', protect, scholarController.getStats);
router.get('/', protect, scholarController.getAllScholars);
router.patch('/:id/sdo-status', protect, authorizeRoles('sdo'), scholarController.updateSdoStatus);
router.get('/:id', protect, scholarController.getScholarById);

module.exports = router;
