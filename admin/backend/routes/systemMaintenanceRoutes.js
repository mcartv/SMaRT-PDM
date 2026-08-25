const express = require('express');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const systemMaintenanceController = require('../controllers/systemMaintenanceController');

const router = express.Router();
const adminOnly = [protect, authorizeRoles('admin')];

router.get('/public', systemMaintenanceController.getPublicState);
router.get('/', ...adminOnly, systemMaintenanceController.getState);
router.patch('/', ...adminOnly, systemMaintenanceController.updateState);
router.get('/status', ...adminOnly, systemMaintenanceController.getStatus);
router.post('/backup', ...adminOnly, systemMaintenanceController.downloadBackup);

module.exports = router;
