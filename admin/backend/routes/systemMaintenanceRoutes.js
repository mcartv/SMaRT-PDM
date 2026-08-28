const express = require('express');
const rateLimit = require('express-rate-limit');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const systemMaintenanceController = require('../controllers/systemMaintenanceController');

const router = express.Router();
const adminOnly = [protect, authorizeRoles('admin')];
const publicVisitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many visitor tracking requests.' },
});

router.get('/public', systemMaintenanceController.getPublicState);
router.get('/public-visitor-counts', publicVisitLimiter, systemMaintenanceController.getPublicVisitorCounts);
router.post('/public-visit', publicVisitLimiter, systemMaintenanceController.recordPublicVisit);
router.post('/activity/heartbeat', protect, systemMaintenanceController.heartbeatActivity);
router.get('/', ...adminOnly, systemMaintenanceController.getState);
router.patch('/', ...adminOnly, systemMaintenanceController.updateState);
router.get('/status', ...adminOnly, systemMaintenanceController.getStatus);
router.post('/backup', ...adminOnly, systemMaintenanceController.downloadBackup);

module.exports = router;
